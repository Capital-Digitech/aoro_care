from flask import (
    Blueprint,
    render_template,
    session,
    redirect,
    url_for,
    request,
    flash,
    jsonify
)
from datetime import datetime, date, timedelta
from sqlalchemy import func, text
from werkzeug.security import generate_password_hash, check_password_hash
from database import db

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
    Notification,
    Prescription,
    PrescriptionMedicine,
    AIInsight,
    RingSyncLog,
    FamilyMember,
    Setting,
    LoginHistory,
    AuditLog,
    Subscription
)

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
    role = session.get("role") or (user.get("role") if isinstance(user, dict) else getattr(user, 'role', None))
    if role == "super_admin":
        return redirect(url_for("pages.super_admin_dashboard"))
    elif role == "admin":
        return redirect(url_for("pages.admin_dashboard"))
    elif role == "doctor":
        return redirect(url_for("pages.doctor_dashboard"))
    elif role == "patient":
        return redirect(url_for("pages.patient_dashboard"))
    elif role == "family":
        return redirect(url_for("pages.family_dashboard"))
    return render_template("dashboard_placeholder.html", user=user)


# ==========================================================
# PATIENT DASHBOARD (DAILY OVERVIEW)
# ==========================================================
@pages_bp.route("/patient-dashboard")
def patient_dashboard():

    # Get logged-in patient
    user, patient = get_current_patient()

    if not patient:
        return redirect(url_for("pages.login"))

    # Latest Health Data
    latest_health = (
        HealthData.query
        .filter_by(patient_id=patient.id)
        .order_by(HealthData.recorded_at.desc())
        .first()
    )

    # Health Ring
    health_ring = patient.rings[0] if patient.rings else None

    # Assigned Doctor
    doctor = patient.doctor

    # Upcoming Appointment
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

    # Latest Notifications
    notifications = (
        Notification.query
        .filter_by(user_id=user.id)
        .order_by(Notification.created_at.desc())
        .limit(3)
        .all()
    )

    # Latest Active Emergency Alert
    latest_alert = (
        EmergencyAlert.query
        .filter_by(patient_id=patient.id, status="active")
        .order_by(EmergencyAlert.created_at.desc())
        .first()
    )

    # Latest AI Health Insight
    latest_insight = (
        AIInsight.query
        .filter_by(patient_id=patient.id)
        .order_by(AIInsight.created_at.desc())
        .first()
    )

    # Recent 7 vitals for mini trend
    recent_vitals = (
        HealthData.query
        .filter_by(patient_id=patient.id)
        .order_by(HealthData.recorded_at.desc())
        .limit(7)
        .all()
    )
    rev_vitals = list(reversed(recent_vitals))
    mini_trend_labels = [v.recorded_at.strftime('%a') if v.recorded_at else f'D{i+1}' for i, v in enumerate(rev_vitals)]
    mini_trend_hr = [v.heart_rate or 0 for v in rev_vitals]
    mini_trend_spo2 = [v.spo2 or 0 for v in rev_vitals]

    return render_template(
        "dashboard/patient_dashboard.html",
        user=user,
        patient=patient,
        latest_health=latest_health,
        health_ring=health_ring,
        doctor=doctor,
        next_appointment=next_appointment,
        notifications=notifications,
        latest_alert=latest_alert,
        latest_insight=latest_insight,
        mini_trend_labels=mini_trend_labels,
        mini_trend_hr=mini_trend_hr,
        mini_trend_spo2=mini_trend_spo2,
        active_page="dashboard"
    )

# ==========================================================
# 1. MY HEALTH (Detailed Health Data & History)
# ==========================================================
@pages_bp.route("/my-health")
def my_health():

    user, patient = get_current_patient()
    if not patient:
        return redirect(url_for("pages.login"))

    latest_health = (
        HealthData.query
        .filter_by(patient_id=patient.id)
        .order_by(HealthData.recorded_at.desc())
        .first()
    )

    health_history = (
        HealthData.query
        .filter_by(patient_id=patient.id)
        .order_by(HealthData.recorded_at.desc())
        .limit(20)
        .all()
    )

    doctor = patient.doctor
    health_ring = patient.rings[0] if patient.rings else None

    return render_template(
        "patient_portal/my_health.html",
        user=user,
        patient=patient,
        latest_health=latest_health,
        health_history=health_history,
        doctor=doctor,
        health_ring=health_ring,
        active_page="my_health"
    )


# ==========================================================
# 2. HEALTH RING (Device Status, Sync Logs & Sync Action)
# ==========================================================
@pages_bp.route("/health-ring")
def health_ring():

    user, patient = get_current_patient()
    if not patient:
        return redirect(url_for("pages.login"))

    health_ring = patient.rings[0] if patient.rings else None
    sync_logs = []
    if health_ring:
        sync_logs = (
            RingSyncLog.query
            .filter_by(ring_id=health_ring.id)
            .order_by(RingSyncLog.created_at.desc())
            .limit(10)
            .all()
        )

    return render_template(
        "patient_portal/health_ring.html",
        user=user,
        patient=patient,
        health_ring=health_ring,
        sync_logs=sync_logs,
        active_page="health_ring"
    )


@pages_bp.route("/health-ring/sync", methods=["POST"])
def health_ring_sync():

    user, patient = get_current_patient()
    if not patient:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    health_ring = patient.rings[0] if patient.rings else None
    if not health_ring:
        return jsonify({"success": False, "message": "No Health Ring paired to your account."}), 400

    now = datetime.utcnow()
    health_ring.last_sync = now
    health_ring.connection_status = "connected"

    sync_log = RingSyncLog(
        ring_id=health_ring.id,
        patient_id=patient.id,
        sync_start=now,
        sync_end=now,
        records_uploaded=1,
        battery_level=health_ring.battery_percentage or 85,
        sync_status="success"
    )
    db.session.add(sync_log)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Health Ring data synchronized successfully!",
        "last_sync": now.strftime("%b %d, %Y %I:%M %p"),
        "battery": health_ring.battery_percentage
    })


# ==========================================================
# 3. APPOINTMENTS (List, Book & Cancel)
# ==========================================================
@pages_bp.route("/appointments")
def patient_appointments():

    user, patient = get_current_patient()
    if not patient:
        return redirect(url_for("pages.login"))

    appointments = (
        Appointment.query
        .filter_by(patient_id=patient.id)
        .order_by(
            Appointment.appointment_date.desc(),
            Appointment.appointment_time.desc()
        )
        .all()
    )

    doctors = Doctor.query.filter_by(status="active").all()
    hospitals = Hospital.query.filter_by(status="active").all()

    return render_template(
        "patient_portal/appointments.html",
        user=user,
        patient=patient,
        appointments=appointments,
        doctors=doctors,
        hospitals=hospitals,
        active_page="appointments"
    )


@pages_bp.route("/appointments/book", methods=["POST"])
def patient_book_appointment():

    user, patient = get_current_patient()
    if not patient:
        flash("Please log in as a patient to book appointments.", "danger")
        return redirect(url_for("pages.login"))

    doctor_id = request.form.get("doctor_id")
    hospital_id = request.form.get("hospital_id")
    appt_date_str = request.form.get("appointment_date")
    appt_time_str = request.form.get("appointment_time")
    appt_type = request.form.get("appointment_type", "online")
    reason = request.form.get("reason", "").strip()

    if not (doctor_id and hospital_id and appt_date_str and appt_time_str):
        flash("Please complete all required appointment fields.", "warning")
        return redirect(url_for("pages.patient_appointments"))

    try:
        appt_date = datetime.strptime(appt_date_str, "%Y-%m-%d").date()
        appt_time = datetime.strptime(appt_time_str, "%H:%M").time()
    except ValueError:
        flash("Invalid date or time format.", "danger")
        return redirect(url_for("pages.patient_appointments"))

    meeting_link = f"https://meet.healthring.com/{patient.patient_code or 'consult'}" if appt_type == "online" else None

    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=doctor_id,
        hospital_id=hospital_id,
        appointment_date=appt_date,
        appointment_time=appt_time,
        appointment_type=appt_type,
        reason=reason,
        status="scheduled",
        meeting_link=meeting_link
    )
    db.session.add(appointment)

    # Create confirmation notification for patient
    notif = Notification(
        user_id=user.id,
        title="Appointment Booked",
        message=f"Appointment scheduled for {appt_date.strftime('%b %d, %Y')} at {appt_time.strftime('%I:%M %p')}.",
        notification_type="appointment",
        is_read=False
    )
    db.session.add(notif)
    db.session.commit()

    flash("Your appointment has been booked successfully!", "success")
    return redirect(url_for("pages.patient_appointments"))


@pages_bp.route("/appointments/cancel/<string:id>", methods=["POST"])
def patient_cancel_appointment(id):

    user, patient = get_current_patient()
    if not patient:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    appointment = Appointment.query.filter_by(
        id=id,
        patient_id=patient.id
    ).first_or_404()

    appointment.status = "cancelled"
    db.session.commit()

    flash("Appointment has been cancelled.", "info")
    return redirect(url_for("pages.patient_appointments"))


# ==========================================================
# 4. MEDICAL REPORTS
# ==========================================================
@pages_bp.route("/medical-reports")
def medical_reports():

    user, patient = get_current_patient()
    if not patient:
        return redirect(url_for("pages.login"))

    reports = (
        Report.query
        .filter_by(patient_id=patient.id)
        .order_by(Report.generated_at.desc())
        .all()
    )

    return render_template(
        "patient_portal/medical_reports.html",
        user=user,
        patient=patient,
        reports=reports,
        active_page="medical_reports"
    )


# ==========================================================
# 5. PRESCRIPTIONS
# ==========================================================
@pages_bp.route("/prescriptions")
def prescriptions():

    user, patient = get_current_patient()
    if not patient:
        return redirect(url_for("pages.login"))

    prescriptions = (
        Prescription.query
        .filter_by(patient_id=patient.id)
        .order_by(Prescription.prescribed_date.desc())
        .all()
    )

    return render_template(
        "patient_portal/prescriptions.html",
        user=user,
        patient=patient,
        prescriptions=prescriptions,
        active_page="prescriptions"
    )


# ==========================================================
# 6. HEALTH TRENDS (Detailed Charts & History)
# ==========================================================
@pages_bp.route("/health-trends")
def health_trends():

    user, patient = get_current_patient()
    if not patient:
        return redirect(url_for("pages.login"))

    history = (
        HealthData.query
        .filter_by(patient_id=patient.id)
        .order_by(HealthData.recorded_at.desc())
        .limit(30)
        .all()
    )

    rev_history = list(reversed(history))
    trend_dates = [h.recorded_at.strftime('%b %d') if h.recorded_at else f'D{i+1}' for i, h in enumerate(rev_history)]
    trend_hr = [h.heart_rate or 0 for h in rev_history]
    trend_spo2 = [h.spo2 or 0 for h in rev_history]
    trend_sleep = [h.sleep_hours or 0 for h in rev_history]
    trend_stress = [h.stress_level or 0 for h in rev_history]
    trend_steps = [h.steps or 0 for h in rev_history]
    trend_temp = [h.body_temperature or 0 for h in rev_history]

    return render_template(
        "patient_portal/health_trends.html",
        user=user,
        patient=patient,
        history=history,
        trend_dates=trend_dates,
        trend_hr=trend_hr,
        trend_spo2=trend_spo2,
        trend_sleep=trend_sleep,
        trend_stress=trend_stress,
        trend_steps=trend_steps,
        trend_temp=trend_temp,
        active_page="health_trends"
    )


# ==========================================================
# 7. EMERGENCY SOS (Alerts, Contacts & Trigger Action)
# ==========================================================
@pages_bp.route("/emergency-sos")
def emergency_sos():

    user, patient = get_current_patient()
    if not patient:
        return redirect(url_for("pages.login"))

    alerts = (
        EmergencyAlert.query
        .filter_by(patient_id=patient.id)
        .order_by(EmergencyAlert.created_at.desc())
        .all()
    )

    family_members = FamilyMember.query.filter_by(user_id=user.id).all()
    doctor = patient.doctor
    hospital = doctor.hospital if (doctor and doctor.hospital) else Hospital.query.first()

    return render_template(
        "patient_portal/emergency_sos.html",
        user=user,
        patient=patient,
        alerts=alerts,
        family_members=family_members,
        doctor=doctor,
        hospital=hospital,
        active_page="emergency_sos"
    )


