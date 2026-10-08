from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session
)

import re
import uuid

from werkzeug.security import generate_password_hash, check_password_hash

from database import db
from models import (
    User, Doctor, Hospital, DoctorPatient, Appointment,
    Prescription, Report, Patient, Notification, AuditLog, LoginHistory,
    Setting
)


doctor_bp = Blueprint(
    "doctor",
    __name__,
    url_prefix="/doctor"
)

# ==========================================================
# Doctor My Profile
# ==========================================================

@doctor_bp.route("/my-profile")
def doctor_my_profile():

    user_id = session.get("user_id")

    if not user_id or session.get("role") != "doctor":
        return redirect(url_for("pages.login"))

    doctor = Doctor.query.filter_by(user_id=user_id).first()

    if not doctor:
        flash("Doctor profile not found.", "danger")
        return redirect(url_for("pages.doctor_dashboard"))

    return render_template(
        "doctor/doctor_my_profile.html",
        doctor=doctor
    )

# ==========================================================
# Doctor Edit My Profile
# ==========================================================

@doctor_bp.route("/my-profile/edit", methods=["GET", "POST"])
def doctor_edit_my_profile():

    user_id = session.get("user_id")

    if not user_id or session.get("role") != "doctor":
        return redirect(url_for("pages.login"))

    doctor = Doctor.query.filter_by(user_id=user_id).first()

    if not doctor:
        flash("Doctor profile not found.", "danger")
        return redirect(url_for("pages.doctor_dashboard"))

    if request.method == "POST":

        # Personal Information
        doctor.user.first_name = (request.form.get("first_name") or "").strip()
        doctor.user.last_name = (request.form.get("last_name") or "").strip()
        doctor.user.email = (request.form.get("email") or "").strip()
        doctor.user.mobile = (request.form.get("mobile") or "").strip()
        doctor.user.gender = (request.form.get("gender") or "").strip()
        doctor.user.address = (request.form.get("address") or "").strip()

        # Professional Information
        doctor.specialization = (request.form.get("specialization") or "").strip() or None
        doctor.qualification = (request.form.get("qualification") or "").strip() or None

        experience = (request.form.get("experience_years") or "").strip()
        doctor.experience_years = int(experience) if experience.isdigit() else None

        doctor.medical_license = (request.form.get("medical_license") or "").strip() or None

        fee = (request.form.get("consultation_fee") or "").strip()
        doctor.consultation_fee = float(fee) if fee else None

        doctor.available_days = (request.form.get("available_days") or "").strip() or None
        doctor.available_time = (request.form.get("available_time") or "").strip() or None
        doctor.about = (request.form.get("about") or "").strip() or None

        db.session.commit()

        flash("Profile updated successfully!", "success")

        return redirect(url_for("doctor.doctor_my_profile"))

    return render_template(
        "doctor/doctor_edit_my_profile.html",
        doctor=doctor
    )

# ==========================================================
# Doctor List
# ==========================================================

@doctor_bp.route("/")
def doctor_list():

    doctors = Doctor.query.all()

    hospitals = Hospital.query.all()


    total_doctors = len(doctors)

    active_doctors = Doctor.query.filter_by(
        status="active"
    ).count()


    total_specializations = db.session.query(
        Doctor.specialization
    ).distinct().count()


    total_patients_treated = 0


    return render_template(
        "doctor/doctor_list.html",

        doctors=doctors,

        hospitals=hospitals,

        total_doctors=total_doctors,

        active_doctors=active_doctors,

        total_specializations=total_specializations,

        total_patients_treated=total_patients_treated
    )



# ==========================================================
# Add Doctor
# ==========================================================

