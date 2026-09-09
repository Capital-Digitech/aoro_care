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

    # ------------------------------------------------------
    # Pending appointment requests
    # Patient has requested a slot.
    # Doctor/Admin must review and confirm it.
    # ------------------------------------------------------
    pending_appointments = (
        Appointment.query
        .filter_by(
            patient_id=patient.id,
            status="pending"
        )
        .order_by(
            Appointment.appointment_date.asc(),
            Appointment.appointment_time.asc()
        )
        .all()
    )

    # ------------------------------------------------------
    # Upcoming appointments
    # Confirmed appointments are actual upcoming appointments.
    # Existing "scheduled" records are preserved as legacy
    # appointments and continue to appear here.
    # ------------------------------------------------------
    upcoming_appointments = (
        Appointment.query
        .filter(
            Appointment.patient_id == patient.id,
            Appointment.status.in_(["confirmed", "scheduled"])
        )
        .order_by(
            Appointment.appointment_date.asc(),
            Appointment.appointment_time.asc()
        )
        .all()
    )

    # ------------------------------------------------------
    # Appointment history
    # Completed / Cancelled / Missed appointments
    # ------------------------------------------------------
    history_appointments = (
        Appointment.query
        .filter(
            Appointment.patient_id == patient.id,
            Appointment.status.in_(
                ["completed", "cancelled", "missed"]
            )
        )
        .order_by(
            Appointment.appointment_date.desc(),
            Appointment.appointment_time.desc()
        )
        .all()
    )

    # ------------------------------------------------------
    # Appointment statistics
    # ------------------------------------------------------
    total_appointments = (
        len(pending_appointments)
        + len(upcoming_appointments)
        + len(history_appointments)
    )

    pending_count = len(pending_appointments)

    confirmed_count = sum(
        1
        for appointment in upcoming_appointments
        if appointment.status == "confirmed"
    )

    scheduled_count = sum(
        1
        for appointment in upcoming_appointments
        if appointment.status == "scheduled"
    )

    completed_count = sum(
        1
        for appointment in history_appointments
        if appointment.status == "completed"
    )

    cancelled_count = sum(
        1
        for appointment in history_appointments
        if appointment.status == "cancelled"
    )

    missed_count = sum(
        1
        for appointment in history_appointments
        if appointment.status == "missed"
    )

    # ------------------------------------------------------
    # Current Health Ring
    # ------------------------------------------------------
    health_ring = (
        patient.rings[0]
        if patient.rings
        else None
    )

    # ------------------------------------------------------
    # Latest health data
    # ------------------------------------------------------
    latest_health = (
        HealthData.query
        .filter_by(patient_id=patient.id)
        .order_by(HealthData.recorded_at.desc())
        .first()
    )

    # ------------------------------------------------------
    # Patient prescriptions
    # ------------------------------------------------------
    prescriptions = (
        Prescription.query
        .filter_by(patient_id=patient.id)
        .order_by(Prescription.prescribed_date.desc())
        .all()
    )

    # ------------------------------------------------------
    # Doctors and hospitals available for appointment requests
    # ------------------------------------------------------
    doctors = Doctor.query.filter_by(status="active").all()
    hospitals = Hospital.query.filter_by(status="active").all()

    return render_template(
        "patient_portal/appointments.html",
        user=user,
        patient=patient,

        # Appointment data
        pending_appointments=pending_appointments,
        upcoming_appointments=upcoming_appointments,
        history_appointments=history_appointments,

        # Appointment statistics
        total_appointments=total_appointments,
        pending_count=pending_count,
        confirmed_count=confirmed_count,
        scheduled_count=scheduled_count,
        completed_count=completed_count,
        cancelled_count=cancelled_count,
        missed_count=missed_count,

        # Health data
        health_ring=health_ring,
        latest_health=latest_health,
        prescriptions=prescriptions,

        # Appointment request form data
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
        status="pending",
        meeting_link=meeting_link
    )
    db.session.add(appointment)

    # Create request notification for patient
    notif = Notification(
        user_id=user.id,
        title="Appointment Request Submitted",
        message=f"Your appointment request for {appt_date.strftime('%b %d, %Y')} at {appt_time.strftime('%I:%M %p')} has been submitted and is awaiting confirmation.",
        notification_type="appointment",
        is_read=False
    )
    db.session.add(notif)
    db.session.commit()

    flash("Your appointment request has been submitted successfully!", "success")
    return redirect(url_for("pages.patient_appointments"))


@pages_bp.route(
    "/appointments/cancel/<string:id>",
    methods=["POST"]
)
def patient_cancel_appointment(id):

    user, patient = get_current_patient()

    if not patient:
        return jsonify(
            {
                "success": False,
                "message": "Unauthorized"
            }
        ), 401

    appointment = Appointment.query.filter_by(
        id=id,
        patient_id=patient.id
    ).first_or_404()

    # ------------------------------------------------------
    # Only active appointments can be cancelled.
    # Completed and missed appointments cannot be cancelled.
    # Already cancelled appointments cannot be cancelled again.
    # ------------------------------------------------------
    if appointment.status not in [
        "pending",
        "confirmed",
        "scheduled"
    ]:
        return jsonify(
            {
                "success": False,
                "message": (
                    "Only pending or confirmed appointments "
                    "can be cancelled."
                )
            }
        ), 400

    appointment.status = "cancelled"

    db.session.commit()

    flash(
        "Appointment has been cancelled.",
        "info"
    )

    return redirect(
        url_for("pages.patient_appointments")
    )

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
        .group_by(func.month(HealthData.recorded_at))
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

        count = Appointment.query.filter(
            Appointment.doctor_id == doctor.id,
            func.weekday(Appointment.appointment_date) == day
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
            func.month(EmergencyAlert.created_at),
            func.count(EmergencyAlert.id)
        )
        .join(Patient)
        .filter(
            Patient.assigned_doctor_id == doctor.id
        )
        .group_by(func.month(EmergencyAlert.created_at))
        .order_by(func.month(EmergencyAlert.created_at))
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
        Appointment.appointment_type.in_(["offline", "In-Person", "in-person"])
    ).count()

    online = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.appointment_type.in_(["online", "Video Call", "video-call", "Phone Call"])
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

    patients = Patient.query.filter_by(
        assigned_doctor_id=doctor.id,
        status="active"
    ).all()

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
            func.month(Patient.created_at) == m_num,
            func.year(Patient.created_at) == y_num
        ).count()
        d_count = Doctor.query.filter(
            func.month(Doctor.created_at) == m_num,
            func.year(Doctor.created_at) == y_num
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
            func.month(Subscription.created_at) == m_num,
            func.year(Subscription.created_at) == y_num
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
            func.month(EmergencyAlert.created_at) == m_num,
            func.year(EmergencyAlert.created_at) == y_num
        ).count()
        emergency_trend.append(cnt)

    # Chart 6: Subscription Growth by Tier
    sub_basic = []
    sub_premium = []
    sub_enterprise = []
    for m_num, y_num in month_tuples:
        b_cnt = Subscription.query.filter(
            Subscription.plan_name.ilike("%basic%"),
            func.month(Subscription.created_at) == m_num,
            func.year(Subscription.created_at) == y_num
        ).count()
        p_cnt = Subscription.query.filter(
            Subscription.plan_name.ilike("%premium%"),
            func.month(Subscription.created_at) == m_num,
            func.year(Subscription.created_at) == y_num
        ).count()
        e_cnt = Subscription.query.filter(
            Subscription.plan_name.ilike("%enterprise%"),
            func.month(Subscription.created_at) == m_num,
            func.year(Subscription.created_at) == y_num
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