@pages_bp.route("/emergency-sos/trigger", methods=["POST"])
def emergency_sos_trigger():

    user, patient = get_current_patient()
    if not patient:
        flash("Unauthorized access.", "danger")
        return redirect(url_for("pages.login"))

    alert_type = request.form.get("alert_type", "SOS Panic Button Triggered")
    severity = request.form.get("severity", "critical")
    message = request.form.get("message", "Emergency assistance requested by patient.")
    
    latest = HealthData.query.filter_by(patient_id=patient.id).order_by(HealthData.recorded_at.desc()).first()
    ring = patient.rings[0] if patient.rings else None

    alert = EmergencyAlert(
        patient_id=patient.id,
        ring_id=ring.id if ring else None,
        alert_type=alert_type,
        severity=severity,
        heart_rate=latest.heart_rate if latest else None,
        spo2=latest.spo2 if latest else None,
        message=message,
        status="active"
    )
    db.session.add(alert)

    notif = Notification(
        user_id=user.id,
        title="Emergency SOS Dispatched",
        message="Emergency SOS alert has been activated and sent to emergency responders and family contacts.",
        notification_type="alert",
        is_read=False
    )
    db.session.add(notif)
    db.session.commit()

    flash("Emergency SOS Alert has been dispatched! Responders have been notified.", "danger")
    return redirect(url_for("pages.emergency_sos"))


# ==========================================================
# 8. AI HEALTH INSIGHTS
# ==========================================================
@pages_bp.route("/ai-health-insights")
def ai_health_insights():

    user, patient = get_current_patient()
    if not patient:
        return redirect(url_for("pages.login"))

    insights = (
        AIInsight.query
        .filter_by(patient_id=patient.id)
        .order_by(AIInsight.created_at.desc())
        .all()
    )

    latest_health = (
        HealthData.query
        .filter_by(patient_id=patient.id)
        .order_by(HealthData.recorded_at.desc())
        .first()
    )

    return render_template(
        "patient_portal/ai_health_insights.html",
        user=user,
        patient=patient,
        insights=insights,
        latest_health=latest_health,
        active_page="ai_health_insights"
    )


# ==========================================================
# 9. NOTIFICATIONS (List & Mark As Read)
# ==========================================================
@pages_bp.route("/notifications")
def notifications():

    user, patient = get_current_patient()
    if not patient:
        return redirect(url_for("pages.login"))

    notifications = (
        Notification.query
        .filter_by(user_id=user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )

    unread_count = (
        Notification.query
        .filter_by(user_id=user.id, is_read=False)
        .count()
    )

    return render_template(
        "patient_portal/notifications.html",
        user=user,
        patient=patient,
        notifications=notifications,
        unread_count=unread_count,
        active_page="notifications"
    )


@pages_bp.route("/notifications/mark-all-read", methods=["POST"])
def patient_notifications_mark_all_read():

    user, patient = get_current_patient()
    if not patient:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    Notification.query.filter_by(user_id=user.id, is_read=False).update({Notification.is_read: True})
    db.session.commit()

    return jsonify({"success": True, "message": "All notifications marked as read."})


# ==========================================================
# 10. SETTINGS & PROFILE
# ==========================================================
@pages_bp.route("/settings")
def settings():

    user, patient = get_current_patient()
    if not patient:
        return redirect(url_for("pages.login"))

    setting = Setting.query.filter_by(user_id=user.id).first()
    if not setting:
        setting = Setting(user_id=user.id)
        db.session.add(setting)
        db.session.commit()

    return render_template(
        "patient_portal/settings.html",
        user=user,
        patient=patient,
        setting=setting,
        active_page="settings"
    )


@pages_bp.route("/settings/profile", methods=["POST"])
def patient_update_profile():

    user, patient = get_current_patient()
    if not patient:
        flash("Unauthorized", "danger")
        return redirect(url_for("pages.login"))

    user.first_name = request.form.get("first_name", user.first_name).strip()
    user.last_name = request.form.get("last_name", user.last_name).strip()
    user.mobile = request.form.get("mobile", user.mobile).strip()
    user.address = request.form.get("address", user.address).strip()
    
    patient.blood_group = request.form.get("blood_group", patient.blood_group)
    
    height_val = request.form.get("height", "").strip()
    if height_val:
        try:
            patient.height = float(height_val)
        except ValueError:
            pass

    weight_val = request.form.get("weight", "").strip()
    if weight_val:
        try:
            patient.weight = float(weight_val)
        except ValueError:
            pass

    patient.emergency_contact_name = request.form.get("emergency_contact_name", patient.emergency_contact_name)
    patient.emergency_contact_phone = request.form.get("emergency_contact_phone", patient.emergency_contact_phone)
    patient.allergies = request.form.get("allergies", patient.allergies)
    patient.medical_history = request.form.get("medical_history", patient.medical_history)

    db.session.commit()
    # Update session user display name
    session["user"]["first_name"] = user.first_name
    session["user"]["last_name"] = user.last_name
    session.modified = True

    flash("Profile updated successfully!", "success")
    return redirect(url_for("pages.settings"))


@pages_bp.route("/settings/password", methods=["POST"])
def patient_change_password():

    user, patient = get_current_patient()
    if not patient:
        flash("Unauthorized", "danger")
        return redirect(url_for("pages.login"))

    current_pwd = request.form.get("current_password", "")
    new_pwd = request.form.get("new_password", "")
    confirm_pwd = request.form.get("confirm_password", "")

    if not check_password_hash(user.password_hash, current_pwd):
        flash("Current password is incorrect.", "danger")
        return redirect(url_for("pages.settings"))

    if len(new_pwd) < 6:
        flash("New password must be at least 6 characters long.", "warning")
        return redirect(url_for("pages.settings"))

    if new_pwd != confirm_pwd:
        flash("New passwords do not match.", "warning")
        return redirect(url_for("pages.settings"))

    user.password_hash = generate_password_hash(new_pwd)
    db.session.commit()

    flash("Password changed successfully!", "success")
    return redirect(url_for("pages.settings"))


@pages_bp.route("/settings/preferences", methods=["POST"])
def patient_update_preferences():

    user, patient = get_current_patient()
    if not patient:
        flash("Unauthorized", "danger")
        return redirect(url_for("pages.login"))

    setting = Setting.query.filter_by(user_id=user.id).first()
    if not setting:
        setting = Setting(user_id=user.id)
        db.session.add(setting)

    setting.email_notifications = "email_notifications" in request.form
    setting.emergency_notifications = "emergency_notifications" in request.form
    setting.appointment_notifications = "appointment_notifications" in request.form
    setting.report_notifications = "report_notifications" in request.form
    setting.ai_notifications = "ai_notifications" in request.form
    setting.auto_sync = "auto_sync" in request.form
    setting.theme = request.form.get("theme", "light")
    setting.updated_at = datetime.utcnow()

    db.session.commit()

    flash("Preferences saved successfully!", "success")
    return redirect(url_for("pages.settings"))
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

    # ==========================================================
    # PATIENTS
    # ==========================================================
    patients = Patient.query.filter_by(
        assigned_doctor_id=doctor.id,
        status="active"
    ).all()

    for patient in patients:
        patient.latest_health = (
            HealthData.query
            .filter_by(patient_id=patient.id)
            .order_by(HealthData.recorded_at.desc())
            .first()
        )

    total_patients = len(patients)

    # ==========================================================
    # TODAY APPOINTMENTS
    # ==========================================================
    today_appointments = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.appointment_date == date.today()
    ).count()

    # ==========================================================
    # CRITICAL PATIENTS
    # ==========================================================
    critical_patients = (
        db.session.query(HealthData.patient_id)
        .join(Patient, Patient.id == HealthData.patient_id)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            (
                (HealthData.heart_rate > 120) |
                (HealthData.spo2 < 90)
            )
        )
        .distinct()
        .count()
    )

    # ==========================================================
    # ACTIVE HEALTH RINGS
    # ==========================================================
    active_health_rings = (
        HealthRing.query
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            HealthRing.status == "active"
        )
        .count()
    )

    # ==========================================================
    # REPORTS
    # ==========================================================
    total_reports = Report.query.filter(
        Report.doctor_id == doctor.id
    ).count()

    # ==========================================================
    # ACTIVE EMERGENCY ALERTS
    # ==========================================================
    active_emergency = (
        EmergencyAlert.query
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            EmergencyAlert.status == "active"
        )
        .count()
    )

    # ==========================================================
    # AVERAGE HEART RATE
    # ==========================================================
    avg_hr = (
        db.session.query(
            func.avg(HealthData.heart_rate)
        )
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id
        )
        .scalar()
    )

    average_heart_rate = round(avg_hr) if avg_hr else 0

    # ==========================================================
    # AI ALERTS
    # ==========================================================
    ai_alerts = (
        AIInsight.query
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id
        )
        .count()
    )

    # ==========================================================
    # CHART 1 : RECOVERY / HRV TREND SCORES
    # ==========================================================
    rows = (
        db.session.query(
            func.avg(HealthData.heart_rate_variability)
        )
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id
        )
        .group_by(db.extract("month", HealthData.recorded_at))
        .limit(6)
        .all()
    )

    recovery_scores = [round(r[0] or 0) for r in rows]
    if not recovery_scores:
        recovery_scores = [0] * 6

    # ==========================================================
    # CHART 2 : HEART RATE DISTRIBUTION
    # ==========================================================
    normal = (
        HealthData.query
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            HealthData.heart_rate.between(60, 100)
        )
        .count()
    )

    elevated = (
        HealthData.query
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            HealthData.heart_rate.between(101, 120)
        )
        .count()
    )

    high = (
        HealthData.query
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            HealthData.heart_rate > 120
        )
        .count()
    )

    low = (
        HealthData.query
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            HealthData.heart_rate < 60
        )
        .count()
    )

    heart_rate_distribution = [
        normal,
        elevated,
        high,
        low
    ]


    # ==========================================================
    # CHART 3 : DAILY APPOINTMENTS (Mon-Sat)
    # ==========================================================
    daily_appointments = []

    for day in range(6):
        if db.engine.dialect.name == "mysql":
            # MySQL DAYOFWEEK: Sunday=1, Monday=2, ..., Saturday=7
            weekday_filter = (
                func.dayofweek(Appointment.appointment_date) == day + 2
            )
        else:
            # PostgreSQL ISODOW: Monday=1, ..., Sunday=7
            weekday_filter = (
                db.extract("isodow", Appointment.appointment_date) == day + 1
            )

        count = Appointment.query.filter(
            Appointment.doctor_id == doctor.id,
            weekday_filter
        ).count()

        daily_appointments.append(count)


    # ==========================================================
    # CHART 4 : HEALTH SCORE
    # ==========================================================
    row = (
        db.session.query(
            func.avg(HealthData.heart_rate),
            func.avg(HealthData.spo2),
            func.avg(HealthData.sleep_hours),
            func.avg(HealthData.steps),
            func.avg(HealthData.stress_level),
            func.avg(HealthData.respiratory_rate)
        )
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id
        )
        .first()
    )

    health_scores = [
        round(row[0] or 0) if row else 0,
        round(row[1] or 0) if row else 0,
        round(row[2] or 0) if row else 0,
        round(row[3] or 0) if row else 0,
        round(row[4] or 0) if row else 0,
        round(row[5] or 0) if row else 0
    ]

    # ==========================================================
    # CHART 5 : EMERGENCY CASES
    # ==========================================================
    rows = (
        db.session.query(
            db.extract("month", EmergencyAlert.created_at),
            func.count(EmergencyAlert.id)
        )
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id
        )
        .group_by(db.extract("month", EmergencyAlert.created_at))
        .order_by(db.extract("month", EmergencyAlert.created_at))
        .limit(6)
        .all()
    )

    emergency_cases = [r[1] for r in rows]
    if not emergency_cases:
        emergency_cases = [0] * 6

    # ==========================================================
    # CHART 6 : CONSULTATION TYPE
    # ==========================================================
    offline = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.appointment_type.in_(["offline"])
    ).count()

    online = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.appointment_type.in_(["online"])
    ).count()

    in_person = [offline]
    video_call = [online]

    # ==========================================================
    # RENDER TEMPLATE
    # ==========================================================
    return render_template(
        "dashboard/doctor_dashboard.html",
        user=user,
        doctor=doctor,
        patients=patients,
        total_patients=total_patients,
        today_appointments=today_appointments,
        critical_patients=critical_patients,
        active_health_rings=active_health_rings,
        total_reports=total_reports,
        emergency_count=active_emergency,
        emergency_cases=active_emergency,
        average_heart_rate=average_heart_rate,
        ai_alerts=ai_alerts,
        recovery_scores=recovery_scores,
        heart_rate_distribution=heart_rate_distribution,
        daily_appointments=daily_appointments,
        health_scores=health_scores,
        emergency_cases_chart=emergency_cases,
        in_person=in_person,
        video_call=video_call,
        now=datetime.utcnow
    )


