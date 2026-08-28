from flask import (
    Blueprint,
    render_template,
    session,
    redirect,
    url_for
)

from models import (
    User,
    Doctor,
    Patient,
    HealthData,
    Hospital,
    HealthRing,
    Appointment,
    Report,
    EmergencyAlert,
    Notification

)
from datetime import datetime
from flask import session, render_template, redirect, url_for
from models import User, Doctor
pages_bp = Blueprint("pages", __name__)

# ==========================================================
# COMMON PATIENT HELPER
# ==========================================================

def get_current_patient():

    # User must be logged in
    if "user" not in session:
        return None, None

    # Only patient can access patient pages
    if session["user"]["role"] != "patient":
        return None, None

    user = User.query.get(session["user"]["id"])

    if not user:
        return None, None

    patient = Patient.query.filter_by(
        user_id=user.id
    ).first()

    if not patient:
        return None, None

    return user, patient

@pages_bp.route("/")
def index():
    return redirect(url_for("pages.login"))


@pages_bp.route("/login")
def login():
    return render_template("auth/login.html")


@pages_bp.route("/create-account")
def create_account():
    return render_template("auth/create_account.html")


@pages_bp.route("/forgot-password")
def forgot_password():
    return render_template("auth/forgot_password.html")


@pages_bp.route("/dashboard")
def dashboard():
    user = session.get("user")
    if not user:
        return redirect(url_for("pages.login"))
    return render_template("dashboard_placeholder.html", user=user)


@pages_bp.route("/patient-dashboard")
def patient_dashboard():

    # Get logged-in patient
    user, patient = get_current_patient()

    if not patient:
        return redirect(url_for("pages.login"))

    # ==========================================
    # Latest Health Data
    # ==========================================
    latest_health = (
        HealthData.query
        .filter_by(patient_id=patient.id)
        .order_by(HealthData.recorded_at.desc())
        .first()
    )

    # ==========================================
    # Health Ring
    # ==========================================
    health_ring = patient.rings[0] if patient.rings else None

    # ==========================================
    # Assigned Doctor
    # ==========================================
    doctor = patient.doctor

    # ==========================================
    # Upcoming Appointment
    # ==========================================
    next_appointment = (
        Appointment.query
        .filter_by(
            patient_id=patient.id,
            status="scheduled"
        )
        .order_by(
            Appointment.appointment_date.asc(),
            Appointment.appointment_time.asc()
        )
        .first()
    )

    # ==========================================
    # Latest Notifications
    # ==========================================
    notifications = (
        Notification.query
        .filter_by(user_id=user.id)
        .order_by(Notification.created_at.desc())
        .limit(3)
        .all()
    )

    # ==========================================
    # Dashboard
    # ==========================================
    return render_template(
        "dashboard/patient_dashboard.html",
        user=user,
        patient=patient,
        latest_health=latest_health,
        health_ring=health_ring,
        doctor=doctor,
        next_appointment=next_appointment,
        notifications=notifications
    )
# ==========================================================
# PATIENT PAGES
# ==========================================================

@pages_bp.route("/my-health")
def my_health():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])

    if not user:
        return redirect(url_for("pages.login"))

    patient = Patient.query.filter_by(
        user_id=user.id
    ).first()

    if not patient:
        return redirect(url_for("pages.login"))

    latest_health = (
        HealthData.query
        .filter_by(patient_id=patient.id)
        .order_by(HealthData.recorded_at.desc())
        .first()
    )

    doctor = None

    if patient.assigned_doctor_id:
        doctor = Doctor.query.filter_by(
            id=patient.assigned_doctor_id
        ).first()

    return render_template(
        "patient_portal/my_health.html",
        patient=patient,
        latest_health=latest_health,
        doctor=doctor,
        active_page="my_health"
    )


@pages_bp.route("/health-ring")
def health_ring():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])
    patient = Patient.query.filter_by(user_id=user.id).first()

    return render_template(
        "patient_portal/health_ring.html",
        patient=patient,
        active_page="health_ring"
    )


@pages_bp.route("/appointments")
def patient_appointments():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])
    patient = Patient.query.filter_by(user_id=user.id).first()

    appointments = Appointment.query.filter_by(
        patient_id=patient.id
    ).all()

    return render_template(
        "patient_portal/appointments.html",
        patient=patient,
        appointments=appointments,
        active_page="appointments"
    )


@pages_bp.route("/medical-reports")
def medical_reports():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])
    patient = Patient.query.filter_by(user_id=user.id).first()

    reports = Report.query.filter_by(
        patient_id=patient.id
    ).all()

    return render_template(
        "patient_portal/medical_reports.html",
        patient=patient,
        reports=reports,
        active_page="medical_reports"
    )


@pages_bp.route("/prescriptions")
def prescriptions():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])
    patient = Patient.query.filter_by(user_id=user.id).first()

    return render_template(
        "patient_portal/prescriptions.html",
        patient=patient,
        active_page="prescriptions"
    )


@pages_bp.route("/health-trends")
def health_trends():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])
    patient = Patient.query.filter_by(user_id=user.id).first()

    return render_template(
        "patient_portal/health_trends.html",
        patient=patient,
        active_page="health_trends"
    )