@doctor_bp.route(
    "/add",
    methods=["GET", "POST"]
)
def doctor_add():

    hospitals = Hospital.query.all()

    if request.method == "POST":

        # --------------------------------------------------
        # Read form values
        # --------------------------------------------------

        first_name = (request.form.get("first_name") or "").strip()
        last_name = (request.form.get("last_name") or "").strip()
        email = (request.form.get("email") or "").strip().lower()
        mobile = (request.form.get("mobile") or "").strip()
        gender = (request.form.get("gender") or "").strip()
        address = (request.form.get("address") or "").strip()

        hospital_id = request.form.get("hospital_id") or None
        doctor_code = (request.form.get("doctor_code") or "").strip()

        specialization = (request.form.get("specialization") or "").strip()
        qualification = (request.form.get("qualification") or "").strip()
        medical_license = (request.form.get("medical_license") or "").strip()
        about = (request.form.get("about") or "").strip()
        available_days = (request.form.get("available_days") or "").strip()
        available_time = (request.form.get("available_time") or "").strip()

        status = (request.form.get("status") or "active").strip()

        experience_value = (
            request.form.get("experience_years") or ""
        ).strip()

        consultation_fee_value = (
            request.form.get("consultation_fee") or ""
        ).strip()

        try:

            # --------------------------------------------------
            # Required field validation
            # --------------------------------------------------

            if not first_name:
                flash("First name is required.", "danger")
                return render_template(
                    "doctor/add_doctor.html",
                    hospitals=hospitals
                )

            if not last_name:
                flash("Last name is required.", "danger")
                return render_template(
                    "doctor/add_doctor.html",
                    hospitals=hospitals
                )

            if not email:
                flash("Email is required.", "danger")
                return render_template(
                    "doctor/add_doctor.html",
                    hospitals=hospitals
                )

            if not hospital_id:
                flash("Please select a hospital.", "danger")
                return render_template(
                    "doctor/add_doctor.html",
                    hospitals=hospitals
                )

            if not doctor_code:
                flash("Doctor code is required.", "danger")
                return render_template(
                    "doctor/add_doctor.html",
                    hospitals=hospitals
                )

            # --------------------------------------------------
            # Verify hospital exists
            # --------------------------------------------------

            hospital = Hospital.query.get(hospital_id)

            if not hospital:
                flash("Selected hospital was not found.", "danger")
                return render_template(
                    "doctor/add_doctor.html",
                    hospitals=hospitals
                )

            # --------------------------------------------------
            # Duplicate email check
            # --------------------------------------------------

            existing_user = User.query.filter_by(
                email=email
            ).first()

            if existing_user:
                flash(
                    "A user with this email already exists.",
                    "danger"
                )
                return render_template(
                    "doctor/add_doctor.html",
                    hospitals=hospitals
                )

            # --------------------------------------------------
            # Duplicate doctor code check
            # --------------------------------------------------

            existing_doctor = Doctor.query.filter_by(
                doctor_code=doctor_code
            ).first()

            if existing_doctor:
                flash(
                    "A doctor with this doctor code already exists.",
                    "danger"
                )
                return render_template(
                    "doctor/add_doctor.html",
                    hospitals=hospitals
                )

            # --------------------------------------------------
            # Numeric fields
            # --------------------------------------------------

            if experience_value:
                try:
                    experience_years = int(experience_value)

                    if experience_years < 0:
                        raise ValueError

                except ValueError:
                    flash(
                        "Experience years must be a valid non-negative number.",
                        "danger"
                    )
                    return render_template(
                        "doctor/add_doctor.html",
                        hospitals=hospitals
                    )
            else:
                experience_years = None

            if consultation_fee_value:
                try:
                    consultation_fee = float(
                        consultation_fee_value
                    )

                    if consultation_fee < 0:
                        raise ValueError

                except ValueError:
                    flash(
                        "Consultation fee must be a valid non-negative number.",
                        "danger"
                    )
                    return render_template(
                        "doctor/add_doctor.html",
                        hospitals=hospitals
                    )
            else:
                consultation_fee = None

            # --------------------------------------------------
            # Create User
            # --------------------------------------------------

            user = User(
                role="doctor",
                first_name=first_name,
                last_name=last_name,
                email=email,
                mobile=mobile or None,
                gender=gender or None,
                address=address or None,
                is_verified=True
            )

            user.password_hash = generate_password_hash(
                "Doctor@123"
            )

            db.session.add(user)

            # Generate user.id before creating Doctor
            db.session.flush()

            # --------------------------------------------------
            # Create Doctor
            # --------------------------------------------------

            doctor = Doctor(
                user_id=user.id,
                hospital_id=hospital.id,
                doctor_code=doctor_code,
                specialization=specialization or None,
                qualification=qualification or None,
                experience_years=experience_years,
                medical_license=medical_license or None,
                consultation_fee=consultation_fee,
                about=about or None,
                available_days=available_days or None,
                available_time=available_time or None,
                status=status or "active"
            )

            db.session.add(doctor)

            # --------------------------------------------------
            # Commit both User + Doctor together
            # --------------------------------------------------

            db.session.commit()

            flash(
                "Doctor added successfully!",
                "success"
            )

            return redirect(
                url_for("doctor.doctor_list")
            )

        except Exception as e:

            db.session.rollback()

            # Keep the actual database error visible
            flash(
                f"Unable to add doctor: {str(e)}",
                "danger"
            )

            return render_template(
                "doctor/add_doctor.html",
                hospitals=hospitals
            )

    return render_template(
        "doctor/add_doctor.html",
        hospitals=hospitals
    )




# ==========================================================
# Edit Doctor
# ==========================================================

