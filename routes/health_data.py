
from datetime import datetime, date

from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session,
    abort,
)

from database import db
from models import Patient, HealthRing, HealthData, Doctor
from utils import get_hospital_scope


health_data_bp = Blueprint(
    "health_data",
    __name__,
    url_prefix="/health-data",
)


# ==========================================================
# Helpers
# ==========================================================

def _parse_datetime(value):
    if not value:
        return None

    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M")
    except (ValueError, TypeError):
        return None


def _to_float_or_none(value):
    return value if value not in (None, "") else None


def _require_admin_scope():
    """Allow only logged-in Admin and Super Admin users."""

    if "user" not in session:
        return None

    role = session["user"].get("role")

    if role not in ("admin", "super_admin"):
        abort(403)

    return get_hospital_scope()


def _validate_health_data_access(scope, patient_id, ring_id=None):
    """Validate patient and optional ring against the user's hospital scope."""

    patient = db.session.get(Patient, patient_id)

    if not patient or not scope.can_access_patient(patient):
        abort(403)

    if ring_id:
        ring = db.session.get(HealthRing, ring_id)

        if (
            not ring
            or ring.patient_id != patient.id
            or not scope.can_access_ring(ring)
        ):
            abort(403)

    return patient


def _get_scoped_patients(scope):
    """Return active patients visible to the current Admin/Super Admin."""

    query = Patient.query.filter_by(status="active")
    return scope.filter_patients(query).all()


def _get_scoped_rings(scope):
    """Return active rings visible to the current Admin/Super Admin."""

    query = HealthRing.query.filter_by(status="active")
    return scope.filter_rings(query).all()


# ==========================================================
# Health Data List
# ==========================================================

@health_data_bp.route("/")
def health_data_list():

    scope = _require_admin_scope()

    if scope is None:
        return redirect(url_for("pages.login"))

    # Super Admin sees all records. Admin sees records belonging
    # only to patients in their assigned hospital.
    query = HealthData.query.join(
        Patient,
        HealthData.patient_id == Patient.id,
    )

    if not scope.is_super_admin:
        if scope.unassigned:
            query = query.filter(db.false())
        else:
            query = query.filter(
                Patient.id.in_(scope.patient_ids)
            )

    health_data_records = query.order_by(
        HealthData.recorded_at.desc()
    ).all()

    patients = _get_scoped_patients(scope)
    rings = _get_scoped_rings(scope)

    today_count = sum(
        1
        for record in health_data_records
        if record.recorded_at
        and record.recorded_at.date() == date.today()
    )

    return render_template(
        "health_data/health_data_list.html",
        health_data_records=health_data_records,
        patients=patients,
        rings=rings,
        today_count=today_count,
    )


# ==========================================================
# Add Health Data
# ==========================================================

@health_data_bp.route("/add", methods=["GET", "POST"])
def health_data_add():

    scope = _require_admin_scope()

    if scope is None:
        return redirect(url_for("pages.login"))

    patients = _get_scoped_patients(scope)
    rings = _get_scoped_rings(scope)

    if request.method == "POST":

        patient_id = request.form.get("patient_id")
        ring_id = request.form.get("ring_id") or None

        # Never trust patient/ring IDs submitted by the browser.
        _validate_health_data_access(
            scope,
            patient_id,
            ring_id,
        )

        record = HealthData(
            patient_id=patient_id,
            ring_id=ring_id,
            heart_rate=_to_float_or_none(
                request.form.get("heart_rate")
            ),
            spo2=_to_float_or_none(
                request.form.get("spo2")
            ),
            body_temperature=_to_float_or_none(
                request.form.get("body_temperature")
            ),
            stress_level=_to_float_or_none(
                request.form.get("stress_level")
            ),
            sleep_hours=_to_float_or_none(
                request.form.get("sleep_hours")
            ),
            steps=_to_float_or_none(
                request.form.get("steps")
            ),
            calories=_to_float_or_none(
                request.form.get("calories")
            ),
            distance=_to_float_or_none(
                request.form.get("distance")
            ),
            heart_rate_variability=_to_float_or_none(
                request.form.get("heart_rate_variability")
            ),
            respiratory_rate=_to_float_or_none(
                request.form.get("respiratory_rate")
            ),
            blood_pressure_systolic=_to_float_or_none(
                request.form.get("blood_pressure_systolic")
            ),
            blood_pressure_diastolic=_to_float_or_none(
                request.form.get("blood_pressure_diastolic")
            ),
            recorded_at=(
                _parse_datetime(request.form.get("recorded_at"))
                or datetime.utcnow()
            ),
        )

        db.session.add(record)
        db.session.commit()

        flash("Health data added successfully.", "success")

        return redirect(url_for("health_data.health_data_list"))

    return render_template(
        "health_data/health_data_add.html",
        patients=patients,
        rings=rings,
    )