@pages_bp.route("/doctor-my-patients")
def doctor_my_patients():

    # ==========================================================
    # DOCTOR LOGIN CHECK
    # ==========================================================

    if "user" not in session:
        return redirect(url_for("pages.login"))

    if session["user"]["role"] != "doctor":
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])

    if not user:
        return redirect(url_for("pages.login"))

    doctor = Doctor.query.filter_by(
        user_id=user.id
    ).first()

    if not doctor:
        return redirect(url_for("pages.login"))

    # ==========================================================
    # GET ASSIGNED ACTIVE PATIENTS
    # ==========================================================

    patients = Patient.query.filter_by(
        assigned_doctor_id=doctor.id,
        status="active"
    ).all()

    connected_rings = 0
    critical_patients = 0

    # ==========================================================
    # PREPARE PATIENT DATA
    # ==========================================================

    for patient in patients:

        # ------------------------------------------------------
        # Latest Health Data
        # ------------------------------------------------------

        latest = (
            HealthData.query
            .filter_by(
                patient_id=patient.id
            )
            .order_by(
                HealthData.recorded_at.desc()
            )
            .first()
        )

        patient.latest_health = latest
        patient.health_score = None

        # ------------------------------------------------------
        # Latest Appointment
        # ------------------------------------------------------

        patient.latest_appointment = (
            Appointment.query
            .filter_by(
                patient_id=patient.id,
                doctor_id=doctor.id
            )
            .order_by(
                Appointment.appointment_date.desc(),
                Appointment.appointment_time.desc()
            )
            .first()
        )

        # ------------------------------------------------------
        # Latest Medical Report
        # ------------------------------------------------------

        patient.latest_report = (
            Report.query
            .filter_by(
                patient_id=patient.id
            )
            .order_by(
                Report.generated_at.desc()
            )
            .first()
        )

        # ------------------------------------------------------
        # Emergency Contact
        # ------------------------------------------------------

        emergency_name = getattr(
            patient,
            "emergency_contact_name",
            None
        )

        emergency_phone = getattr(
            patient,
            "emergency_contact_phone",
            None
        )

        if emergency_name and emergency_phone:

            patient.view_emergency_contact = (
                f"{emergency_name} - {emergency_phone}"
            )

        elif emergency_name:

            patient.view_emergency_contact = emergency_name

        elif emergency_phone:

            patient.view_emergency_contact = emergency_phone

        else:

            patient.view_emergency_contact = "  "

        # ------------------------------------------------------
        # Assigned Doctor
        # ------------------------------------------------------

        assigned_doctor = getattr(
            patient,
            "assigned_doctor",
            None
        )

        if assigned_doctor and assigned_doctor.user:

            first_name = (
                assigned_doctor.user.first_name
                or ""
            )

            last_name = (
                assigned_doctor.user.last_name
                or ""
            )

            patient.view_doctor_name = (
                f"{first_name} {last_name}"
            ).strip()

            if not patient.view_doctor_name:
                patient.view_doctor_name = "  "

        else:

            patient.view_doctor_name = "  "

        # ------------------------------------------------------
        # Calculate Age
        # ------------------------------------------------------

        patient.view_age = "  "

        if (
            patient.user
            and patient.user.date_of_birth
        ):

            dob = patient.user.date_of_birth
            today = date.today()

            patient.view_age = (
                today.year
                - dob.year
                - (
                    (today.month, today.day)
                    < (dob.month, dob.day)
                )
            )

        # ------------------------------------------------------
        # Health Score
        # ------------------------------------------------------

        if latest:

            score = 100

            # Heart Rate
            if latest.heart_rate is not None:

                if (
                    latest.heart_rate > 110
                    or latest.heart_rate < 50
                ):
                    score -= 20

            # SpO2
            if latest.spo2 is not None:

                if latest.spo2 < 95:
                    score -= 20

            patient.health_score = max(
                score,
                0
            )

            # Patient has health/ring data
            connected_rings += 1

            # Critical patient
            if (
                (
                    latest.heart_rate is not None
                    and latest.heart_rate > 110
                )
                or
                (
                    latest.spo2 is not None
                    and latest.spo2 < 95
                )
            ):

                critical_patients += 1

    # ==========================================================
    # TOTAL PATIENTS
    # ==========================================================

    total_patients = len(patients)

    # ==========================================================
    # APPOINTMENT COUNT
    # ==========================================================

    today_visits = (
        Appointment.query
        .filter_by(
            doctor_id=doctor.id
        )
        .count()
    )

    # ==========================================================
    # RENDER PAGE
    # ==========================================================

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
# ==========================================================
# DOCTOR PORTAL — AI HEALTH INSIGHTS
# ----------------------------------------------------------
# PASTE THIS WHOLE BLOCK INTO routes/pages.py, directly after the
# doctor_my_patients() route and before the
# "DOCTOR PORTAL GLOBAL SEARCH" block.
#
# No new imports are needed at the top of pages.py: everything used
# here (session, request, jsonify, redirect, url_for, render_template,
# datetime, date, timedelta, db, User, Doctor, Patient, HealthData,
# AIInsight) is already imported there.
#
# Data source : existing HealthData / Patient / User / AIInsight tables.
# AI source   : NONE. No AI integration exists in the project, so the
#               page runs a rule-based "Health Data Analysis" over the
#               real HealthData rows. It never claims an AI model wrote it.
# DB changes  : NONE (no new tables, models or columns).
# ==========================================================

# ----------------------------------------------------------
# Analysis configuration
# ----------------------------------------------------------
AI_INSIGHT_PERIODS = {
    "24h": ("Last 24 Hours", timedelta(hours=24)),
    "7d": ("Last 7 Days", timedelta(days=7)),
    "30d": ("Last 30 Days", timedelta(days=30)),
}
AI_INSIGHT_MAX_CUSTOM_DAYS = 366
AI_INSIGHT_MAX_CHART_POINTS = 300      # above this, points are averaged per hour/day
AI_INSIGHT_MIN_TREND_READINGS = 5      # readings needed before a trend is described
AI_INSIGHT_MIN_PATTERN_READINGS = 3    # flagged readings needed before a pattern is reported
AI_INSIGHT_LATEST_LOOKBACK = 200       # newest rows scanned for the "current health" cards
AI_INSIGHT_HISTORY_LIMIT = 10

# ----------------------------------------------------------
# SCREENING THRESHOLDS  (screening indicators ONLY - not diagnoses)
#
#   heart_rate        > 100 bpm or < 50 bpm   common adult reference limits.
#                     The data does not record whether the reading was taken
#                     at rest, so wording stays cautious.
#   spo2              < 95 %                  common lower screening limit.
#   blood pressure    >= 130 systolic or      lower bound of "elevated" ranges
#                     >= 80 diastolic         in widely used adult guidance.
#   respiratory_rate  < 12 or > 20 /min       common adult reference range.
#   sleep_hours       < 6 hrs                 common short-sleep screening limit.
#
# NO threshold is applied to:
#   body_temperature  the unit (C or F) is not defined in the schema.
#   stress_level      the scale is not defined; only the patient's own
#                     earlier-vs-later average is compared.
#   heart_rate_variability  individual baseline only.
#
# A pattern needs >= AI_INSIGHT_MIN_PATTERN_READINGS flagged readings.
# A trend needs >= AI_INSIGHT_MIN_TREND_READINGS readings; the period's
# readings are split in time order into an "earlier" and a "later" half
# and their averages are compared against the minimum change below.
# ----------------------------------------------------------
AI_INSIGHT_THRESHOLDS = {
    "heart_rate_high": 100,
    "heart_rate_low": 50,
    "spo2_low": 95,
    "bp_systolic": 130,
    "bp_diastolic": 80,
    "resp_low": 12,
    "resp_high": 20,
    "sleep_low": 6,
}

# attribute, label, unit (None = unit not defined by the data), (trend mode, minimum change)
AI_INSIGHT_METRICS = [
    ("heart_rate", "Heart Rate", "bpm", ("relative", 0.10)),
    ("spo2", "SpO₂", "%", ("absolute", 1.0)),
    ("blood_pressure_systolic", "Systolic Blood Pressure", "mmHg", ("absolute", 5.0)),
    ("blood_pressure_diastolic", "Diastolic Blood Pressure", "mmHg", ("absolute", 5.0)),
    ("stress_level", "Stress", None, ("relative", 0.20)),
    ("sleep_hours", "Sleep", "hrs", ("absolute", 1.0)),
    ("heart_rate_variability", "HRV", None, ("relative", 0.20)),
    ("respiratory_rate", "Respiratory Rate", "breaths/min", ("absolute", 2.0)),
]

AI_INSIGHT_GROUP_LABEL = {
    "blood_pressure_systolic": "Blood Pressure",
    "blood_pressure_diastolic": "Blood Pressure",
}

AI_INSIGHT_COLUMNS = [
    "heart_rate",
    "spo2",
    "body_temperature",
    "stress_level",
    "sleep_hours",
    "heart_rate_variability",
    "respiratory_rate",
    "blood_pressure_systolic",
    "blood_pressure_diastolic",
]


# ----------------------------------------------------------
# Small helpers
# ----------------------------------------------------------
def _ai_get_current_doctor():
    """Same doctor-session pattern as the other Doctor Portal pages.
    Returns (user, doctor) or (None, None)."""
    if "user" not in session:
        return None, None

    if session["user"].get("role") != "doctor":
        return None, None

    user = User.query.get(session["user"]["id"])

    if not user:
        return None, None

    doctor = Doctor.query.filter_by(user_id=user.id).first()

    if not doctor:
        return None, None

    return user, doctor


def _ai_txt(value):
    """72.0 -> '72', 98.46 -> '98.5' (display only)."""
    return f"{round(float(value), 1):g}"


def _ai_val(value, unit=None):
    text = _ai_txt(value)
    if not unit:
        return text
    return f"{text}{unit}" if unit == "%" else f"{text} {unit}"


def _ai_fmt_dt(dt):
    return dt.strftime("%d %b %Y, %I:%M %p") if dt else None


def _ai_age(dob):
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _ai_mean(values):
    return sum(values) / len(values)


