"""
Mobile app API for Aoro Care (band / health ring -> cloud).

Endpoints (all JSON, prefix /api/mobile):
    POST /login            email + password  -> bearer token
    GET  /me               current patient + rings
    POST /ring/register    register / find the band (by MAC) for this patient
    POST /readings/batch   upload a batch of readings from the band

Auth: "Authorization: Bearer <token>" (signed with SECRET_KEY, no new packages).
Only users with role "patient" can use these endpoints, and a patient can
only ever write data for their own rings.
"""

from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Blueprint, current_app, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from database import csrf, db
from models import HealthData, HealthRing, Patient, RingSyncLog, User

mobile_api_bp = Blueprint("mobile_api", __name__, url_prefix="/api/mobile")

# The mobile app does not use cookies / CSRF tokens, it uses a bearer token.
csrf.exempt(mobile_api_bp)

TOKEN_MAX_AGE = 30 * 24 * 3600  # 30 days
MAX_BATCH_SIZE = 500

# field -> (type, min, max). Anything outside the range is rejected.
READING_FIELDS = {
    "heart_rate": (int, 30, 220),
    "spo2": (float, 50, 100),
    "body_temperature": (float, 30, 45),
    "steps": (int, 0, 200000),
    "calories": (float, 0, 20000),
    "distance": (float, 0, 500),
    "sleep_hours": (float, 0, 24),
    "stress_level": (int, 0, 100),
    "heart_rate_variability": (float, 0, 500),
    "sleep_deep_hours": (float, 0, 24),
    "sleep_light_hours": (float, 0, 24),
    "sleep_rem_hours": (float, 0, 24),
    "sleep_awake_hours": (float, 0, 24),
    "respiratory_rate": (float, 3, 60),
    "blood_pressure_systolic": (int, 50, 260),
    "blood_pressure_diastolic": (int, 30, 160),
}


# ==========================================================
# Helpers
# ==========================================================

def _ok(data=None, message=None, status=200):
    return jsonify({"success": True, "message": message, "data": data}), status


def _err(message, status=400, field=None):
    return jsonify({"success": False, "message": message, "field": field}), status


def _serializer():
    return URLSafeTimedSerializer(
        current_app.config["SECRET_KEY"], salt="aoro-mobile-token-v1"
    )


def _issue_token(user):
    return _serializer().dumps({"uid": user.id})


def mobile_auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return _err("Missing token.", 401)

        try:
            payload = _serializer().loads(
                header[7:].strip(), max_age=TOKEN_MAX_AGE
            )
        except SignatureExpired:
            return _err("Session expired. Please log in again.", 401)
        except BadSignature:
            return _err("Invalid token.", 401)

        user = db.session.get(User, payload.get("uid"))
        if not user or user.role != "patient" or not user.is_verified:
            return _err("Account not allowed.", 403)

        patient = Patient.query.filter_by(user_id=user.id).first()
        if not patient or patient.status != "active":
            return _err("Patient profile not active.", 403)

        g.user = user
        g.patient = patient
        return fn(*args, **kwargs)

    return wrapper


def _parse_ts(value):
    """ISO-8601 -> naive UTC datetime (the rest of the app stores naive UTC)."""
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _clean_reading(raw):
    """Return {field: value} with only valid, in-range values, or None."""
    clean = {}
    for field, (cast, lo, hi) in READING_FIELDS.items():
        value = raw.get(field)
        if value is None or value == "":
            continue
        try:
            value = cast(value)
        except (TypeError, ValueError):
            continue
        if lo <= value <= hi:
            clean[field] = value
    return clean or None


def _ring_to_dict(ring):
    return {
        "id": ring.id,
        "serial_number": ring.ring_serial_number,
        "model": ring.model,
        "mac_address": ring.mac_address,
        "battery_percentage": ring.battery_percentage,
        "connection_status": ring.connection_status,
        "last_sync": ring.last_sync.isoformat() + "Z" if ring.last_sync else None,
    }


# ==========================================================
# Login / profile
# ==========================================================

@mobile_api_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return _err("Email and password are required.")

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return _err("Invalid email or password.", 401)

    if user.role != "patient":
        return _err("This app is for patient accounts only.", 403)
    if not user.is_verified:
        return _err("Please verify your email before signing in.", 403)

    patient = Patient.query.filter_by(user_id=user.id).first()
    if not patient or patient.status != "active":
        return _err("Patient profile not active.", 403)

    rings = HealthRing.query.filter_by(patient_id=patient.id).all()

    return _ok(
        {
            "token": _issue_token(user),
            "expires_in": TOKEN_MAX_AGE,
            "patient": {
                "id": patient.id,
                "name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
                "patient_code": patient.patient_code,
            },
            "rings": [_ring_to_dict(r) for r in rings],
        },
        "Signed in successfully",
    )


@mobile_api_bp.route("/me", methods=["GET"])
@mobile_auth_required
def me():
    rings = HealthRing.query.filter_by(patient_id=g.patient.id).all()
    return _ok(
        {
            "patient": {
                "id": g.patient.id,
                "name": f"{g.user.first_name or ''} {g.user.last_name or ''}".strip(),
                "patient_code": g.patient.patient_code,
            },
            "rings": [_ring_to_dict(r) for r in rings],
        }
    )