@doctor_bp.route(
    "/edit/<string:id>",
    methods=["GET","POST"]
)
def doctor_edit(id):


    doctor = Doctor.query.get_or_404(id)

    hospitals = Hospital.query.all()



    if request.method == "POST":
        doctor.user.first_name = request.form.get("first_name")
        doctor.user.last_name = request.form.get("last_name")
        doctor.user.email = request.form.get("email")
        doctor.user.mobile = request.form.get("mobile")
        doctor.user.gender = request.form.get("gender")
        doctor.user.address = request.form.get("address")

        if request.form.get("doctor_code"):
            doctor.doctor_code = request.form.get("doctor_code")

        doctor.hospital_id = request.form.get("hospital_id") or None
        doctor.specialization = request.form.get("specialization")
        doctor.qualification = request.form.get("qualification")

        exp = request.form.get("experience_years")
        doctor.experience_years = int(exp) if exp and str(exp).strip().isdigit() else None

        doctor.medical_license = request.form.get("medical_license")

        fee = request.form.get("consultation_fee")
        doctor.consultation_fee = float(fee) if fee and str(fee).strip() else None

        doctor.about = request.form.get("about")
        doctor.available_days = request.form.get("available_days")
        doctor.available_time = request.form.get("available_time")
        doctor.status = request.form.get("status", "active")

        db.session.commit()

        flash("Doctor updated successfully!", "success")
        return redirect(url_for("doctor.doctor_list"))

    return render_template(
        "doctor/edit_doctor.html",
        doctor=doctor,
        hospitals=hospitals
    )


# ==========================================================
# Delete Doctor
# ==========================================================

@doctor_bp.route(
    "/delete/<string:id>",
    methods=["POST"]
)
def doctor_delete(id):
    doctor = Doctor.query.get_or_404(id)
    user = doctor.user

    try:
        # Clean up Doctor â†” Patient assignments
        DoctorPatient.query.filter_by(doctor_id=doctor.id).delete()

        # Unassign doctor from patients who have this doctor assigned
        Patient.query.filter_by(assigned_doctor_id=doctor.id).update({Patient.assigned_doctor_id: None})

        # Remove dependent prescriptions and appointments
        Prescription.query.filter_by(doctor_id=doctor.id).delete()
        Appointment.query.filter_by(doctor_id=doctor.id).delete()

        # Unlink reports
        Report.query.filter_by(doctor_id=doctor.id).update({Report.doctor_id: None})

        # Clean up user records
        if user:
            Notification.query.filter_by(user_id=user.id).delete()
            AuditLog.query.filter_by(user_id=user.id).delete()
            LoginHistory.query.filter_by(user_id=user.id).delete()
            db.session.delete(doctor)
            db.session.delete(user)
        else:
            db.session.delete(doctor)

        db.session.commit()
        flash("Doctor deleted successfully!", "success")

    except Exception as e:
        db.session.rollback()
        flash(str(e), "danger")

    return redirect(url_for("doctor.doctor_list"))
# ============================================================
# DOCTOR SETTINGS
#
# A doctor is also a user, so this page manages only what applies
# to a doctor's own account: portal preferences, notification
# preferences, sign-in security and password. Patient-ring options
# (auto-sync, battery alert %, data sharing) are intentionally not
# shown here.
# ============================================================

DOCTOR_LANGUAGES = [
    "English", "Tamil", "Hindi", "Malayalam", "Telugu", "Kannada"
]

DOCTOR_TIMEZONES = [
    ("Asia/Kolkata", "India Standard Time (Asia/Kolkata)"),
    ("Asia/Dubai", "Gulf Standard Time (Asia/Dubai)"),
    ("Asia/Singapore", "Singapore Time (Asia/Singapore)"),
    ("Europe/London", "UK Time (Europe/London)"),
    ("America/New_York", "US Eastern (America/New_York)"),
    ("America/Los_Angeles", "US Pacific (America/Los_Angeles)"),
    ("Australia/Sydney", "Australia Eastern (Australia/Sydney)"),
    ("UTC", "Coordinated Universal Time (UTC)"),
]

DOCTOR_NOTIFICATION_FIELDS = (
    "email_notifications",
    "sms_notifications",
    "emergency_notifications",
    "appointment_notifications",
    "report_notifications",
    "ai_notifications",
)


def _get_or_create_doctor_setting(user_id):
    """Return this user's Setting row, creating it with defaults if missing.

    Setting.id has no column default, so an id must be supplied.
    """
    setting = Setting.query.filter_by(user_id=user_id).first()

    if not setting:
        setting = Setting(id=str(uuid.uuid4()), user_id=user_id)
        db.session.add(setting)
        db.session.commit()

    return setting


