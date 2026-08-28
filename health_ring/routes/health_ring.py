from datetime import datetime

from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash
)

from database import db
from models import Patient, HealthRing
from models import Patient, HealthRing, Doctor


health_ring_bp = Blueprint(
    "health_ring",
    __name__,
    url_prefix="/health-ring"
)


# ==========================================================
# Helpers
# ==========================================================

def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _parse_datetime(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M")
    except ValueError:
        return None


# ==========================================================
# Health Ring List
# ==========================================================

@health_ring_bp.route("/")
def ring_list():

    rings = HealthRing.query.order_by(
        HealthRing.created_at.desc()
    ).all()

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    return render_template(
        "health_ring/ring_list.html",
        rings=rings,
        patients=patients
    )

# ==========================================================
# Add Health Ring
# ==========================================================

@health_ring_bp.route("/add", methods=["GET", "POST"])
def ring_add():

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    if request.method == "POST":

        ring_serial_number = request.form["ring_serial_number"]
        mac_address = request.form["mac_address"]

        # ---------------- Duplicate Serial Number ----------------

        existing_serial = HealthRing.query.filter_by(
            ring_serial_number=ring_serial_number
        ).first()

        if existing_serial:
            flash("Ring Serial Number already exists.", "danger")
            return redirect(url_for("health_ring.ring_list"))

        # ---------------- Duplicate MAC Address ----------------

        existing_mac = HealthRing.query.filter_by(
            mac_address=mac_address
        ).first()

        if existing_mac:
            flash("MAC Address already exists.", "danger")
            return redirect(url_for("health_ring.ring_list"))

        # ---------------- Create Health Ring ----------------

        ring = HealthRing(
            patient_id=request.form["patient_id"],
            ring_serial_number=ring_serial_number,
            model=request.form.get("model"),
            firmware_version=request.form.get("firmware_version"),
            mac_address=mac_address,
            battery_percentage=request.form.get("battery_percentage") or None,
            connection_status=request.form.get("connection_status", "offline"),
            last_sync=_parse_datetime(request.form.get("last_sync")),
            purchased_date=_parse_date(request.form.get("purchased_date")),
            warranty_expiry=_parse_date(request.form.get("warranty_expiry")),
            status=request.form.get("status", "active")
        )

        db.session.add(ring)
        db.session.commit()

        flash(
            "Health ring added successfully.",
            "success"
        )

        return redirect(
            url_for("health_ring.ring_list")
        )

    return render_template(
        "health_ring/ring_add.html",
        patients=patients
    )
# ==========================================================
# Edit Health Ring
# ==========================================================

@health_ring_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def ring_edit(id):

    ring = HealthRing.query.get_or_404(id)

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    if request.method == "POST":

        ring_serial_number = request.form["ring_serial_number"]
        mac_address = request.form["mac_address"]

        # ---------------- Duplicate Serial Number ----------------

        existing_serial = HealthRing.query.filter(
            HealthRing.ring_serial_number == ring_serial_number,
            HealthRing.id != id
        ).first()

        if existing_serial:
            flash("Ring Serial Number already exists.", "danger")
            return redirect(url_for("health_ring.ring_edit", id=id))

        # ---------------- Duplicate MAC Address ----------------

        existing_mac = HealthRing.query.filter(
            HealthRing.mac_address == mac_address,
            HealthRing.id != id
        ).first()

        if existing_mac:
            flash("MAC Address already exists.", "danger")
            return redirect(url_for("health_ring.ring_edit", id=id))

        # ---------------- Update Health Ring ----------------

        ring.patient_id = request.form["patient_id"]
        ring.ring_serial_number = ring_serial_number
        ring.model = request.form.get("model")
        ring.firmware_version = request.form.get("firmware_version")
        ring.mac_address = mac_address
        ring.battery_percentage = request.form.get("battery_percentage") or None
        ring.connection_status = request.form.get("connection_status")
        ring.last_sync = _parse_datetime(request.form.get("last_sync"))
        ring.purchased_date = _parse_date(request.form.get("purchased_date"))
        ring.warranty_expiry = _parse_date(request.form.get("warranty_expiry"))
        ring.status = request.form.get("status")

        db.session.commit()

        flash("Health ring updated successfully.", "success")

        if "user" in session and session["user"]["role"] == "doctor":
            return redirect(url_for("health_ring.doctor_health_ring_list"))

        return redirect(url_for("health_ring.ring_list"))

    return render_template(
        "health_ring/ring_edit.html",
        ring=ring,
        patients=patients
    )
# ==========================================================
# Delete Health Ring
# ==========================================================

@health_ring_bp.route("/delete/<string:id>", methods=["POST"])
def ring_delete(id):

    ring = HealthRing.query.get_or_404(id)

    db.session.delete(ring)
    db.session.commit()

    flash("Health ring deleted successfully.", "success")

    return redirect(url_for("health_ring.ring_list"))
from flask import session, abort

# ==========================================================
# Doctor Health Ring List
# ==========================================================

@health_ring_bp.route("/doctor")
def doctor_health_ring_list():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    if session["user"]["role"] != "doctor":
        abort(403)

    doctor = Doctor.query.filter_by(
        user_id=session["user"]["id"]
    ).first_or_404()

    rings = (
    HealthRing.query
    .join(Patient)
    .filter(Patient.assigned_doctor_id == doctor.id)
    .all()
)

    return render_template(
        "doctor/doctor_health_ring_list.html",
        doctor=doctor,
        rings=rings
    )