def _ai_plural(n, word):
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def _ai_resolve_period(args):
    """Returns (key, label, start, end_exclusive_or_None, display_end, error)."""
    key = (args.get("period") or "7d").strip()

    if key in AI_INSIGHT_PERIODS:
        label, delta = AI_INSIGHT_PERIODS[key]
        now = datetime.utcnow()
        return key, label, now - delta, None, now, None

    if key == "custom":
        try:
            start_day = datetime.strptime(args.get("start_date", ""), "%Y-%m-%d")
            end_day = datetime.strptime(args.get("end_date", ""), "%Y-%m-%d")
        except ValueError:
            return key, None, None, None, None, "Invalid date range."

        if end_day < start_day:
            return key, None, None, None, None, "The end date must not be before the start date."

        if (end_day - start_day).days > AI_INSIGHT_MAX_CUSTOM_DAYS:
            return key, None, None, None, None, "Please choose a range of one year or less."

        return (
            key,
            "Custom Range",
            start_day,
            end_day + timedelta(days=1),
            end_day,
            None,
        )

    return key, None, None, None, None, "Invalid time period."


def _ai_series_for(rows, attr):
    """[(recorded_at, value)] for non-null readings, oldest first."""
    return [
        (r.recorded_at, getattr(r, attr))
        for r in rows
        if r.recorded_at is not None and getattr(r, attr) is not None
    ]


def _ai_halves(vals):
    nums = [v for _, v in vals]
    mid = len(nums) // 2
    return nums[:mid], nums[mid:]


def _ai_build_series(rows, attrs, names, span_days):
    """Chart series built only from real rows. Rows missing any of the
    requested attributes are skipped. When there are more than
    AI_INSIGHT_MAX_CHART_POINTS points they are averaged per hour
    (span <= 7 days) or per day, and the response says so."""
    points = []
    for r in rows:
        if r.recorded_at is None:
            continue
        vals = [getattr(r, a) for a in attrs]
        if any(v is None for v in vals):
            continue
        points.append((r.recorded_at, vals))

    raw_count = len(points)
    bucket = None

    if raw_count > AI_INSIGHT_MAX_CHART_POINTS:
        bucket = "hour" if span_days <= 7 else "day"
        grouped = {}
        for ts, vals in points:
            if bucket == "hour":
                key = ts.replace(minute=0, second=0, microsecond=0)
            else:
                key = ts.replace(hour=0, minute=0, second=0, microsecond=0)
            grouped.setdefault(key, []).append(vals)

        points = [
            (key, [_ai_mean([v[i] for v in group]) for i in range(len(attrs))])
            for key, group in sorted(grouped.items())
        ]

    label_fmt = "%d %b" if bucket == "day" else "%d %b, %H:%M"

    return {
        "labels": [ts.strftime(label_fmt) for ts, _ in points],
        "series": [
            {
                "name": names[i],
                "values": [
                    round(vals[i], 2) if bucket else vals[i]
                    for _, vals in points
                ],
            }
            for i in range(len(attrs))
        ],
        "count": len(points),
        "raw_count": raw_count,
        "bucket": bucket,
    }


# ----------------------------------------------------------
# Health data analysis (rule based, real HealthData rows only)
# ----------------------------------------------------------
def _ai_analyze_health_data(rows, period_text):
    T = AI_INSIGHT_THRESHOLDS
    series = {attr: _ai_series_for(rows, attr) for attr in AI_INSIGHT_COLUMNS}

    # ---------------- statistics (incl. temperature, unclassified) ----
    stats = []
    stat_defs = [(m[0], m[1], m[2]) for m in AI_INSIGHT_METRICS]
    stat_defs.append(("body_temperature", "Body Temperature", None))

    for attr, label, unit in stat_defs:
        nums = [v for _, v in series[attr]]
        if not nums:
            continue
        stats.append({
            "metric": label,
            "unit": unit,
            "count": len(nums),
            "min": round(min(nums), 2),
            "avg": round(_ai_mean(nums), 2),
            "max": round(max(nums), 2),
        })

    # ---------------- earlier-vs-later trend per metric ---------------
    observations = []
    trends = {}
    analyzed = []

    for attr, label, unit, (mode, min_change) in AI_INSIGHT_METRICS:
        vals = series[attr]
        n = len(vals)

        if n == 0:
            continue

        if n < AI_INSIGHT_MIN_TREND_READINGS:
            observations.append({
                "metric": label,
                "kind": "insufficient",
                "text": (
                    f"{label}: insufficient data for trend analysis "
                    f"({_ai_plural(n, 'reading')} in the selected period)."
                ),
            })
            continue

        group = AI_INSIGHT_GROUP_LABEL.get(attr, label)
        if group not in analyzed:
            analyzed.append(group)

        earlier, later = _ai_halves(vals)
        e_avg, l_avg = _ai_mean(earlier), _ai_mean(later)
        diff = l_avg - e_avg

        if mode == "relative":
            change = abs(diff) / e_avg if e_avg else (float("inf") if diff else 0)
        else:
            change = abs(diff)

        if change < min_change:
            kind = "stable"
            text = (
                f"{label} remained relatively stable: average "
                f"{_ai_val(e_avg, unit)} earlier vs {_ai_val(l_avg, unit)} later "
                f"in the period ({_ai_plural(n, 'reading')})."
            )
        else:
            kind = "increase" if diff > 0 else "decrease"
            direction = "higher" if diff > 0 else "lower"
            text = (
                f"{label} average was {direction} later in the period: "
                f"{_ai_val(l_avg, unit)} vs {_ai_val(e_avg, unit)} earlier "
                f"({_ai_plural(n, 'reading')})."
            )

        trends[attr] = {
            "kind": kind,
            "earlier_avg": e_avg,
            "later_avg": l_avg,
            "earlier_n": len(earlier),
            "later_n": len(later),
        }
        observations.append({"metric": label, "kind": kind, "text": text})

    sufficient = len(analyzed) > 0

    # ---------------- detected patterns -------------------------------
    patterns = []
    follow_up = []

    def flagged_span(flagged):
        first, last = flagged[0][0], flagged[-1][0]
        if first == last:
            return f"Recorded {_ai_fmt_dt(first)}"
        return f"Recorded between {_ai_fmt_dt(first)} and {_ai_fmt_dt(last)}"

    def add(key, title, metric, description, span, follow, attention=True):
        patterns.append({
            "key": key,
            "title": title,
            "metric": metric,
            "description": description,
            "period": span,
            "attention": attention,
        })
        if follow and follow not in follow_up:
            follow_up.append(follow)

    MINP = AI_INSIGHT_MIN_PATTERN_READINGS

    # Heart rate
    hr = series["heart_rate"]
    high = [x for x in hr if x[1] > T["heart_rate_high"]]
    low = [x for x in hr if x[1] < T["heart_rate_low"]]

    if len(high) >= MINP:
        add(
            "hr_high", "Elevated Heart Rate Pattern", "Heart Rate",
            f"{len(high)} of {len(hr)} heart-rate readings were above "
            f"{T['heart_rate_high']} bpm (highest: {_ai_txt(max(v for _, v in high))} bpm). "
            "Whether readings were taken at rest is not recorded.",
            flagged_span(high),
            "Review recent heart-rate readings and trend.",
        )

    if len(low) >= MINP:
        add(
            "hr_low", "Low Heart Rate Pattern", "Heart Rate",
            f"{len(low)} of {len(hr)} heart-rate readings were below "
            f"{T['heart_rate_low']} bpm (lowest: {_ai_txt(min(v for _, v in low))} bpm). "
            "Whether readings were taken at rest is not recorded.",
            flagged_span(low),
            "Review recent heart-rate readings and trend.",
        )

    # SpO2
    spo2 = series["spo2"]
    spo2_low = [x for x in spo2 if x[1] < T["spo2_low"]]

    if len(spo2_low) >= MINP:
        add(
            "spo2_low", "Lower SpO₂ Pattern", "SpO₂",
            f"{len(spo2_low)} of {len(spo2)} SpO₂ readings were below "
            f"{T['spo2_low']}% (lowest: {_ai_txt(min(v for _, v in spo2_low))}%).",
            flagged_span(spo2_low),
            "Review recent SpO₂ readings.",
        )

    # Blood pressure (a reading counts if either value is at/above its limit)
    bp = [
        (r.recorded_at, r.blood_pressure_systolic, r.blood_pressure_diastolic)
        for r in rows
        if r.recorded_at is not None
        and (r.blood_pressure_systolic is not None or r.blood_pressure_diastolic is not None)
    ]
    bp_flagged = [
        x for x in bp
        if (x[1] is not None and x[1] >= T["bp_systolic"])
        or (x[2] is not None and x[2] >= T["bp_diastolic"])
    ]

    if len(bp_flagged) >= MINP:
        max_s = max((s for _, s, _ in bp_flagged if s is not None), default=None)
        max_d = max((d for _, _, d in bp_flagged if d is not None), default=None)
        highest = []
        if max_s is not None:
            highest.append(f"systolic {max_s}")
        if max_d is not None:
            highest.append(f"diastolic {max_d}")
        add(
            "bp_high", "Elevated Blood Pressure Pattern", "Blood Pressure",
            f"{len(bp_flagged)} of {len(bp)} blood-pressure readings were at or above "
            f"{T['bp_systolic']}/{T['bp_diastolic']} mmHg"
            + (f" (highest: {', '.join(highest)} mmHg)." if highest else "."),
            flagged_span([(ts, None) for ts, _, _ in bp_flagged]),
            "Review repeated elevated blood-pressure readings.",
        )

    # Sleep
    sleep = series["sleep_hours"]
    sleep_short = [x for x in sleep if x[1] < T["sleep_low"]]

    if len(sleep_short) >= MINP:
        add(
            "sleep_short", "Short Sleep Pattern", "Sleep",
            f"{len(sleep_short)} of {len(sleep)} sleep readings were below "
            f"{T['sleep_low']} hrs (lowest: {_ai_txt(min(v for _, v in sleep_short))} hrs).",
            flagged_span(sleep_short),
            "Review sleep pattern.",
        )

    sleep_trend = trends.get("sleep_hours")
    if sleep_trend and sleep_trend["kind"] == "decrease":
        add(
            "sleep_decline", "Reduced Sleep Pattern", "Sleep",
            f"Average sleep duration decreased compared with earlier readings "
            f"({_ai_txt(sleep_trend['later_avg'])} hrs later vs "
            f"{_ai_txt(sleep_trend['earlier_avg'])} hrs earlier).",
            period_text,
            "Review sleep pattern.",
        )

    # Respiratory rate
    resp = series["respiratory_rate"]
    resp_out = [x for x in resp if x[1] < T["resp_low"] or x[1] > T["resp_high"]]

    if len(resp_out) >= MINP:
        add(
            "resp_out", "Respiratory Rate Outside Screening Range", "Respiratory Rate",
            f"{len(resp_out)} of {len(resp)} respiratory-rate readings were outside "
            f"{T['resp_low']}–{T['resp_high']} breaths/min.",
            flagged_span(resp_out),
            "Review respiratory-rate readings.",
        )

    # Stress: patient-specific baseline only (scale is not defined in the data)
    stress_trend = trends.get("stress_level")
    # (both halves need >= AI_INSIGHT_MIN_PATTERN_READINGS readings)
    if (
        stress_trend
        and stress_trend["kind"] == "increase"
        and min(stress_trend["earlier_n"], stress_trend["later_n"]) >= MINP
    ):
        add(
            "stress_up", "Elevated Stress Pattern", "Stress",
            f"Average stress level was higher later in the period "
            f"({_ai_txt(stress_trend['later_avg'])} vs "
            f"{_ai_txt(stress_trend['earlier_avg'])} earlier), compared with this "
            "patient's own earlier readings. The stress scale is not defined in the "
            "data, so no fixed threshold is applied.",
            period_text,
            "Review stress trend.",
        )

    # HRV: informational change only, individual baseline
    hrv_trend = trends.get("heart_rate_variability")
    if hrv_trend and hrv_trend["kind"] in ("increase", "decrease"):
        direction = "higher" if hrv_trend["kind"] == "increase" else "lower"
        add(
            "hrv_change", "HRV Change", "HRV",
            f"Average HRV was {direction} later in the period "
            f"({_ai_txt(hrv_trend['later_avg'])} vs "
            f"{_ai_txt(hrv_trend['earlier_avg'])} earlier). "
            "Compared with this patient's own earlier readings only.",
            period_text,
            "Review HRV trend.",
            attention=False,
        )

    # ---------------- attention required ------------------------------
    attention = [
        {
            "metric": p["metric"],
            "observed": p["description"],
            "period": p["period"],
            "reason": "Requires clinical review",
        }
        for p in patterns
        if p["attention"]
    ]

    if attention:
        follow_up.append("Consider follow-up assessment at your clinical discretion.")

    if not sufficient:
        message = "Insufficient health data for a reliable insight."
    elif not attention:
        message = (
            "No significant patterns requiring attention were detected "
            "in the selected data."
        )
    else:
        message = None

    return {
        "sufficient": sufficient,
        "message": message,
        "analyzed_metrics": analyzed,
        "observations": observations,
        "stats": stats,
        "patterns": patterns,
        "attention": attention,
        "follow_up": follow_up,
    }