def _validate_new_password(password):
    """Same strength rules as account registration."""
    if len(password) < 8:
        return "New password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return "New password must include an uppercase letter."
    if not re.search(r"[a-z]", password):
        return "New password must include a lowercase letter."
    if not re.search(r"\d", password):
        return "New password must include a number."
    return None


@doctor_bp.route("/settings", methods=["GET", "POST"])
def doctor_settings():

    user_id = session.get("user_id")

    if not user_id or session.get("role") != "doctor":
        return redirect(url_for("pages.login"))

    doctor = Doctor.query.filter_by(user_id=user_id).first()

    if not doctor:
        flash("Doctor profile not found.", "danger")
        return redirect(url_for("pages.doctor_dashboard"))

    setting = _get_or_create_doctor_setting(user_id)

    if request.method == "POST":

        section = request.form.get("section", "")

        # ---------------- Portal preferences ----------------
        if section == "preferences":

            theme = request.form.get("theme", "light")
            language = request.form.get("language", "English")
            timezone = request.form.get("timezone", "Asia/Kolkata")

            valid_timezones = {tz for tz, _ in DOCTOR_TIMEZONES}
            valid_timezones.add(setting.timezone)
            valid_languages = set(DOCTOR_LANGUAGES)
            valid_languages.add(setting.language)

            if (
                theme not in ("light", "dark")
                or language not in valid_languages
                or timezone not in valid_timezones
            ):
                flash("Please choose valid preference options.", "danger")
                return redirect(
                    url_for("doctor.doctor_settings", _anchor="preferences")
                )

            setting.theme = theme
            setting.language = language
            setting.timezone = timezone
            db.session.commit()

            flash("Preferences saved successfully.", "success")
            return redirect(
                url_for("doctor.doctor_settings", _anchor="preferences")
            )

        # ---------------- Notification preferences ----------------
        if section == "notifications":

            for field in DOCTOR_NOTIFICATION_FIELDS:
                setattr(setting, field, field in request.form)

            db.session.commit()

            flash("Notification preferences saved successfully.", "success")
            return redirect(
                url_for("doctor.doctor_settings", _anchor="notifications")
            )

        # ---------------- Sign-in security ----------------
        if section == "security":

            setting.login_alerts = "login_alerts" in request.form
            db.session.commit()

            flash("Security preferences saved successfully.", "success")
            return redirect(
                url_for("doctor.doctor_settings", _anchor="security")
            )

        # ---------------- Reset to defaults ----------------
        if section == "reset_preferences":

            setting.theme = "light"
            setting.language = "English"
            setting.timezone = "Asia/Kolkata"
            db.session.commit()

            flash("Preferences reset to defaults.", "success")
            return redirect(
                url_for("doctor.doctor_settings", _anchor="preferences")
            )

        if section == "reset_notifications":

            setting.email_notifications = True
            setting.sms_notifications = False
            setting.emergency_notifications = True
            setting.appointment_notifications = True
            setting.report_notifications = True
            setting.ai_notifications = True
            db.session.commit()

            flash("Notification preferences reset to defaults.", "success")
            return redirect(
                url_for("doctor.doctor_settings", _anchor="notifications")
            )

        flash("Invalid request.", "danger")
        return redirect(url_for("doctor.doctor_settings"))

    recent_logins = (
        LoginHistory.query
        .filter_by(user_id=user_id)
        .order_by(LoginHistory.login_time.desc())
        .limit(5)
        .all()
    )

    return render_template(
        "doctor/doctor_settings.html",
        doctor=doctor,
        setting=setting,
        languages=DOCTOR_LANGUAGES,
        timezones=DOCTOR_TIMEZONES,
        recent_logins=recent_logins
    )


@doctor_bp.route("/settings/password", methods=["POST"])
def doctor_change_password():

    user_id = session.get("user_id")

    if not user_id or session.get("role") != "doctor":
        return redirect(url_for("pages.login"))

    user = User.query.get(user_id)

    if not user:
        return redirect(url_for("pages.login"))

    current_pwd = request.form.get("current_password", "")
    new_pwd = request.form.get("new_password", "")
    confirm_pwd = request.form.get("confirm_password", "")

    back = url_for("doctor.doctor_settings", _anchor="password")

    if not check_password_hash(user.password_hash, current_pwd):
        flash("Current password is incorrect.", "danger")
        return redirect(back)

    problem = _validate_new_password(new_pwd)

    if problem:
        flash(problem, "warning")
        return redirect(back)

    if new_pwd != confirm_pwd:
        flash("New passwords do not match.", "warning")
        return redirect(back)

    if check_password_hash(user.password_hash, new_pwd):
        flash("New password must be different from the current password.", "warning")
        return redirect(back)

    user.password_hash = generate_password_hash(new_pwd)
    db.session.commit()

    flash("Password changed successfully.", "success")
    return redirect(back)