# ==========================================================
# Ring registration
# ==========================================================

@mobile_api_bp.route("/ring/register", methods=["POST"])
@mobile_auth_required
def ring_register():
    """
    Called after the app connects to the band over BLE.
    Finds the ring by MAC address for this patient, or creates it.
    """
    data = request.get_json(silent=True) or {}

    mac = (data.get("mac_address") or "").strip().upper()
    if not mac or len(mac) > 30:
        return _err("A valid mac_address is required.", field="mac_address")

    serial = (data.get("serial_number") or "").strip()[:50]
    if not serial:
        serial = "BLE-" + mac.replace(":", "")

    model = (data.get("model") or "").strip()[:50] or None
    firmware = (data.get("firmware_version") or "").strip()[:30] or None

    ring = HealthRing.query.filter_by(mac_address=mac).first()

    if ring and ring.patient_id != g.patient.id:
        # Never let one patient take over another patient's band.
        return _err("This band is already registered to another patient.", 409)

    if not ring:
        if HealthRing.query.filter_by(ring_serial_number=serial).first():
            return _err("This band serial number is already registered.", 409)

        ring = HealthRing(
            patient_id=g.patient.id,
            ring_serial_number=serial,
            mac_address=mac,
            model=model,
            firmware_version=firmware,
            connection_status="connected",
            status="active",
        )
        db.session.add(ring)
    else:
        if model:
            ring.model = model
        if firmware:
            ring.firmware_version = firmware
        ring.connection_status = "connected"

    db.session.commit()
    return _ok(_ring_to_dict(ring), "Band registered")


@mobile_api_bp.route("/ring/status", methods=["POST"])
@mobile_auth_required
def ring_status():
    """The app tells the server when the band connects / disconnects."""
    data = request.get_json(silent=True) or {}

    ring = db.session.get(HealthRing, data.get("ring_id") or "")
    if not ring or ring.patient_id != g.patient.id:
        return _err("Unknown ring for this patient.", 403, "ring_id")

    status = data.get("status")
    if status not in ("connected", "disconnected"):
        return _err("status must be 'connected' or 'disconnected'.", field="status")

    ring.connection_status = status
    db.session.commit()
    return _ok({"connection_status": status}, "Status updated")


# ==========================================================
# Upload readings
# ==========================================================

@mobile_api_bp.route("/readings/batch", methods=["POST"])
@mobile_auth_required
def readings_batch():
    """
    Body:
    {
      "ring_id": "<uuid>",
      "battery_level": 80,                       (optional)
      "readings": [
        {"recorded_at": "2026-11-01T10:15:00Z", "heart_rate": 84, "steps": 1200},
        ...
      ]
    }
    Safe to retry: readings already stored for the same ring + timestamp
    are skipped, so the app can re-send a batch after a network failure.
    """
    data = request.get_json(silent=True) or {}

    ring = db.session.get(HealthRing, data.get("ring_id") or "")
    if not ring or ring.patient_id != g.patient.id:
        return _err("Unknown ring for this patient.", 403, "ring_id")

    readings = data.get("readings")
    if not isinstance(readings, list) or not readings:
        return _err("readings must be a non-empty list.", field="readings")
    if len(readings) > MAX_BATCH_SIZE:
        return _err(f"Max {MAX_BATCH_SIZE} readings per batch.", 413)

    sync_start = datetime.utcnow()
    latest_allowed = sync_start + timedelta(minutes=5)

    parsed = []
    rejected = 0
    for raw in readings:
        if not isinstance(raw, dict):
            rejected += 1
            continue
        ts = _parse_ts(raw.get("recorded_at"))
        values = _clean_reading(raw)
        if ts is None or ts > latest_allowed or values is None:
            rejected += 1
            continue
        parsed.append((ts, values))

    inserted = 0
    duplicates = 0

    if parsed:
        lo = min(ts for ts, _ in parsed)
        hi = max(ts for ts, _ in parsed)
        existing = {
            row[0]
            for row in db.session.query(HealthData.recorded_at).filter(
                HealthData.ring_id == ring.id,
                HealthData.recorded_at >= lo,
                HealthData.recorded_at <= hi,
            )
        }

        seen = set()
        for ts, values in parsed:
            if ts in existing or ts in seen:
                duplicates += 1
                continue
            seen.add(ts)
            db.session.add(
                HealthData(
                    patient_id=g.patient.id,
                    ring_id=ring.id,
                    recorded_at=ts,
                    **values,
                )
            )
            inserted += 1

    battery = data.get("battery_level")
    try:
        battery = int(battery) if battery is not None else None
    except (TypeError, ValueError):
        battery = None
    if battery is not None and not 0 <= battery <= 100:
        battery = None

    ring.last_sync = datetime.utcnow()
    ring.connection_status = "connected"
    if battery is not None:
        ring.battery_percentage = battery

    db.session.add(
        RingSyncLog(
            ring_id=ring.id,
            patient_id=g.patient.id,
            sync_start=sync_start,
            sync_end=datetime.utcnow(),
            records_uploaded=inserted,
            battery_level=battery,
            sync_status="success",
        )
    )

    db.session.commit()

    return _ok(
        {"inserted": inserted, "duplicates": duplicates, "rejected": rejected},
        "Readings saved",
    )