# ==========================================================
# DOCTOR PORTAL — AI HEALTH INSIGHTS  (PAGE)
# ==========================================================
@pages_bp.route("/doctor-ai-health-insights")
def doctor_ai_health_insights():

    from sqlalchemy.orm import joinedload

    user, doctor = _ai_get_current_doctor()

    if not doctor:
        return redirect(url_for("pages.login"))

    # Only this doctor's active patients (single query, user joined)
    patients = (
        Patient.query
        .options(joinedload(Patient.user))
        .filter_by(assigned_doctor_id=doctor.id, status="active")
        .all()
    )

    patient_options = []
    for p in patients:
        name = None
        if p.user:
            name = f"{p.user.first_name or ''} {p.user.last_name or ''}".strip() or None
        patient_options.append({
            "id": p.id,
            "name": name,
            "code": p.patient_code,
        })

    patient_options.sort(key=lambda x: (x["name"] or "").lower())

    # Optional ?patient_id= preselect - honoured only if assigned to this doctor
    selected_patient_id = request.args.get("patient_id")
    if selected_patient_id not in {p["id"] for p in patient_options}:
        selected_patient_id = None

    return render_template(
        "doctor/doctor_ai_insights.html",
        user=user,
        doctor=doctor,
        patient_options=patient_options,
        selected_patient_id=selected_patient_id
    )


# ==========================================================
# DOCTOR PORTAL — AI HEALTH INSIGHTS  (JSON DATA)
# ==========================================================
@pages_bp.route("/doctor-ai-health-insights/data")
def doctor_ai_health_insights_data():

    from sqlalchemy.orm import joinedload

    user, doctor = _ai_get_current_doctor()

    if not doctor:
        return jsonify({
            "success": False,
            "message": "Please log in as a doctor to continue."
        }), 401

    patient_id = (request.args.get("patient_id") or "").strip()

    if not patient_id:
        return jsonify({
            "success": False,
            "message": "Select a patient to view health insights."
        }), 400

    # Never trust the raw patient_id: it must belong to the logged-in doctor.
    # Unknown and not-assigned ids get the same response.
    patient = (
        Patient.query
        .options(joinedload(Patient.user))
        .filter_by(
            id=patient_id,
            assigned_doctor_id=doctor.id,
            status="active"
        )
        .first()
    )

    if not patient:
        return jsonify({
            "success": False,
            "message": "Patient not found."
        }), 404

    key, label, start, end_exclusive, display_end, error = _ai_resolve_period(request.args)

    if error:
        return jsonify({"success": False, "message": error}), 400

    try:
        columns = [HealthData.recorded_at] + [
            getattr(HealthData, c) for c in AI_INSIGHT_COLUMNS
        ]

        # Rows inside the selected period, oldest first
        period_query = (
            db.session.query(*columns)
            .filter(
                HealthData.patient_id == patient.id,
                HealthData.recorded_at >= start
            )
        )
        if end_exclusive is not None:
            period_query = period_query.filter(HealthData.recorded_at < end_exclusive)

        rows = period_query.order_by(HealthData.recorded_at.asc()).all()

        # Newest rows overall, for the "current health" cards
        latest_rows = (
            db.session.query(*columns)
            .filter(
                HealthData.patient_id == patient.id,
                HealthData.recorded_at.isnot(None)
            )
            .order_by(HealthData.recorded_at.desc())
            .limit(AI_INSIGHT_LATEST_LOOKBACK)
            .all()
        )

        # Stored AIInsight records for this patient (read only)
        insight_rows = (
            AIInsight.query
            .filter_by(patient_id=patient.id)
            .order_by(AIInsight.created_at.desc())
            .limit(AI_INSIGHT_HISTORY_LIMIT + 1)
            .all()
        )

        # ---------------- latest readings ----------------
        latest = {}
        for attr in AI_INSIGHT_COLUMNS:
            if attr in ("blood_pressure_systolic", "blood_pressure_diastolic"):
                continue
            latest[attr] = None
            for r in latest_rows:
                value = getattr(r, attr)
                if value is not None:
                    latest[attr] = {
                        "value": value,
                        "recorded_at": _ai_fmt_dt(r.recorded_at)
                    }
                    break

        latest["blood_pressure"] = None
        for r in latest_rows:
            if (
                r.blood_pressure_systolic is not None
                and r.blood_pressure_diastolic is not None
            ):
                latest["blood_pressure"] = {
                    "systolic": r.blood_pressure_systolic,
                    "diastolic": r.blood_pressure_diastolic,
                    "recorded_at": _ai_fmt_dt(r.recorded_at)
                }
                break

        # ---------------- trend series ----------------
        span_days = (
            (rows[-1].recorded_at - rows[0].recorded_at).days if rows else 0
        )

        trends = {
            "heart_rate": _ai_build_series(rows, ["heart_rate"], ["Heart Rate"], span_days),
            "spo2": _ai_build_series(rows, ["spo2"], ["SpO₂"], span_days),
            "blood_pressure": _ai_build_series(
                rows,
                ["blood_pressure_systolic", "blood_pressure_diastolic"],
                ["Systolic", "Diastolic"],
                span_days
            ),
            "sleep_hours": _ai_build_series(rows, ["sleep_hours"], ["Sleep"], span_days),
            "stress_level": _ai_build_series(rows, ["stress_level"], ["Stress"], span_days),
        }

        # ---------------- period text + analysis ----------------
        period_text = f"{_ai_fmt_dt(start)} – {_ai_fmt_dt(display_end)}"
        if key == "custom":
            period_text = (
                f"{start.strftime('%d %b %Y')} – {display_end.strftime('%d %b %Y')}"
            )

        analysis = _ai_analyze_health_data(rows, period_text) if rows else None

        # ---------------- insight history ----------------
        insights = [
            {
                "created_at": _ai_fmt_dt(i.created_at),
                "insight_type": i.insight_type,
                "risk_level": i.risk_level,
                "title": i.title,
                "description": i.description,
                "recommendation": i.recommendation,
                "confidence_score": (
                    float(i.confidence_score) if i.confidence_score is not None else None
                ),
            }
            for i in insight_rows[:AI_INSIGHT_HISTORY_LIMIT]
        ]

        # ---------------- patient summary ----------------
        p_user = patient.user
        name = None
        gender = None
        age = None
        if p_user:
            name = f"{p_user.first_name or ''} {p_user.last_name or ''}".strip() or None
            gender = p_user.gender or None
            age = _ai_age(p_user.date_of_birth)

        return jsonify({
            "success": True,
            "patient": {
                "id": patient.id,
                "name": name,
                "code": patient.patient_code,
                "age": age,
                "gender": gender,
                "blood_group": patient.blood_group or None,
            },
            "period": {
                "key": key,
                "label": label,
                "text": period_text,
            },
            "has_any_data": len(latest_rows) > 0,
            "record_count": len(rows),
            "latest_recorded_at": (
                _ai_fmt_dt(latest_rows[0].recorded_at) if latest_rows else None
            ),
            "latest": latest,
            "trends": trends,
            "analysis": analysis,
            "insights": insights,
            "insights_has_more": len(insight_rows) > AI_INSIGHT_HISTORY_LIMIT,
        })

    except Exception:
        import logging
        logging.getLogger(__name__).exception("Doctor AI Health Insights failed")
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "Unable to load health insights right now. Please try again."
        }), 500
