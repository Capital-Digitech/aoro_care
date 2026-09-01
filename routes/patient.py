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

from werkzeug.security import generate_password_hash

from database import db
from models import (
    User,
    Patient,
    Doctor,
    HealthData,
    HealthRing,
    Appointment,
    Report,
    Prescription,
    AIInsight,
    Notification
)


patient_bp = Blueprint(
    "patient",
    __name__,
    url_prefix="/patient"
)


# ==========================================================
# Patient List
# ==========================================================

@patient_bp.route("/")
def patient_list():

    patients = Patient.query.order_by(
        Patient.created_at.desc()
    ).all()

    doctors = Doctor.query.filter_by(
        status="active"
    ).all()

    return render_template(
        "patient/patient_list.html",
        patients=patients,
        doctors=doctors
    )

# ==========================================================
# Add Patient
# ==========================================================

@patient_bp.route("/add", methods=["GET", "POST"])
def patient_add():

    doctors = Doctor.query.filter_by(
        status="active"
    ).all()

    if request.method == "POST":

        # ---------------- User ----------------

        user = User(
            role="patient",
            first_name=request.form["first_name"],
            last_name=request.form["last_name"],
            email=request.form["email"],
            mobile=request.form.get("mobile"),
            gender=request.form.get("gender"),
            address=request.form.get("address"),
            is_verified=True
        )

        user.password_hash = generate_password_hash("Patient@123")

        db.session.add(user)
        db.session.flush()

        # ---------------- Patient ----------------

        patient = Patient(
            user_id=user.id,
            patient_code=request.form["patient_code"],
            blood_group=request.form.get("blood_group"),
            height=request.form.get("height") or None,
            weight=request.form.get("weight") or None,
            emergency_contact_name=request.form.get("emergency_contact_name"),
            emergency_contact_phone=request.form.get("emergency_contact_phone"),
            medical_history=request.form.get("medical_history"),
            allergies=request.form.get("allergies"),
            assigned_doctor_id=request.form.get("assigned_doctor_id") or None,
            status=request.form.get("status", "active")
        )

        db.session.add(patient)
        db.session.commit()

        flash(
            "Patient added successfully.",
            "success"
        )

        return redirect(
            url_for("patient.patient_list")
        )

    return render_template(
        "patient/patient_add.html",
        doctors=doctors
    )
# ==========================================================
# Edit Patient
# ==========================================================

@patient_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def edit_patient(id):

    patient = Patient.query.get_or_404(id)
    user = patient.user

    doctors = Doctor.query.filter_by(
        status="active"
    ).all()

    if request.method == "POST":

        # User Table
        user.first_name = request.form["first_name"]
        user.last_name = request.form["last_name"]
        user.email = request.form["email"]
        user.mobile = request.form.get("mobile")
        user.gender = request.form.get("gender")
        user.address = request.form.get("address")

        # Patient Table
        patient.patient_code = request.form["patient_code"]
        patient.blood_group = request.form.get("blood_group")
        patient.height = request.form.get("height") or None
        patient.weight = request.form.get("weight") or None
        patient.emergency_contact_name = request.form.get("emergency_contact_name")
        patient.emergency_contact_phone = request.form.get("emergency_contact_phone")
        patient.medical_history = request.form.get("medical_history")
        patient.allergies = request.form.get("allergies")
        patient.assigned_doctor_id = request.form.get("assigned_doctor_id") or None
        patient.status = request.form.get("status")

        db.session.commit()

        flash("Patient updated successfully.", "success")

        return redirect(url_for("patient.patient_list"))

    return render_template(
        "patient/edit_patient.html",
        patient=patient,
        doctors=doctors
    )
# ==========================================================
# Delete Patient
# ==========================================================

@patient_bp.route("/delete/<string:id>")
def patient_delete(id):

    patient = Patient.query.get_or_404(id)

    user = patient.user

    db.session.delete(patient)
    db.session.delete(user)

    db.session.commit()

    flash("Patient deleted successfully.", "success")

    return redirect(url_for("patient.patient_list"))
# ==========================================================
# Patient Dashboard
# ==========================================================

@patient_bp.route("/dashboard")
def dashboard():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    if session["user"]["role"] != "patient":
        abort(403)

    patient = Patient.query.filter_by(
        user_id=session["user"]["id"]
    ).first()

    if patient is None:
        abort(404)

    latest_health = HealthData.query.filter_by(
        patient_id=patient.id
    ).order_by(
        HealthData.recorded_at.desc()
    ).first()

    health_history = HealthData.query.filter_by(
      patient_id=patient.id
    ).order_by(
      HealthData.recorded_at.desc()
    ).limit(30).all()
    
    ring = HealthRing.query.filter_by(
        patient_id=patient.id
    ).first()

    notifications = Notification.query.filter_by(
      user_id=session["user"]["id"]
    ).order_by(
      Notification.created_at.desc()
    ).all()
    
    appointments = Appointment.query.filter_by(
        patient_id=patient.id
    ).order_by(
        Appointment.appointment_date.asc(),
        Appointment.appointment_time.asc()
    ).all()

    reports = Report.query.filter_by(
      patient_id=patient.id
    ).order_by(
      Report.generated_at.desc()
    ).all()

    prescriptions = Prescription.query.filter_by(
      patient_id=patient.id
    ).all()

    ai_insights = AIInsight.query.filter_by(
      patient_id=patient.id
    ).order_by(
      AIInsight.created_at.desc()
    ).all()
    
    return render_template(
        "patient/patient_dashboard.html",
        patient=patient,
        latest_health=latest_health,
        ring=ring,
        appointments=appointments,
        reports=reports,
        prescriptions=prescriptions,
        ai_insights=ai_insights,
        notifications=notifications
    )