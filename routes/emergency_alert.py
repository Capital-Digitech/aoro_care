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
from utils import get_hospital_scope


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
    scope = get_hospital_scope()

    if scope.is_scoped:
        if scope.is_unassigned:
            alerts = []
            patients = []
            rings = []
        else:
            alerts = EmergencyAlert.query.filter(
                EmergencyAlert.patient_id.in_(scope.patient_ids)
            ).order_by(
                EmergencyAlert.created_at.desc()
            ).all()

            patients = Patient.query.filter(
                Patient.status == "active",
                Patient.id.in_(scope.patient_ids)
            ).all()

            rings = HealthRing.query.filter(
                HealthRing.status == "active",
                HealthRing.patient_id.in_(scope.patient_ids)
            ).all()
    else:
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
    scope = get_hospital_scope()

    if scope.is_unassigned:
        flash("Access denied. Please contact system administrator to assign a hospital.", "danger")
        return redirect(url_for("emergency_alert.emergency_list"))

    if scope.is_scoped:
        patients = Patient.query.filter(
            Patient.status == "active",
            Patient.id.in_(scope.patient_ids)
        ).all()
        rings = HealthRing.query.filter(
            HealthRing.status == "active",
            HealthRing.patient_id.in_(scope.patient_ids)
        ).all()
    else:
        patients = Patient.query.filter_by(
            status="active"
        ).all()
        rings = HealthRing.query.filter_by(
            status="active"
        ).all()

    if request.method == "POST":
        patient_id = request.form.get("patient_id")
        ring_id = request.form.get("ring_id") or None

        if scope.is_scoped:
            if not patient_id or patient_id not in scope.patient_ids_set:
                flash("Access denied. Invalid patient selected for your hospital.", "danger")
                return redirect(url_for("emergency_alert.emergency_list"))
            if ring_id:
                ring = HealthRing.query.get(ring_id)
                if not ring or not scope.can_access_ring(ring):
                    flash("Access denied. Invalid ring selected for your hospital.", "danger")
                    return redirect(url_for("emergency_alert.emergency_list"))

        alert = EmergencyAlert(
            patient_id=patient_id,
            ring_id=ring_id,
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
    scope = get_hospital_scope()
    alert = EmergencyAlert.query.get_or_404(id)

    if not scope.can_access_alert(alert):
        flash("Access denied. You do not have permission to access this emergency alert.", "danger")
        return redirect(url_for("emergency_alert.emergency_list"))

    if scope.is_scoped:
        patients = Patient.query.filter(
            Patient.status == "active",
            Patient.id.in_(scope.patient_ids)
        ).all()
        rings = HealthRing.query.filter(
            HealthRing.status == "active",
            HealthRing.patient_id.in_(scope.patient_ids)
        ).all()
    else:
        patients = Patient.query.filter_by(
            status="active"
        ).all()
        rings = HealthRing.query.filter_by(
            status="active"
        ).all()

    if request.method == "POST":
        patient_id = request.form.get("patient_id")
        ring_id = request.form.get("ring_id") or None

        if scope.is_scoped:
            if not patient_id or patient_id not in scope.patient_ids_set:
                flash("Access denied. Invalid patient selected for your hospital.", "danger")
                return redirect(url_for("emergency_alert.emergency_list"))
            if ring_id:
                ring = HealthRing.query.get(ring_id)
                if not ring or not scope.can_access_ring(ring):
                    flash("Access denied. Invalid ring selected for your hospital.", "danger")
                    return redirect(url_for("emergency_alert.emergency_list"))

        alert.patient_id = patient_id
        alert.ring_id = ring_id
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
    scope = get_hospital_scope()
    alert = EmergencyAlert.query.get_or_404(id)

    if not scope.can_access_alert(alert):
        flash("Access denied. You do not have permission to delete this emergency alert.", "danger")
        return redirect(url_for("emergency_alert.emergency_list"))

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