@pages_bp.route("/emergency-sos")
def emergency_sos():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])
    patient = Patient.query.filter_by(user_id=user.id).first()

    return render_template(
        "patient_portal/emergency_sos.html",
        patient=patient,
        active_page="emergency_sos"
    )


@pages_bp.route("/ai-health-insights")
def ai_health_insights():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])
    patient = Patient.query.filter_by(user_id=user.id).first()

    return render_template(
        "patient_portal/ai_health_insights.html",
        patient=patient,
        active_page="ai_health_insights"
    )


@pages_bp.route("/notifications")
def notifications():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])
    patient = Patient.query.filter_by(user_id=user.id).first()

    return render_template(
        "patient_portal/notifications.html",
        patient=patient,
        active_page="notifications"
    )


@pages_bp.route("/settings")
def settings():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])
    patient = Patient.query.filter_by(user_id=user.id).first()

    return render_template(
        "patient_portal/settings.html",
        patient=patient,
        active_page="settings"
    )
# ==========================================================
# DOCTOR DASHBOARD
# ==========================================================
@pages_bp.route("/doctor-dashboard")
def doctor_dashboard():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    if session["user"]["role"] != "doctor":
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])

    if not user:
        return redirect(url_for("pages.login"))

    doctor = Doctor.query.filter_by(user_id=user.id).first()

    if not doctor:
        return redirect(url_for("pages.login"))

    # Patients assigned to this doctor
    patients = (
        Patient.query
        .filter_by(
            assigned_doctor_id=doctor.id,
            status="active"
        )
        .all()
    )

    # Latest Health Data
    for patient in patients:
        latest = (
            HealthData.query
            .filter_by(patient_id=patient.id)
            .order_by(HealthData.recorded_at.desc())
            .first()
        )

        patient.latest_health = latest

    total_patients = len(patients)

    return render_template(
        "dashboard/doctor_dashboard.html",
        user=user,
        doctor=doctor,
        patients=patients,
        total_patients=total_patients,
        now=datetime.utcnow
    )


@pages_bp.route("/doctor-my-patients")
def doctor_my_patients():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    if session["user"]["role"] != "doctor":
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])

    if not user:
        return redirect(url_for("pages.login"))

    doctor = Doctor.query.filter_by(user_id=user.id).first()

    if not doctor:
        return redirect(url_for("pages.login"))

    print("\n========== DOCTOR MY PATIENTS ==========")
    print("Session:", session["user"])
    print("User ID:", user.id)
    print("Doctor ID:", doctor.id)
    print("Doctor User ID:", doctor.user_id)

    patients = Patient.query.filter_by(
        assigned_doctor_id=doctor.id,
        status="active"
    ).all()

    print("Patients Found:", len(patients))

    for p in patients:
        print(
            p.patient_code,
            p.assigned_doctor_id
        )

    connected_rings = 0
    critical_patients = 0

    for patient in patients:

        latest = (
            HealthData.query
            .filter_by(patient_id=patient.id)
            .order_by(HealthData.recorded_at.desc())
            .first()
        )

        patient.latest_health = latest
        patient.health_score = None

        if latest:
            connected_rings += 1

            score = 100

            if latest.heart_rate is not None:
                if latest.heart_rate > 110 or latest.heart_rate < 50:
                    score -= 20

            if latest.spo2 is not None:
                if latest.spo2 < 95:
                    score -= 20

            patient.health_score = max(score, 0)

            print(
                patient.patient_code,
                patient.health_score,
                latest.heart_rate,
                latest.spo2
            )

            if (
                (latest.heart_rate is not None and latest.heart_rate > 110)
                or
                (latest.spo2 is not None and latest.spo2 < 95)
            ):
                critical_patients += 1

    total_patients = len(patients)

    today_visits = Appointment.query.filter_by(
        doctor_id=doctor.id
    ).count()

    return render_template(
        "dashboard/doctor_my_patients.html",
        user=user,
        doctor=doctor,
        patients=patients,
        total_patients=total_patients,
        today_visits=today_visits,
        critical_patients=critical_patients,
        connected_rings=connected_rings,
        now=datetime.utcnow
    )

@pages_bp.route("/family-dashboard")
def family_dashboard():
    return render_template("dashboard/family_dashboard.html")


@pages_bp.route("/admin-dashboard")
def admin_dashboard():

    total_patients = Patient.query.count()
    total_doctors = Doctor.query.count()
    total_hospitals = Hospital.query.count()
    total_health_rings = HealthRing.query.count()
    total_appointments = Appointment.query.count()
    total_reports = Report.query.count()
    total_alerts = EmergencyAlert.query.count()

    return render_template(
        "dashboard/admin_dashboard.html",
        total_patients=total_patients,
        total_doctors=total_doctors,
        total_hospitals=total_hospitals,
        total_health_rings=total_health_rings,
        total_appointments=total_appointments,
        total_reports=total_reports,
        total_alerts=total_alerts
    )

@pages_bp.route("/super-admin-dashboard")
def super_admin_dashboard():
    return render_template("dashboard/super_admin_dashboard.html")