# ==========================================================
# Edit Health Data
# ==========================================================

@health_data_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def health_data_edit(id):

    scope = _require_admin_scope()

    if scope is None:
        return redirect(url_for("pages.login"))

    record = HealthData.query.get_or_404(id)

    # Check access to the existing record before displaying or editing it.
    _validate_health_data_access(
        scope,
        record.patient_id,
        record.ring_id,
    )

    patients = _get_scoped_patients(scope)
    rings = _get_scoped_rings(scope)

    if request.method == "POST":

        patient_id = request.form.get("patient_id")
        ring_id = request.form.get("ring_id") or None

        # Validate the new patient and ring before updating the record.
        _validate_health_data_access(
            scope,
            patient_id,
            ring_id,
        )

        record.patient_id = patient_id
        record.ring_id = ring_id

        record.heart_rate = _to_float_or_none(
            request.form.get("heart_rate")
        )
        record.spo2 = _to_float_or_none(
            request.form.get("spo2")
        )
        record.body_temperature = _to_float_or_none(
            request.form.get("body_temperature")
        )
        record.stress_level = _to_float_or_none(
            request.form.get("stress_level")
        )
        record.sleep_hours = _to_float_or_none(
            request.form.get("sleep_hours")
        )
        record.steps = _to_float_or_none(
            request.form.get("steps")
        )
        record.calories = _to_float_or_none(
            request.form.get("calories")
        )
        record.distance = _to_float_or_none(
            request.form.get("distance")
        )
        record.heart_rate_variability = _to_float_or_none(
            request.form.get("heart_rate_variability")
        )
        record.respiratory_rate = _to_float_or_none(
            request.form.get("respiratory_rate")
        )
        record.blood_pressure_systolic = _to_float_or_none(
            request.form.get("blood_pressure_systolic")
        )
        record.blood_pressure_diastolic = _to_float_or_none(
            request.form.get("blood_pressure_diastolic")
        )

        record.recorded_at = (
            _parse_datetime(request.form.get("recorded_at"))
            or record.recorded_at
        )

        db.session.commit()

        flash("Health data updated successfully.", "success")

        return redirect(url_for("health_data.health_data_list"))

    return render_template(
        "health_data/health_data_edit.html",
        record=record,
        patients=patients,
        rings=rings,
    )


# ==========================================================
# Delete Health Data
# ==========================================================

@health_data_bp.route("/delete/<string:id>", methods=["POST"])
def health_data_delete(id):

    scope = _require_admin_scope()

    if scope is None:
        return redirect(url_for("pages.login"))

    record = HealthData.query.get_or_404(id)

    # Do not allow deletion of another hospital's health data.
    _validate_health_data_access(
        scope,
        record.patient_id,
        record.ring_id,
    )

    db.session.delete(record)
    db.session.commit()

    flash("Health data deleted successfully.", "success")

    return redirect(url_for("health_data.health_data_list"))


# ==========================================================
# Doctor Live Health Monitoring
# ==========================================================

@health_data_bp.route("/doctor")
def doctor_live_monitoring():

    # Login check
    if "user" not in session:
        return redirect(url_for("pages.login"))

    # Role check
    if session["user"]["role"] != "doctor":
        abort(403)

    # Current doctor
    doctor = Doctor.query.filter_by(
        user_id=session["user"]["id"]
    ).first_or_404()

    # Health data for this doctor's assigned patients only
    health_data_records = (
        HealthData.query
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id
        )
        .order_by(
            HealthData.recorded_at.desc()
        )
        .all()
    )

    # Statistics
    total_patients = len({
        record.patient_id
        for record in health_data_records
    })

    healthy_count = sum(
        1
        for record in health_data_records
        if (
            record.heart_rate
            and 60 <= record.heart_rate <= 100
            and record.spo2
            and record.spo2 >= 95
        )
    )

    warning_count = sum(
        1
        for record in health_data_records
        if (
            (
                record.heart_rate
                and (
                    record.heart_rate < 60
                    or record.heart_rate > 100
                )
            )
            or (
                record.spo2
                and record.spo2 < 95
            )
        )
    )

    return render_template(
        "doctor/doctor_live_monitoring.html",
        doctor=doctor,
        health_data_records=health_data_records,
        total_patients=total_patients,
        healthy_count=healthy_count,
        warning_count=warning_count,
    )
