from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session,
    abort
)

from database import db

from models import (
    Patient,
    HealthRing,
    EmergencyAlert,
    Doctor
)


emergency_alert_bp = Blueprint(
    "emergency_alert",
    __name__,
    url_prefix="/emergency-alert"
)


# ==========================================================
# Helpers
# ==========================================================

def _to_float_or_none(value):
    return value if value not in (None, "") else None


# ==========================================================
# Emergency Alert List
#
# NOTE: the view function is named alert_list() as specified,
# but the route is registered under endpoint="emergency_list"
# so it matches the url_for('emergency_alert.emergency_list')
# links already shipped in the sidebar of every other module
# (Hospital, Doctor, Patient, Family, Health Ring, Health Data,
# Appointment, Report). This avoids a BuildError without having
# to go back and edit every previously generated template.
# ==========================================================

@emergency_alert_bp.route("/", endpoint="emergency_list")
def alert_list():

    alerts = EmergencyAlert.query.order_by(
        EmergencyAlert.created_at.desc()
    ).all()

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    rings = HealthRing.query.filter_by(
        status="active"
    ).all()

    return render_template(
        "emergency_alert/emergency_alert_list.html",
        alerts=alerts,
        patients=patients,
        rings=rings
    )

# ==========================================================
# Add Emergency Alert
# ==========================================================

@emergency_alert_bp.route("/add", methods=["GET", "POST"])
def alert_add():

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    rings = HealthRing.query.filter_by(
        status="active"
    ).all()

    if request.method == "POST":

        alert = EmergencyAlert(
            patient_id=request.form["patient_id"],
            ring_id=request.form.get("ring_id") or None,
            alert_type=request.form.get("alert_type"),
            severity=request.form.get("severity"),
            heart_rate=_to_float_or_none(request.form.get("heart_rate")),
            spo2=_to_float_or_none(request.form.get("spo2")),
            message=request.form.get("message"),
            latitude=_to_float_or_none(request.form.get("latitude")),
            longitude=_to_float_or_none(request.form.get("longitude")),
            status=request.form.get("status", "active")
        )

        db.session.add(alert)
        db.session.commit()

        flash(
            "Emergency alert added successfully.",
            "success"
        )

        return redirect(
            url_for("emergency_alert.emergency_list")
        )

    return render_template(
        "emergency_alert/emergency_alert_add.html",
        patients=patients,
        rings=rings
    )
# ==========================================================
# Edit Emergency Alert
# ==========================================================

@emergency_alert_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def alert_edit(id):

    alert = EmergencyAlert.query.get_or_404(id)

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    rings = HealthRing.query.filter_by(
        status="active"
    ).all()

    if request.method == "POST":

        alert.patient_id = request.form["patient_id"]
        alert.ring_id = request.form.get("ring_id") or None
        alert.alert_type = request.form.get("alert_type")
        alert.severity = request.form.get("severity")
        alert.heart_rate = _to_float_or_none(request.form.get("heart_rate"))
        alert.spo2 = _to_float_or_none(request.form.get("spo2"))
        alert.message = request.form.get("message")
        alert.latitude = _to_float_or_none(request.form.get("latitude"))
        alert.longitude = _to_float_or_none(request.form.get("longitude"))
        alert.status = request.form.get("status")

        db.session.commit()

        flash("Emergency alert updated successfully.", "success")

        return redirect(url_for("emergency_alert.emergency_list"))

    return render_template(
        "emergency_alert/emergency_alert_edit.html",
        alert=alert,
        patients=patients,
        rings=rings
    )
# ==========================================================
# Delete Emergency Alert
# ==========================================================

@emergency_alert_bp.route("/delete/<string:id>", methods=["POST"])
def alert_delete(id):

    alert = EmergencyAlert.query.get_or_404(id)

    db.session.delete(alert)
    db.session.commit()

    flash("Emergency alert deleted successfully.", "success")

    return redirect(url_for("emergency_alert.emergency_list"))

# ==========================================================
# Doctor Emergency Alert List
# ==========================================================

@emergency_alert_bp.route("/doctor")
def doctor_emergency_alert_list():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    if session["user"]["role"] != "doctor":
        abort(403)

    doctor = Doctor.query.filter_by(
        user_id=session["user"]["id"]
    ).first_or_404()

    alerts = (
        EmergencyAlert.query
        .join(Patient)
        .filter(Patient.assigned_doctor_id == doctor.id)
        .order_by(EmergencyAlert.created_at.desc())
        .all()
    )

    return render_template(
        "doctor/doctor_emergency_alert_list.html",
        doctor=doctor,
        alerts=alerts
    )