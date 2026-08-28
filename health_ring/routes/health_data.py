from datetime import datetime, date

from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash
)

from database import db
from models import Patient, HealthRing, HealthData
from flask import session, abort
from models import Doctor


health_data_bp = Blueprint(
    "health_data",
    __name__,
    url_prefix="/health-data"
)


# ==========================================================
# Helpers
# ==========================================================

def _parse_datetime(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M")
    except ValueError:
        return None


def _to_float_or_none(value):
    return value if value not in (None, "") else None


# ==========================================================
# Health Data List
# ==========================================================

@health_data_bp.route("/")
def health_data_list():

    health_data_records = HealthData.query.order_by(
        HealthData.recorded_at.desc()
    ).all()

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    rings = HealthRing.query.filter_by(
        status="active"
    ).all()

    # Extra context used only by the "Today's Records" stat card —
    # the core CRUD contract of health_data_records / patients / rings
    # is unchanged.
    today_count = sum(
        1 for record in health_data_records
        if record.recorded_at and record.recorded_at.date() == date.today()
    )

    return render_template(
        "health_data/health_data_list.html",
        health_data_records=health_data_records,
        patients=patients,
        rings=rings,
        today_count=today_count
    )

# ==========================================================
# Add Health Data
# ==========================================================

@health_data_bp.route("/add", methods=["GET", "POST"])
def health_data_add():

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    rings = HealthRing.query.filter_by(
        status="active"
    ).all()

    if request.method == "POST":

        record = HealthData(
            patient_id=request.form["patient_id"],
            ring_id=request.form.get("ring_id") or None,
            heart_rate=_to_float_or_none(request.form.get("heart_rate")),
            spo2=_to_float_or_none(request.form.get("spo2")),
            body_temperature=_to_float_or_none(request.form.get("body_temperature")),
            stress_level=_to_float_or_none(request.form.get("stress_level")),
            sleep_hours=_to_float_or_none(request.form.get("sleep_hours")),
            steps=_to_float_or_none(request.form.get("steps")),
            calories=_to_float_or_none(request.form.get("calories")),
            distance=_to_float_or_none(request.form.get("distance")),
            heart_rate_variability=_to_float_or_none(request.form.get("heart_rate_variability")),
            respiratory_rate=_to_float_or_none(request.form.get("respiratory_rate")),
            blood_pressure_systolic=_to_float_or_none(request.form.get("blood_pressure_systolic")),
            blood_pressure_diastolic=_to_float_or_none(request.form.get("blood_pressure_diastolic")),
            recorded_at=_parse_datetime(request.form.get("recorded_at")) or datetime.utcnow()
        )

        db.session.add(record)
        db.session.commit()

        flash(
            "Health data added successfully.",
            "success"
        )

        return redirect(
            url_for("health_data.health_data_list")
        )

    return render_template(
        "health_data/health_data_add.html",
        patients=patients,
        rings=rings
    )
# ==========================================================
# Edit Health Data
# ==========================================================

@health_data_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def health_data_edit(id):

    record = HealthData.query.get_or_404(id)

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    rings = HealthRing.query.filter_by(
        status="active"
    ).all()

    if request.method == "POST":

        record.patient_id = request.form["patient_id"]
        record.ring_id = request.form.get("ring_id") or None
        record.heart_rate = _to_float_or_none(request.form.get("heart_rate"))
        record.spo2 = _to_float_or_none(request.form.get("spo2"))
        record.body_temperature = _to_float_or_none(request.form.get("body_temperature"))
        record.stress_level = _to_float_or_none(request.form.get("stress_level"))
        record.sleep_hours = _to_float_or_none(request.form.get("sleep_hours"))
        record.steps = _to_float_or_none(request.form.get("steps"))
        record.calories = _to_float_or_none(request.form.get("calories"))
        record.distance = _to_float_or_none(request.form.get("distance"))
        record.heart_rate_variability = _to_float_or_none(request.form.get("heart_rate_variability"))
        record.respiratory_rate = _to_float_or_none(request.form.get("respiratory_rate"))
        record.blood_pressure_systolic = _to_float_or_none(request.form.get("blood_pressure_systolic"))
        record.blood_pressure_diastolic = _to_float_or_none(request.form.get("blood_pressure_diastolic"))
        record.recorded_at = _parse_datetime(request.form.get("recorded_at")) or record.recorded_at

        db.session.commit()

        flash("Health data updated successfully.", "success")

        return redirect(url_for("health_data.health_data_list"))

    return render_template(
        "health_data/health_data_edit.html",
        record=record,
        patients=patients,
        rings=rings
    )
# ==========================================================
# Delete Health Data
# ==========================================================

@health_data_bp.route("/delete/<string:id>", methods=["POST"])
def health_data_delete(id):

    record = HealthData.query.get_or_404(id)

    db.session.delete(record)
    db.session.commit()

    flash("Health data deleted successfully.", "success")

    return redirect(url_for("health_data.health_data_list"))

# ==========================================================
# Doctor Live Health Monitoring
# ==========================================================

@health_data_bp.route("/doctor")
def doctor_live_monitoring():

    # ---------------- Login Check ----------------

    if "user" not in session:
        return redirect(url_for("pages.login"))

    # ---------------- Role Check ----------------

    if session["user"]["role"] != "doctor":
        abort(403)

    # ---------------- Current Doctor ----------------

    doctor = Doctor.query.filter_by(
        user_id=session["user"]["id"]
    ).first_or_404()

    # ---------------- Health Data ----------------

    health_data_records = (
        HealthData.query
        .join(Patient)
        .filter(Patient.assigned_doctor_id == doctor.id)
        .order_by(HealthData.recorded_at.desc())
        .all()
    )

    # ---------------- Statistics ----------------

    total_patients = len({
        record.patient_id
        for record in health_data_records
    })

    healthy_count = sum(
        1 for record in health_data_records
        if (
            record.heart_rate
            and 60 <= record.heart_rate <= 100
            and record.spo2
            and record.spo2 >= 95
        )
    )

    warning_count = sum(
        1 for record in health_data_records
        if (
            (record.heart_rate and (record.heart_rate < 60 or record.heart_rate > 100))
            or
            (record.spo2 and record.spo2 < 95)
        )
    )

    return render_template(
        "doctor/doctor_live_monitoring.html",
        doctor=doctor,
        health_data_records=health_data_records,
        total_patients=total_patients,
        healthy_count=healthy_count,
        warning_count=warning_count
    )