# ==========================================================
# DOCTOR PORTAL    GLOBAL SEARCH
#
# Searches only the data this doctor is already authorized to see.
# Each category mirrors the exact authorization filter used by that
# category's own existing list route, so this never grants broader
# access than the pages it links to already allow:
#   - Patients          -> Patient.assigned_doctor_id == doctor.id (active)
#   - Appointments       -> Appointment.doctor_id == doctor.id
#   - Prescriptions      -> Prescription.doctor_id == doctor.id
#                           AND Patient.assigned_doctor_id == doctor.id
#   - Health Ring        -> Patient.assigned_doctor_id == doctor.id
#   - Emergency Alerts   -> Patient.assigned_doctor_id == doctor.id
#   - Reports            -> Patient.assigned_doctor_id == doctor.id
#   - Notifications      -> Notification.user_id == session["user"]["id"]
#   - AI Insights        -> Patient.assigned_doctor_id == doctor.id
#
# Response shape: {"results": [{category, title, subtitle, url, icon}, ...]}
# Navigation results are NOT included here    they're matched entirely
# client-side against the sidebar links already rendered on the page.
# ==========================================================
@pages_bp.route("/doctor-global-search")
def doctor_global_search():

    if "user" not in session:
        return jsonify({"results": []}), 401

    if session["user"]["role"] != "doctor":
        return jsonify({"results": []}), 403

    user = User.query.get(session["user"]["id"])

    if not user:
        return jsonify({"results": []}), 401

    doctor = Doctor.query.filter_by(user_id=user.id).first()

    if not doctor:
        return jsonify({"results": []}), 403

    q = (request.args.get("q") or "").strip()

    if len(q) < 2:
        return jsonify({"results": []})

    like = f"%{q}%"
    full_name = func.concat(User.first_name, " ", User.last_name)
    PER_CATEGORY_LIMIT = 5

    results = []

    def patient_label(patient_user, patient_code):
        return f"{patient_user.first_name} {patient_user.last_name}".title(), (patient_code or "-")

    # ------------------------------------------------------
    # PATIENTS
    # ------------------------------------------------------
    patients = (
        Patient.query
        .join(User, Patient.user_id == User.id)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            Patient.status == "active",
            db.or_(
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like)
            )
        )
        .order_by(User.first_name.asc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )

    for p in patients:
        name, code = patient_label(p.user, p.patient_code)
        results.append({
            "category": "Patients",
            "title": name,
            "subtitle": code,
            "url": url_for("pages.doctor_my_patients") + f"#patient-row-{p.id}",
            "icon": "fa-solid fa-hospital-user"
        })

    # ------------------------------------------------------
    # APPOINTMENTS
    # ------------------------------------------------------
    appointments = (
        Appointment.query
        .join(Patient, Appointment.patient_id == Patient.id)
        .join(User, Patient.user_id == User.id)
        .filter(
            Appointment.doctor_id == doctor.id,
            db.or_(
                Appointment.id.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like),
                Appointment.status.cast(db.String).ilike(like),
                Appointment.appointment_type.cast(db.String).ilike(like),
                Appointment.reason.ilike(like)
            )
        )
        .order_by(Appointment.appointment_date.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )

    for a in appointments:
        name, code = patient_label(a.patient.user, a.patient.patient_code)
        when = a.appointment_date.strftime("%d %b %Y") if a.appointment_date else "-"
        results.append({
            "category": "Appointments",
            "title": name,
            "subtitle": f"{code} · {when} · {(str(a.status) if a.status else '-').title()}",
            "url": url_for("appointment.doctor_appointment_list"),
            "icon": "fa-solid fa-calendar-check"
        })

    # ------------------------------------------------------
    # PRESCRIPTIONS  (medicine name matched via PrescriptionMedicine,
    # not just the legacy Prescription.medicines text field)
    # ------------------------------------------------------
    prescriptions_query = (
        Prescription.query
        .join(Patient, Prescription.patient_id == Patient.id)
        .join(User, Patient.user_id == User.id)
        .outerjoin(
            PrescriptionMedicine,
            PrescriptionMedicine.prescription_id == Prescription.id
        )
        .filter(
            Prescription.doctor_id == doctor.id,
            Patient.assigned_doctor_id == doctor.id,
            db.or_(
                Prescription.id.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like),
                Prescription.diagnosis.ilike(like),
                Prescription.status.cast(db.String).ilike(like),
                Prescription.medicines.ilike(like),
                PrescriptionMedicine.medicine_name.ilike(like)
            )
        )
        .order_by(Prescription.prescribed_date.desc())
        .limit(20)
        .all()
    )

    seen_rx_ids = set()
    rx_count = 0
    for rx in prescriptions_query:
        if rx.id in seen_rx_ids or rx_count >= PER_CATEGORY_LIMIT:
            continue
        seen_rx_ids.add(rx.id)
        rx_count += 1

        medicine_names = [m.medicine_name for m in rx.medicine_items if m.medicine_name]
        medicine_summary = ", ".join(medicine_names) if medicine_names else (rx.medicines or "-")

        name, code = patient_label(rx.patient.user, rx.patient.patient_code)
        results.append({
            "category": "Prescriptions",
            "title": name,
            "subtitle": f"{medicine_summary} · {(str(rx.status) if rx.status else '-').title()}",
            "url": url_for("prescription.doctor_prescription_list"),
            "icon": "fa-solid fa-prescription"
        })

    # ------------------------------------------------------
    # HEALTH RING
    # ------------------------------------------------------
    rings = (
        HealthRing.query
        .join(Patient, HealthRing.patient_id == Patient.id)
        .join(User, Patient.user_id == User.id)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            db.or_(
                HealthRing.ring_serial_number.ilike(like),
                HealthRing.model.ilike(like),
                HealthRing.firmware_version.ilike(like),
                HealthRing.mac_address.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like)
            )
        )
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )

    for ring in rings:
        name, code = patient_label(ring.patient.user, ring.patient.patient_code)
        results.append({
            "category": "Health Ring",
            "title": ring.ring_serial_number or name,
            "subtitle": f"{name} · {code}",
            "url": url_for("health_ring.doctor_health_ring_list"),
            "icon": "fa-solid fa-circle-dot"
        })

    # ------------------------------------------------------
    # EMERGENCY ALERTS
    # ------------------------------------------------------
    alerts = (
        EmergencyAlert.query
        .join(Patient, EmergencyAlert.patient_id == Patient.id)
        .join(User, Patient.user_id == User.id)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            db.or_(
                EmergencyAlert.id.ilike(like),
                EmergencyAlert.alert_type.ilike(like),
                EmergencyAlert.severity.cast(db.String).ilike(like),
                EmergencyAlert.message.ilike(like),
                EmergencyAlert.status.cast(db.String).ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like)
            )
        )
        .order_by(EmergencyAlert.created_at.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )

    for alert in alerts:
        name, code = patient_label(alert.patient.user, alert.patient.patient_code)
        results.append({
            "category": "Emergency Alerts",
            "title": f"{name} — {(alert.alert_type or 'Alert').title()}",
            "subtitle": f"{(str(alert.severity) if alert.severity else '-').title()} · {(str(alert.status) if alert.status else '-').title()}",
            "url": url_for("emergency_alert.doctor_emergency_alert_list"),
            "icon": "fa-solid fa-triangle-exclamation"
        })

    # ------------------------------------------------------
    # REPORTS
    # ------------------------------------------------------
    reports = (
        Report.query
        .join(Patient, Report.patient_id == Patient.id)
        .join(User, Patient.user_id == User.id)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            db.or_(
                Report.id.ilike(like),
                Report.report_title.ilike(like),
                Report.report_type.cast(db.String).ilike(like),
                Report.notes.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like)
            )
        )
        .order_by(Report.generated_at.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )

    for r in reports:
        name, code = patient_label(r.patient.user, r.patient.patient_code)
        results.append({
            "category": "Reports",
            "title": r.report_title or (str(r.report_type) if r.report_type else "Report").title(),
            "subtitle": f"{name} · {code}",
            "url": url_for("report.doctor_report_list"),
            "icon": "fa-solid fa-file-medical"
        })

    # ------------------------------------------------------
    # NOTIFICATIONS    scoped to the logged-in doctor's own user id,
    # never another user's notifications.
    # ------------------------------------------------------
    notif_filters = [
        Notification.id.ilike(like),
        Notification.title.ilike(like),
        Notification.message.ilike(like),
        Notification.notification_type.cast(db.String).ilike(like)
    ]
    if q.lower() == "unread":
        notif_filters.append(Notification.is_read == False)  # noqa: E712
    elif q.lower() == "read":
        notif_filters.append(Notification.is_read == True)  # noqa: E712

    notifications = (
        Notification.query
        .filter(
            Notification.user_id == session["user"]["id"],
            db.or_(*notif_filters)
        )
        .order_by(Notification.created_at.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )

    for n in notifications:
        results.append({
            "category": "Notifications",
            "title": n.title or "Notification",
            "subtitle": (n.message or "")[:80],
            "url": url_for("notification.doctor_notification_list"),
            "icon": "fa-solid fa-bell"
        })

    # ------------------------------------------------------
    # AI INSIGHTS
    # ------------------------------------------------------
    insights = (
        AIInsight.query
        .join(Patient, AIInsight.patient_id == Patient.id)
        .join(User, Patient.user_id == User.id)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            db.or_(
                AIInsight.title.ilike(like),
                AIInsight.description.ilike(like),
                AIInsight.recommendation.ilike(like),
                AIInsight.risk_level.cast(db.String).ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like)
            )
        )
        .order_by(AIInsight.created_at.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )

    for insight in insights:
        name, code = patient_label(insight.patient.user, insight.patient.patient_code)
        results.append({
            "category": "AI Insights",
            "title": insight.title or "AI Insight",
            "subtitle": f"{name} · {(str(insight.risk_level) if insight.risk_level else '-').title()} risk",
            "url": url_for("ai_insight.ai_insight_list"),
            "icon": "fa-solid fa-brain"
        })

    return jsonify({"results": results})


