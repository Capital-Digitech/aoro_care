
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
from models import (
    Patient,
    HealthRing,
    EmergencyAlert,
    Doctor,
)
from utils import get_hospital_scope


emergency_alert_bp = Blueprint(
    "emergency_alert",
    __name__,
    url_prefix="/emergency-alert",
)


# ==========================================================
# Helpers
# ==========================================================

def _to_float_or_none(value):
    return value if value not in (None, "") else None


def _get_form_data(scope):
    """Return active patients and rings permitted by hospital scope."""

    patients = scope.filter_patients(
        Patient.query.filter_by(status="active")
    ).all()

    rings = scope.filter_rings(
        HealthRing.query.filter_by(status="active")
    ).all()

    return patients, rings


def _validate_alert_selection(scope, patient_id, ring_id):
    """Validate patient and optional ring against the user's scope."""

    patient = Patient.query.get(patient_id) if patient_id else None

    if not patient or patient.status != "active":
        return False, "Please select a valid active patient."

    if not scope.can_access_patient(patient):
        return False, "Access denied. Invalid patient selected for your hospital."

    if ring_id:
        ring = HealthRing.query.get(ring_id)

        if not ring or ring.status != "active":
            return False, "Please select a valid active health ring."

        if ring.patient_id != patient.id:
            return False, "The selected health ring does not belong to this patient."

        if not scope.can_access_ring(ring):
            return False, "Access denied. Invalid ring selected for your hospital."

    return True, None


# ==========================================================
# Emergency Alert List
# Keep endpoint name for existing sidebar links.
# ==========================================================

@emergency_alert_bp.route("/", endpoint="emergency_list")
def alert_list():
    scope = get_hospital_scope()

    alerts = scope.filter_alerts(
        EmergencyAlert.query
    ).order_by(
        EmergencyAlert.created_at.desc()
    ).all()

    patients, rings = _get_form_data(scope)

    return render_template(
        "emergency_alert/emergency_alert_list.html",
        alerts=alerts,
        patients=patients,
        rings=rings,
    )


# ==========================================================
# Add Emergency Alert
# ==========================================================

@emergency_alert_bp.route("/add", methods=["GET", "POST"])
def alert_add():
    scope = get_hospital_scope()

    if scope.unassigned:
        flash(
            "Access denied. Please contact system administrator "
            "to assign a hospital.",
            "danger",
        )
        return redirect(url_for("emergency_alert.emergency_list"))

    patients, rings = _get_form_data(scope)

    if request.method == "POST":
        patient_id = request.form.get("patient_id")
        ring_id = request.form.get("ring_id") or None

        valid, error_message = _validate_alert_selection(
            scope,
            patient_id,
            ring_id,
        )

        if not valid:
            flash(error_message, "danger")
            return redirect(url_for("emergency_alert.alert_add"))

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
            status=request.form.get("status") or "active",
        )

        try:
            db.session.add(alert)
            db.session.commit()
        except Exception:
            db.session.rollback()
            flash("Unable to add the emergency alert. Please try again.", "danger")
            return redirect(url_for("emergency_alert.alert_add"))

        flash("Emergency alert added successfully.", "success")
        return redirect(url_for("emergency_alert.emergency_list"))

    return render_template(
        "emergency_alert/emergency_alert_add.html",
        patients=patients,
        rings=rings,
    )


# ==========================================================
# Edit Emergency Alert
# ==========================================================

@emergency_alert_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def alert_edit(id):
    scope = get_hospital_scope()
    alert = EmergencyAlert.query.get_or_404(id)

    if not scope.can_access_alert(alert):
        flash(
            "Access denied. You do not have permission to access this emergency alert.",
            "danger",
        )
        return redirect(url_for("emergency_alert.emergency_list"))

    if scope.unassigned:
        flash(
            "Access denied. Please contact system administrator "
            "to assign a hospital.",
            "danger",
        )
        return redirect(url_for("emergency_alert.emergency_list"))

    patients, rings = _get_form_data(scope)

    if request.method == "POST":
        patient_id = request.form.get("patient_id")
        ring_id = request.form.get("ring_id") or None

        valid, error_message = _validate_alert_selection(
            scope,
            patient_id,
            ring_id,
        )

        if not valid:
            flash(error_message, "danger")
            return redirect(url_for("emergency_alert.alert_edit", id=id))

        alert.patient_id = patient_id
        alert.ring_id = ring_id
        alert.alert_type = request.form.get("alert_type")
        alert.severity = request.form.get("severity")
        alert.heart_rate = _to_float_or_none(request.form.get("heart_rate"))
        alert.spo2 = _to_float_or_none(request.form.get("spo2"))
        alert.message = request.form.get("message")
        alert.latitude = _to_float_or_none(request.form.get("latitude"))
        alert.longitude = _to_float_or_none(request.form.get("longitude"))
        alert.status = request.form.get("status") or alert.status

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            flash("Unable to update the emergency alert. Please try again.", "danger")
            return redirect(url_for("emergency_alert.alert_edit", id=id))

        flash("Emergency alert updated successfully.", "success")
        return redirect(url_for("emergency_alert.emergency_list"))

    return render_template(
        "emergency_alert/emergency_alert_edit.html",
        alert=alert,
        patients=patients,
        rings=rings,
    )


# ==========================================================
# Delete Emergency Alert
# ==========================================================

@emergency_alert_bp.route("/delete/<string:id>", methods=["POST"])
def alert_delete(id):
    scope = get_hospital_scope()
    alert = EmergencyAlert.query.get_or_404(id)

    if not scope.can_access_alert(alert):
        flash(
            "Access denied. You do not have permission to delete this emergency alert.",
            "danger",
        )
        return redirect(url_for("emergency_alert.emergency_list"))

    try:
        db.session.delete(alert)
        db.session.commit()
    except Exception:
        db.session.rollback()
        flash("Unable to delete the emergency alert. Please try again.", "danger")
        return redirect(url_for("emergency_alert.emergency_list"))

    flash("Emergency alert deleted successfully.", "success")
    return redirect(url_for("emergency_alert.emergency_list"))


# ==========================================================
# Doctor Emergency Alert List
# ==========================================================

@emergency_alert_bp.route("/doctor")
def doctor_emergency_alert_list():
    if "user" not in session:
        return redirect(url_for("pages.login"))

    session_user = session.get("user") or {}

    if session_user.get("role") != "doctor":
        abort(403)

    doctor = Doctor.query.filter_by(
        user_id=session_user.get("id")
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
        alerts=alerts,
    )