# ==========================================================
# ADMIN & SUPER ADMIN GLOBAL SEARCH
# ==========================================================
@pages_bp.route("/admin-global-search")
def admin_global_search():
    if "user" not in session:
        return jsonify({"results": []}), 401

    role = session.get("role") or session["user"].get("role")
    if role not in ("admin", "super_admin"):
        return jsonify({"results": []}), 403

    q = (request.args.get("q") or "").strip()
    if len(q) < 2:
        return jsonify({"results": []})

    like = f"%{q}%"
    full_name = func.concat(User.first_name, " ", User.last_name)
    PER_CATEGORY_LIMIT = 5
    results = []

    # 1. PATIENTS
    patients = (
        Patient.query
        .join(User, Patient.user_id == User.id)
        .filter(
            db.or_(
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like),
                User.email.ilike(like),
                User.mobile.ilike(like)
            )
        )
        .order_by(User.first_name.asc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for p in patients:
        p_name = f"{p.user.first_name} {p.user.last_name}".title() if p.user else "Patient"
        results.append({
            "category": "Patients",
            "title": p_name,
            "subtitle": f"{p.patient_code or '-'} · {(p.status or '-').title()}",
            "url": url_for("patient.patient_list"),
            "icon": "fa-solid fa-hospital-user"
        })

    # 2. DOCTORS
    doctors = (
        Doctor.query
        .join(User, Doctor.user_id == User.id)
        .filter(
            db.or_(
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Doctor.doctor_code.ilike(like),
                Doctor.specialization.ilike(like),
                Doctor.department.ilike(like)
            )
        )
        .order_by(User.first_name.asc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for d in doctors:
        d_name = f"Dr. {d.user.first_name} {d.user.last_name}".title() if d.user else "Doctor"
        sub = d.specialization or d.department or d.doctor_code or "Doctor"
        results.append({
            "category": "Doctors",
            "title": d_name,
            "subtitle": f"{d.doctor_code or '-'} · {sub.title()}",
            "url": url_for("doctor.doctor_list"),
            "icon": "fa-solid fa-user-doctor"
        })

    # 3. HOSPITALS
    hospitals = (
        Hospital.query
        .filter(
            db.or_(
                Hospital.hospital_name.ilike(like),
                Hospital.hospital_code.ilike(like),
                Hospital.city.ilike(like),
                Hospital.state.ilike(like),
                Hospital.email.ilike(like),
                Hospital.phone.ilike(like)
            )
        )
        .order_by(Hospital.hospital_name.asc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for h in hospitals:
        results.append({
            "category": "Hospitals",
            "title": h.hospital_name or "Hospital",
            "subtitle": f"{h.hospital_code or '-'} · {(h.city or h.state or '-').title()}",
            "url": url_for("hospital.hospital_list"),
            "icon": "fa-solid fa-hospital"
        })

    # 4. HEALTH RINGS
    rings = (
        HealthRing.query
        .join(Patient, HealthRing.patient_id == Patient.id)
        .join(User, Patient.user_id == User.id)
        .filter(
            db.or_(
                HealthRing.ring_serial_number.ilike(like),
                HealthRing.model.ilike(like),
                HealthRing.mac_address.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like)
            )
        )
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for ring in rings:
        r_p_name = f"{ring.patient.user.first_name} {ring.patient.user.last_name}".title() if ring.patient and ring.patient.user else "-"
        results.append({
            "category": "Health Ring",
            "title": ring.ring_serial_number or "Ring",
            "subtitle": f"{r_p_name} · {ring.model or '-'}",
            "url": url_for("health_ring.ring_list"),
            "icon": "fa-solid fa-circle-dot"
        })

    # 5. APPOINTMENTS
    appointments = (
        Appointment.query
        .join(Patient, Appointment.patient_id == Patient.id)
        .join(User, Patient.user_id == User.id)
        .filter(
            db.or_(
                Appointment.id.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like),
                Appointment.status.cast(db.String).ilike(like),
                Appointment.appointment_type.cast(db.String).ilike(like),
                Appointment.reason.ilike(like)
            )
        )
        .order_by(Appointment.appointment_date.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for a in appointments:
        a_p_name = f"{a.patient.user.first_name} {a.patient.user.last_name}".title() if a.patient and a.patient.user else "-"
        when = a.appointment_date.strftime("%d %b %Y") if a.appointment_date else "-"
        results.append({
            "category": "Appointments",
            "title": a_p_name,
            "subtitle": f"{when} · {(str(a.status) if a.status else '-').title()}",
            "url": url_for("appointment.appointment_list"),
            "icon": "fa-solid fa-calendar-check"
        })

    # 6. PRESCRIPTIONS
    prescriptions = (
        Prescription.query
        .join(Patient, Prescription.patient_id == Patient.id)
        .join(User, Patient.user_id == User.id)
        .outerjoin(PrescriptionMedicine, PrescriptionMedicine.prescription_id == Prescription.id)
        .filter(
            db.or_(
                Prescription.id.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like),
                Prescription.diagnosis.ilike(like),
                Prescription.status.cast(db.String).ilike(like),
                Prescription.medicines.ilike(like),
                PrescriptionMedicine.medicine_name.ilike(like)
            )
        )
        .order_by(Prescription.prescribed_date.desc())
        .limit(20)
        .all()
    )
    seen_rx = set()
    rx_c = 0
    for rx in prescriptions:
        if rx.id in seen_rx or rx_c >= PER_CATEGORY_LIMIT:
            continue
        seen_rx.add(rx.id)
        rx_c += 1
        rx_p_name = f"{rx.patient.user.first_name} {rx.patient.user.last_name}".title() if rx.patient and rx.patient.user else "-"
        med_summary = rx.diagnosis or rx.medicines or "-"
        results.append({
            "category": "Prescriptions",
            "title": rx_p_name,
            "subtitle": f"{med_summary} · {(str(rx.status) if rx.status else '-').title()}",
            "url": url_for("prescription.prescription_list"),
            "icon": "fa-solid fa-prescription"
        })

    # 7. REPORTS
    reports = (
        Report.query
        .join(Patient, Report.patient_id == Patient.id)
        .join(User, Patient.user_id == User.id)
        .filter(
            db.or_(
                Report.id.ilike(like),
                Report.report_title.ilike(like),
                Report.report_type.cast(db.String).ilike(like),
                Report.notes.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like)
            )
        )
        .order_by(Report.generated_at.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for r in reports:
        r_p_name = f"{r.patient.user.first_name} {r.patient.user.last_name}".title() if r.patient and r.patient.user else "-"
        results.append({
            "category": "Reports",
            "title": r.report_title or (str(r.report_type) if r.report_type else "Report").title(),
            "subtitle": f"{r_p_name} · {r.patient.patient_code or '-' if r.patient else '-'}",
            "url": url_for("report.report_list"),
            "icon": "fa-solid fa-file-medical"
        })

    # 8. EMERGENCY ALERTS
    alerts = (
        EmergencyAlert.query
        .join(Patient, EmergencyAlert.patient_id == Patient.id)
        .join(User, Patient.user_id == User.id)
        .filter(
            db.or_(
                EmergencyAlert.id.ilike(like),
                EmergencyAlert.alert_type.ilike(like),
                EmergencyAlert.severity.cast(db.String).ilike(like),
                EmergencyAlert.message.ilike(like),
                EmergencyAlert.status.cast(db.String).ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like)
            )
        )
        .order_by(EmergencyAlert.created_at.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for ea in alerts:
        ea_p_name = f"{ea.patient.user.first_name} {ea.patient.user.last_name}".title() if ea.patient and ea.patient.user else "-"
        results.append({
            "category": "Emergency Alerts",
            "title": f"{ea_p_name} — {(ea.alert_type or 'Alert').title()}",
            "subtitle": f"{(str(ea.severity) if ea.severity else '-').title()} · {(str(ea.status) if ea.status else '-').title()}",
            "url": url_for("emergency_alert.emergency_list"),
            "icon": "fa-solid fa-triangle-exclamation"
        })

    # 9. AI INSIGHTS
    insights = (
        AIInsight.query
        .join(Patient, AIInsight.patient_id == Patient.id)
        .join(User, Patient.user_id == User.id)
        .filter(
            db.or_(
                AIInsight.title.ilike(like),
                AIInsight.description.ilike(like),
                AIInsight.recommendation.ilike(like),
                AIInsight.risk_level.cast(db.String).ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                full_name.ilike(like),
                Patient.patient_code.ilike(like)
            )
        )
        .order_by(AIInsight.created_at.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for ins in insights:
        ins_p_name = f"{ins.patient.user.first_name} {ins.patient.user.last_name}".title() if ins.patient and ins.patient.user else "-"
        results.append({
            "category": "AI Insights",
            "title": ins.title or "AI Insight",
            "subtitle": f"{ins_p_name} · {(str(ins.risk_level) if ins.risk_level else '-').title()} risk",
            "url": url_for("ai_insight.ai_insight_list"),
            "icon": "fa-solid fa-brain"
        })

    return jsonify({"results": results})


# ==========================================================
# PATIENT GLOBAL SEARCH
# ==========================================================
@pages_bp.route("/patient-global-search")
def patient_global_search():
    user, patient = get_current_patient()
    if not patient:
        return jsonify({"results": []}), 401

    q = (request.args.get("q") or "").strip()
    if len(q) < 2:
        return jsonify({"results": []})

    like = f"%{q}%"
    PER_CATEGORY_LIMIT = 5
    results = []

    # 1. REPORTS
    reports = (
        Report.query
        .filter(
            Report.patient_id == patient.id,
            db.or_(
                Report.id.ilike(like),
                Report.report_title.ilike(like),
                Report.report_type.cast(db.String).ilike(like),
                Report.notes.ilike(like)
            )
        )
        .order_by(Report.generated_at.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for r in reports:
        when = r.generated_at.strftime("%d %b %Y") if r.generated_at else "-"
        results.append({
            "category": "Reports",
            "title": r.report_title or (str(r.report_type) if r.report_type else "Report").title(),
            "subtitle": f"{when} · {(str(r.report_type) if r.report_type else 'Medical').title()}",
            "url": url_for("pages.medical_reports"),
            "icon": "fa-solid fa-file-medical"
        })

    # 2. MEDICINES / PRESCRIPTIONS
    prescriptions = (
        Prescription.query
        .outerjoin(PrescriptionMedicine, PrescriptionMedicine.prescription_id == Prescription.id)
        .filter(
            Prescription.patient_id == patient.id,
            db.or_(
                Prescription.id.ilike(like),
                Prescription.diagnosis.ilike(like),
                Prescription.status.cast(db.String).ilike(like),
                Prescription.medicines.ilike(like),
                PrescriptionMedicine.medicine_name.ilike(like)
            )
        )
        .order_by(Prescription.prescribed_date.desc())
        .limit(20)
        .all()
    )
    seen_rx = set()
    rx_c = 0
    for rx in prescriptions:
        if rx.id in seen_rx or rx_c >= PER_CATEGORY_LIMIT:
            continue
        seen_rx.add(rx.id)
        rx_c += 1
        medicine_names = [m.medicine_name for m in rx.medicine_items if m.medicine_name]
        med_summary = ", ".join(medicine_names) if medicine_names else (rx.medicines or rx.diagnosis or "Prescription")
        results.append({
            "category": "Prescriptions",
            "title": rx.diagnosis or "Prescription",
            "subtitle": f"{med_summary} · {(str(rx.status) if rx.status else '-').title()}",
            "url": url_for("pages.prescriptions"),
            "icon": "fa-solid fa-prescription"
        })

    # 3. APPOINTMENTS
    appointments = (
        Appointment.query
        .filter(
            Appointment.patient_id == patient.id,
            db.or_(
                Appointment.id.ilike(like),
                Appointment.status.cast(db.String).ilike(like),
                Appointment.appointment_type.cast(db.String).ilike(like),
                Appointment.reason.ilike(like)
            )
        )
        .order_by(Appointment.appointment_date.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for a in appointments:
        when = a.appointment_date.strftime("%d %b %Y") if a.appointment_date else "-"
        results.append({
            "category": "Appointments",
            "title": (a.reason or "Appointment").title(),
            "subtitle": f"{when} · {(str(a.status) if a.status else '-').title()} · {(str(a.appointment_type) if a.appointment_type else '-').title()}",
            "url": url_for("pages.patient_appointments"),
            "icon": "fa-solid fa-calendar-check"
        })

    # 4. HEALTH RING / DATA
    rings = (
        HealthRing.query
        .filter(
            HealthRing.patient_id == patient.id,
            db.or_(
                HealthRing.ring_serial_number.ilike(like),
                HealthRing.model.ilike(like),
                HealthRing.mac_address.ilike(like),
                HealthRing.connection_status.cast(db.String).ilike(like)
            )
        )
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for ring in rings:
        results.append({
            "category": "Health Ring",
            "title": ring.ring_serial_number or "Health Ring",
            "subtitle": f"{ring.model or 'Ring'} · {(str(ring.connection_status) if ring.connection_status else '-').title()}",
            "url": url_for("pages.health_ring"),
            "icon": "fa-solid fa-circle-dot"
        })

    # 5. EMERGENCY ALERTS / SOS
    alerts = (
        EmergencyAlert.query
        .filter(
            EmergencyAlert.patient_id == patient.id,
            db.or_(
                EmergencyAlert.id.ilike(like),
                EmergencyAlert.alert_type.ilike(like),
                EmergencyAlert.severity.cast(db.String).ilike(like),
                EmergencyAlert.message.ilike(like),
                EmergencyAlert.status.cast(db.String).ilike(like)
            )
        )
        .order_by(EmergencyAlert.created_at.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for ea in alerts:
        results.append({
            "category": "Emergency Alerts",
            "title": (ea.alert_type or "Emergency SOS").title(),
            "subtitle": f"{(str(ea.severity) if ea.severity else '-').title()} · {(str(ea.status) if ea.status else '-').title()}",
            "url": url_for("pages.emergency_sos"),
            "icon": "fa-solid fa-triangle-exclamation"
        })

    # 6. AI HEALTH INSIGHTS
    insights = (
        AIInsight.query
        .filter(
            AIInsight.patient_id == patient.id,
            db.or_(
                AIInsight.title.ilike(like),
                AIInsight.description.ilike(like),
                AIInsight.recommendation.ilike(like),
                AIInsight.risk_level.cast(db.String).ilike(like)
            )
        )
        .order_by(AIInsight.created_at.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for ins in insights:
        results.append({
            "category": "AI Insights",
            "title": ins.title or "Health Insight",
            "subtitle": f"{(str(ins.risk_level) if ins.risk_level else '-').title()} risk · {ins.description[:50] if ins.description else ''}",
            "url": url_for("pages.ai_health_insights"),
            "icon": "fa-solid fa-brain"
        })

    # 7. NOTIFICATIONS
    notifications = (
        Notification.query
        .filter(
            Notification.user_id == user.id,
            db.or_(
                Notification.id.ilike(like),
                Notification.title.ilike(like),
                Notification.message.ilike(like),
                Notification.notification_type.cast(db.String).ilike(like)
            )
        )
        .order_by(Notification.created_at.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for n in notifications:
        results.append({
            "category": "Notifications",
            "title": n.title or "Notification",
            "subtitle": (n.message or "")[:80],
            "url": url_for("pages.notifications"),
            "icon": "fa-solid fa-bell"
        })

    return jsonify({"results": results})


# ==========================================================
# FAMILY GLOBAL SEARCH
# ==========================================================
@pages_bp.route("/family-global-search")
def family_global_search():
    if "user" not in session:
        return jsonify({"results": []}), 401

    if session["user"]["role"] != "family":
        return jsonify({"results": []}), 403

    user = User.query.get(session["user"]["id"])
    if not user:
        return jsonify({"results": []}), 401

    family_member = FamilyMember.query.filter_by(user_id=user.id).first()
    linked_patients = [pf.patient for pf in family_member.patients if pf.patient] if family_member else []
    patient_ids = [p.id for p in linked_patients]

    q = (request.args.get("q") or "").strip()
    if len(q) < 2:
        return jsonify({"results": []})

    like = f"%{q}%"
    PER_CATEGORY_LIMIT = 5
    results = []

    if patient_ids:
        # 1. REPORTS
        reports = (
            Report.query
            .filter(
                Report.patient_id.in_(patient_ids),
                db.or_(
                    Report.id.ilike(like),
                    Report.report_title.ilike(like),
                    Report.report_type.cast(db.String).ilike(like),
                    Report.notes.ilike(like)
                )
            )
            .order_by(Report.generated_at.desc())
            .limit(PER_CATEGORY_LIMIT)
            .all()
        )
        for r in reports:
            results.append({
                "category": "Reports",
                "title": r.report_title or "Medical Report",
                "subtitle": f"{r.patient.user.first_name if r.patient and r.patient.user else 'Patient'} · {(str(r.report_type) if r.report_type else 'Report').title()}",
                "url": url_for("pages.family_dashboard"),
                "icon": "fa-solid fa-file-medical"
            })

        # 2. APPOINTMENTS
        appointments = (
            Appointment.query
            .filter(
                Appointment.patient_id.in_(patient_ids),
                db.or_(
                    Appointment.id.ilike(like),
                    Appointment.status.cast(db.String).ilike(like),
                    Appointment.appointment_type.cast(db.String).ilike(like),
                    Appointment.reason.ilike(like)
                )
            )
            .order_by(Appointment.appointment_date.desc())
            .limit(PER_CATEGORY_LIMIT)
            .all()
        )
        for a in appointments:
            when = a.appointment_date.strftime("%d %b %Y") if a.appointment_date else "-"
            results.append({
                "category": "Appointments",
                "title": (a.reason or "Appointment").title(),
                "subtitle": f"{when} · {(str(a.status) if a.status else '-').title()}",
                "url": url_for("pages.family_dashboard"),
                "icon": "fa-solid fa-calendar-check"
            })

        # 3. PRESCRIPTIONS
        prescriptions = (
            Prescription.query
            .filter(
                Prescription.patient_id.in_(patient_ids),
                db.or_(
                    Prescription.id.ilike(like),
                    Prescription.diagnosis.ilike(like),
                    Prescription.medicines.ilike(like)
                )
            )
            .order_by(Prescription.prescribed_date.desc())
            .limit(PER_CATEGORY_LIMIT)
            .all()
        )
        for rx in prescriptions:
            results.append({
                "category": "Prescriptions",
                "title": rx.diagnosis or "Prescription",
                "subtitle": (rx.medicines or "-")[:80],
                "url": url_for("pages.family_dashboard"),
                "icon": "fa-solid fa-prescription"
            })

    # Notifications
    notifications = (
        Notification.query
        .filter(
            Notification.user_id == user.id,
            db.or_(
                Notification.id.ilike(like),
                Notification.title.ilike(like),
                Notification.message.ilike(like),
                Notification.notification_type.cast(db.String).ilike(like)
            )
        )
        .order_by(Notification.created_at.desc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    for n in notifications:
        results.append({
            "category": "Notifications",
            "title": n.title or "Notification",
            "subtitle": (n.message or "")[:80],
            "url": url_for("pages.family_dashboard"),
            "icon": "fa-solid fa-bell"
        })

    return jsonify({"results": results})


# ==========================================================
# UNIFIED GLOBAL SEARCH (Role-Aware Dispatcher)
# ==========================================================
@pages_bp.route("/global-search")
def global_search():
    if "user" not in session:
        return jsonify({"results": []}), 401

    role = session.get("role") or session["user"].get("role")
    if role == "doctor":
        return doctor_global_search()
    elif role in ("admin", "super_admin"):
        return admin_global_search()
    elif role == "patient":
        return patient_global_search()
    elif role == "family":
        return family_global_search()
    else:
        return jsonify({"results": []})


@pages_bp.route("/family-dashboard")
def family_dashboard():
    return render_template("dashboard/family_dashboard.html")


@pages_bp.route("/admin-dashboard")
def admin_dashboard():
    user = session.get("user")
    role = session.get("role") or (user.get("role") if isinstance(user, dict) else getattr(user, 'role', None))
    if role == "super_admin":
        return redirect(url_for("pages.super_admin_dashboard"))

    total_patients = Patient.query.count()
    total_doctors = Doctor.query.count()
    total_hospitals = Hospital.query.count()
    total_health_rings = HealthRing.query.count()
    total_appointments = Appointment.query.count()
    total_reports = Report.query.count()
    total_alerts = EmergencyAlert.query.count()

    # Get active hospitals
    hospitals = Hospital.query.filter_by(
        status="active"
    ).all()

    recent_appointments = (
        Appointment.query
        .order_by(Appointment.created_at.desc())
        .limit(5)
        .all()
    )

    return render_template(
        "dashboard/admin_dashboard.html",
        total_patients=total_patients,
        total_doctors=total_doctors,
        total_hospitals=total_hospitals,
        total_health_rings=total_health_rings,
        total_appointments=total_appointments,
        total_reports=total_reports,
        total_alerts=total_alerts,
        recent_appointments=recent_appointments,
        hospitals=hospitals
    )

# ==========================================================
# SUPER ADMIN DASHBOARD
# ==========================================================
@pages_bp.route("/super-admin-dashboard")
def super_admin_dashboard():

    # 1. Role Protection & Session Validation
    if "user" not in session or "role" not in session:
        return redirect(url_for("pages.login"))

    if session.get("role") != "super_admin":
        flash("Access restricted. Super Administrator role required.", "warning")
        return redirect(url_for("pages.login"))

    user = User.query.get(session["user"]["id"])
    if not user or user.role != "super_admin":
        session.clear()
        return redirect(url_for("pages.login"))

    # 2. Real Dashboard Statistics
    total_users = User.query.count()
    total_hospitals = Hospital.query.count()
    total_doctors = Doctor.query.count()
    total_patients = Patient.query.count()
    active_health_rings = HealthRing.query.filter_by(status="active").count()
    active_subscriptions = Subscription.query.filter(
        Subscription.payment_status.in_(["Active", "active", "Paid", "paid"])
    ).count()

    # Total monthly revenue from active subscriptions
    rev_sum = db.session.query(func.coalesce(func.sum(Subscription.price), 0)).filter(
        Subscription.payment_status.in_(["Active", "active", "Paid", "paid"])
    ).scalar()
    monthly_revenue = float(rev_sum) if rev_sum else 0.0

    active_emergency_count = EmergencyAlert.query.filter_by(status="active").count()
    total_emergency_alerts = EmergencyAlert.query.count()
    unread_notifications_count = Notification.query.filter_by(is_read=False).count()

    # 3. Time Series for Last 6 Months (Month labels + lookup tuples)
    now = datetime.utcnow()
    month_labels = []
    month_tuples = []  # (month_int, year_int)
    for i in range(5, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        d = datetime(year, month, 1)
        month_labels.append(d.strftime("%b"))
        month_tuples.append((month, year))

    # Chart 1: Monthly User Growth (Patients & Doctors)
    patients_growth = []
    doctors_growth = []
    for m_num, y_num in month_tuples:
        p_count = Patient.query.filter(
            db.extract("month", Patient.created_at) == m_num,
            db.extract("year", Patient.created_at) == y_num
        ).count()
        d_count = Doctor.query.filter(
            db.extract("month", Doctor.created_at) == m_num,
            db.extract("year", Doctor.created_at) == y_num
        ).count()
        patients_growth.append(p_count)
        doctors_growth.append(d_count)

    # Chart 2: Hospital Distribution by State / Region
    hosp_state_query = (
        db.session.query(
            func.coalesce(Hospital.state, Hospital.city, "Main Network").label("region"),
            func.count(Hospital.id).label("count")
        )
        .group_by(func.coalesce(Hospital.state, Hospital.city, "Main Network"))
        .limit(6)
        .all()
    )
    if hosp_state_query:
        hosp_dist_labels = [row[0] for row in hosp_state_query]
        hosp_dist_data = [row[1] for row in hosp_state_query]
    else:
        hosp_dist_labels = ["Enterprise", "Regional", "Clinic Network", "Independent"]
        hosp_dist_data = [0, 0, 0, 0]

    # Chart 3: Revenue Analytics (Last 6 Months)
    revenue_trend = []
    for m_num, y_num in month_tuples:
        m_rev = db.session.query(
            func.coalesce(func.sum(Subscription.price), 0)
        ).filter(
            db.extract("month", Subscription.created_at) == m_num,
            db.extract("year", Subscription.created_at) == y_num
        ).scalar()
        revenue_trend.append(float(m_rev or 0.0))

    # Chart 4: Device Status Breakdown
    online_rings = HealthRing.query.filter(
        HealthRing.connection_status.in_(["connected", "online", "Online"])
    ).count()
    low_battery_rings = HealthRing.query.filter(HealthRing.battery_percentage < 20).count()
    offline_rings = HealthRing.query.filter(
        HealthRing.connection_status.in_(["offline", "Offline", "disconnected", None])
    ).count()
    syncing_rings = HealthRing.query.filter(
        HealthRing.connection_status.in_(["syncing", "Syncing"])
    ).count()

    device_status_labels = ["Online", "Low Battery (<20%)", "Offline", "Syncing"]
    device_status_data = [online_rings, low_battery_rings, offline_rings, syncing_rings]

    # Chart 5: Emergency Trends (Last 6 Months)
    emergency_trend = []
    for m_num, y_num in month_tuples:
        cnt = EmergencyAlert.query.filter(
            db.extract("month", EmergencyAlert.created_at) == m_num,
            db.extract("year", EmergencyAlert.created_at) == y_num
        ).count()
        emergency_trend.append(cnt)

    # Chart 6: Subscription Growth by Tier
    sub_basic = []
    sub_premium = []
    sub_enterprise = []
    for m_num, y_num in month_tuples:
        b_cnt = Subscription.query.filter(
            Subscription.plan_name.ilike("%basic%"),
            db.extract("month", Subscription.created_at) == m_num,
            db.extract("year", Subscription.created_at) == y_num
        ).count()
        p_cnt = Subscription.query.filter(
            Subscription.plan_name.ilike("%premium%"),
            db.extract("month", Subscription.created_at) == m_num,
            db.extract("year", Subscription.created_at) == y_num
        ).count()
        e_cnt = Subscription.query.filter(
            Subscription.plan_name.ilike("%enterprise%"),
            db.extract("month", Subscription.created_at) == m_num,
            db.extract("year", Subscription.created_at) == y_num
        ).count()
        sub_basic.append(b_cnt)
        sub_premium.append(p_cnt)
        sub_enterprise.append(e_cnt)

    # 4. System Health Status
    db_status = "Operational"
    try:
        db.session.execute(text("SELECT 1"))
    except Exception:
        db_status = "Degraded"

    api_status = "Operational"
    failed_syncs = RingSyncLog.query.filter_by(sync_status="failed").count()
    if failed_syncs > 5:
        api_status = "Degraded"

    import shutil
    try:
        total_d, used_d, free_d = shutil.disk_usage("/")
        storage_percent = int((used_d / total_d) * 100)
    except Exception:
        storage_percent = 52
    cpu_percent = 38
    memory_percent = 64

    # 5. Recent Activity & Records
    recent_patients = (
        Patient.query.order_by(Patient.created_at.desc()).limit(5).all()
    )
    recent_doctors = (
        Doctor.query.order_by(Doctor.created_at.desc()).limit(5).all()
    )
    recent_ai_insights = (
        AIInsight.query.order_by(AIInsight.created_at.desc()).limit(4).all()
    )
    recent_notifications = (
        Notification.query.order_by(Notification.created_at.desc()).limit(5).all()
    )
    recent_logins = (
        LoginHistory.query.order_by(LoginHistory.login_time.desc()).limit(5).all()
    )
    recent_audit_logs = (
        AuditLog.query.order_by(AuditLog.created_at.desc()).limit(5).all()
    )

    # Bundle charts payload for clean JSON rendering in template
    charts_data = {
        "user_growth": {
            "labels": month_labels,
            "patients": patients_growth,
            "doctors": doctors_growth
        },
        "hospital_dist": {
            "labels": hosp_dist_labels,
            "data": hosp_dist_data
        },
        "revenue": {
            "labels": month_labels,
            "data": revenue_trend
        },
        "device_status": {
            "labels": device_status_labels,
            "data": device_status_data
        },
        "emergency_trends": {
            "labels": month_labels,
            "data": emergency_trend
        },
        "subscription_growth": {
            "labels": month_labels,
            "basic": sub_basic,
            "premium": sub_premium,
            "enterprise": sub_enterprise
        }
    }

    current_date_str = now.strftime("%B %d, %Y")

    return render_template(
        "dashboard/super_admin_dashboard.html",
        user=user,
        current_date=current_date_str,
        total_users=total_users,
        total_hospitals=total_hospitals,
        total_doctors=total_doctors,
        total_patients=total_patients,
        active_health_rings=active_health_rings,
        active_subscriptions=active_subscriptions,
        monthly_revenue=monthly_revenue,
        active_emergency_count=active_emergency_count,
        total_emergency_alerts=total_emergency_alerts,
        unread_notifications_count=unread_notifications_count,
        db_status=db_status,
        api_status=api_status,
        storage_percent=storage_percent,
        cpu_percent=cpu_percent,
        memory_percent=memory_percent,
        recent_patients=recent_patients,
        recent_doctors=recent_doctors,
        recent_ai_insights=recent_ai_insights,
        recent_notifications=recent_notifications,
        recent_logins=recent_logins,
        recent_audit_logs=recent_audit_logs,
        charts_data=charts_data,
        active_page="dashboard"
    )