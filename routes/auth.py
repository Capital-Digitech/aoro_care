import re
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, session, current_app, redirect, url_for
from werkzeug.security import generate_password_hash

from database import db, csrf     # <-- import csrf
from models import (
    User,
    OTP,
    Doctor,
    Patient,
    FamilyMember,
    LoginHistory,
)
from utils import create_and_store_otp, send_otp_email, verify_otp_code

auth_api = Blueprint("auth_api", __name__, url_prefix="/api")

# Exempt all API routes in this blueprint from CSRF protection
csrf.exempt(auth_api)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
VALID_ROLES = {"patient", "doctor", "family"}
LOGIN_ROLES = {
    "patient",
    "doctor",
    "family",
    "admin",
    "super_admin"
}

MAX_OTP_ATTEMPTS = 5
RESET_OTP_COOLDOWN_SECONDS = 30


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def password_error(password):
    """Shared password rules (registration, reset). Returns a message or None."""
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return "Password must include uppercase letter."
    if not re.search(r"[a-z]", password):
        return "Password must include lowercase letter."
    if not re.search(r"\d", password):
        return "Password must include a number."
    return None


def error(message, status=400, field=None):
    payload = {"success": False, "message": message}
    if field:
        payload["field"] = field
    return jsonify(payload), status


def ok(data=None, message=None):
    payload = {"success": True}
    if message:
        payload["message"] = message
    if data:
        payload["data"] = data
    return jsonify(payload), 200


@auth_api.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("pages.login"))


# ------------------------------------------------------------------
# Registration Wizard - Step by step server-side validation
# ------------------------------------------------------------------
@auth_api.route("/register/validate-role", methods=["POST"])
def validate_role():
    data = request.get_json(silent=True) or {}

    role = (data.get("role") or "").strip().lower()

    if role not in VALID_ROLES:
        return error(
            "Please select a valid role.",
            field="role"
        )

    # Save selected role in session
    session["reg_role"] = role

    return ok(message="Role saved successfully.")

@auth_api.route("/register/validate-personal", methods=["POST"])
def validate_personal():
    data = request.get_json(silent=True) or {}
    required = ["first_name", "last_name", "date_of_birth", "gender", "phone", "address"]
    for field in required:
        if not (data.get(field) or "").strip():
            return error(f"{field.replace('_', ' ').title()} is required.", field=field)

    try:
        dob = datetime.strptime(data["date_of_birth"], "%Y-%m-%d").date()
    except ValueError:
        return error("Please enter a valid date of birth.", field="date_of_birth")

    if dob >= datetime.utcnow().date():
        return error("Date of birth must be in the past.", field="date_of_birth")

    phone_digits = re.sub(r"\D", "", data["phone"])
    if len(phone_digits) < 7:
        return error("Please enter a valid phone number.", field="phone")

    session["reg_personal"] = {
        "first_name": data["first_name"].strip(),
        "last_name": data["last_name"].strip(),
        "date_of_birth": data["date_of_birth"],
        "gender": data["gender"].strip(),
        "phone": data["phone"].strip(),
        "address": data["address"].strip(),
    }
    return ok(message="Personal information saved")


@auth_api.route("/register/check-email", methods=["POST"])
def check_email():
    """Used for live email-uniqueness validation on Step 3."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not EMAIL_REGEX.match(email):
        return error("Please enter a valid email address.", field="email")

    existing = User.query.filter_by(email=email).first()
    if existing and existing.is_verified:
        return error("An account with this email already exists.", field="email")

    return ok(message="Email is available")


@auth_api.route("/register/submit", methods=["POST"])
def register_submit():
    if "reg_role" not in session:
        return error("Role not found in session.", status=440)

    if "reg_personal" not in session:
        return error("Personal information not found in session.", status=440)

    if session["reg_role"] not in VALID_ROLES:
        return error("Invalid registration role. Please start again.", status=440)

    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""
    agree_terms = data.get("agree_terms", False)

    if not EMAIL_REGEX.match(email):
        return error("Please enter a valid email address.", field="email")

    existing = User.query.filter_by(email=email).first()
    if existing and existing.is_verified:
        return error("An account with this email already exists.", field="email")

    pw_problem = password_error(password)
    if pw_problem:
        return error(pw_problem, field="password")

    if password != confirm_password:
        return error("Passwords do not match.", field="confirm_password")

    if not agree_terms:
        return error("You must accept the Terms of Service.", field="agree_terms")

    # Keep only the hash in the (client-visible) session cookie, never the plain password.
    session["reg_account"] = {
        "email": email,
        "password_hash": generate_password_hash(password),
    }

    try:
        otp = create_and_store_otp(email, purpose="registration")
        send_otp_email(
            email,
            otp,
            first_name=session["reg_personal"]["first_name"]
        )
    except Exception:
        current_app.logger.exception("Failed to send registration OTP email.")
        return error(
            "We couldn't send the verification email. Please try again shortly.",
            status=500
        )

    return ok(
        message="Verification code sent successfully.",
        data={"email": email}
    )


@auth_api.route("/register/verify-otp", methods=["POST"])
def register_verify_otp():
    required_keys = ("reg_role", "reg_personal", "reg_account")
    if not all(key in session for key in required_keys):
        return error(
            "Your session expired. Please start registration again.",
            status=440
        )
    account = session["reg_account"]
    personal = session["reg_personal"]
    role = session["reg_role"]
    email = (account.get("email") or "").strip().lower()
    submitted_code = (
        (request.get_json(silent=True) or {}).get("otp") or ""
    ).strip()
    if role not in VALID_ROLES:
        return error("Invalid registration role. Please start again.")
    if (
        len(submitted_code) != current_app.config.get("OTP_LENGTH", 6)
        or not submitted_code.isdigit()
    ):
        return error("Please enter the complete 6-digit code.")
    # Do not create a second account for an already verified email.
    existing = User.query.filter_by(email=email).first()
    if existing and existing.is_verified:
        for key in required_keys:
            session.pop(key, None)
        return error(
            "An account with this email already exists. Please sign in.",
            status=409
        )
    otp_status, _record = verify_otp_code(
        email, submitted_code, purpose="registration"
    )
    if otp_status == "expired":
        return error(
            "This code has expired. Please request a new one.",
            status=410
        )
    if otp_status in ("invalid", "not_found"):
        return error(
            "The code you entered is incorrect. Please try again.",
            status=401
        )
    try:
        # Reuse an existing unverified account instead of deleting it.
        user = existing
        if user is None:
            user = User(
                role=role,
                first_name=personal["first_name"],
                last_name=personal["last_name"],
                email=email,
                mobile=personal["phone"],
                date_of_birth=datetime.strptime(
                    personal["date_of_birth"], "%Y-%m-%d"
                ).date(),
                gender=personal["gender"],
                address=personal["address"],
                is_verified=True,
            )
            user.password_hash = account["password_hash"]
            db.session.add(user)
        else:
            user.role = role
            user.first_name = personal["first_name"]
            user.last_name = personal["last_name"]
            user.mobile = personal["phone"]
            user.date_of_birth = datetime.strptime(
                personal["date_of_birth"], "%Y-%m-%d"
            ).date()
            user.gender = personal["gender"]
            user.address = personal["address"]
            user.password_hash = account["password_hash"]
            user.is_verified = True
        db.session.flush()
        # Create only the missing role profile.
        if role == "doctor":
            if not Doctor.query.filter_by(user_id=user.id).first():
                # Public doctor sign-ups must be approved by an admin before login.
                db.session.add(Doctor(user_id=user.id, status="pending"))
        elif role == "patient":
            if not Patient.query.filter_by(user_id=user.id).first():
                db.session.add(Patient(user_id=user.id, status="active"))
        elif role == "family":
            if not FamilyMember.query.filter_by(user_id=user.id).first():
                # FamilyMember.status is a read-only property, not a DB column.
                db.session.add(FamilyMember(user_id=user.id))
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Registration account creation failed.")
        return error(
            "We couldn't create your account. Please try again.",
            status=500
        )
    for key in required_keys:
        session.pop(key, None)
    if role == "doctor":
        return ok(
            message="Email verified! Your account is awaiting admin approval. "
                    "You can sign in once it has been approved."
        )
    return ok(message="Email verified! Your account is now active.")
@auth_api.route("/register/resend-otp", methods=["POST"])
def register_resend_otp():
    if "reg_account" not in session:
        return error("Your session expired. Please start registration again.", status=440)

    email = session["reg_account"]["email"]
    first_name = session.get("reg_personal", {}).get("first_name", "")

    try:
        otp_code = create_and_store_otp(email, purpose="registration")
        send_otp_email(email, otp_code, first_name=first_name)
    except Exception as exc:  # noqa: BLE001
        current_app.logger.error(f"Failed to resend OTP email: {exc}")
        return error("We couldn't resend the verification email. Please try again shortly.", status=500)

    return ok(message="A new verification code has been sent")



@auth_api.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    remember = bool(data.get("remember_me"))
    
    # Validate email
    if not EMAIL_REGEX.match(email):
        return error(
            "Please enter a valid email address.",
            field="email"
        )

    # Validate password
    if not password:
        return error(
            "Please enter your password.",
            field="password"
        )

    # Find user ONLY by email
    # Role is automatically detected from the database
    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return error(
            "Invalid email or password.",
            status=401
        )

    # Check email verification
    if not user.is_verified:
        return error(
            "Please verify your email before signing in.",
            status=403
        )

    # Doctors who registered publicly must be approved by an admin first
    if user.role == "doctor":
        doctor_profile = Doctor.query.filter_by(user_id=user.id).first()
        if doctor_profile and doctor_profile.status == "pending":
            return error(
                "Your doctor account is awaiting admin approval. "
                "You can sign in once it has been approved.",
                status=403
            )

    # Remember me
    session.permanent = remember

    # Store user session
    session["user"] = {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }

    session["user_id"] = user.id
    session["role"] = user.role

    # Record login history
    try:
        user_agent = request.user_agent

        browser_info = (
            f"{user_agent.browser.title()} {user_agent.version}"
            if user_agent.browser
            else "Web Browser"
        )

        os_info = (
            user_agent.platform.title()
            if user_agent.platform
            else "Unknown OS"
        )

        device_info = (
            "Mobile"
            if user_agent.platform in ["android", "iphone", "ipad"]
            else "Desktop"
        )

        login_log = LoginHistory(
            user_id=user.id,
            login_time=datetime.utcnow(),
            ip_address=request.headers.get(
                "X-Forwarded-For",
                request.remote_addr or "127.0.0.1"
            ).split(",")[0].strip(),
            device_name=device_info,
            browser=browser_info,
            operating_system=os_info,
            login_status="success"
        )

        db.session.add(login_log)
        db.session.commit()

    except Exception as e:
        db.session.rollback()
        current_app.logger.warning(
            f"Could not record login history: {e}"
        )

    # Automatically redirect based on database role
    if user.role == "patient":
        redirect_url = "/patient-dashboard"

    elif user.role == "doctor":
        redirect_url = "/doctor-dashboard"

    elif user.role == "family":
        redirect_url = "/family-dashboard"

    elif user.role == "admin":
        redirect_url = "/admin-dashboard"

    elif user.role == "super_admin":
        redirect_url = "/super-admin-dashboard"

    else:
        redirect_url = "/dashboard"

    return ok(
        message="Signed in successfully",
        data={
            "redirect": redirect_url
        }
    )


# ------------------------------------------------------------------
# Forgot Password
# ------------------------------------------------------------------
@auth_api.route("/forgot-password/send-otp", methods=["POST"])
def forgot_password_send_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not EMAIL_REGEX.match(email):
        return error("Please enter a valid email address.", field="email")

    user = User.query.filter_by(email=email, is_verified=True).first()
    # To avoid user enumeration, always respond success-looking message,
    # but only actually send if the user exists.
    if user:
        # Throttle: don't send another code if one was issued moments ago.
        recent = OTP.query.filter(
            OTP.email == email,
            OTP.purpose == "password_reset",
            OTP.created_at > datetime.utcnow() - timedelta(seconds=RESET_OTP_COOLDOWN_SECONDS),
        ).first()
        if recent:
            session["reset_email"] = email
            session.pop("reset_verified", None)
            return ok(message="If that email is registered, a reset code has been sent.")
        try:
            otp_code = create_and_store_otp(email, purpose="password_reset")
            send_otp_email(email, otp_code, first_name=user.first_name, purpose="password_reset")
        except Exception as exc:  # noqa: BLE001
            current_app.logger.error(f"Failed to send password reset OTP: {exc}")
            return error("We couldn't send the reset email. Please try again shortly.", status=500)

    session["reset_email"] = email
    session.pop("reset_verified", None)
    session.pop("reset_attempts", None)
    return ok(message="If that email is registered, a reset code has been sent.")


@auth_api.route("/forgot-password/verify-otp", methods=["POST"])
def forgot_password_verify_otp():
    if "reset_email" not in session:
        return error("Your session expired. Please start again.", status=440)

    data = request.get_json(silent=True) or {}
    submitted_code = (data.get("otp") or "").strip()
    email = session["reset_email"]

    attempts = session.get("reset_attempts", 0)
    if attempts >= MAX_OTP_ATTEMPTS:
        return error("Too many incorrect attempts. Please request a new code.", status=429)

    status, _record = verify_otp_code(email, submitted_code, purpose="password_reset")

    if status == "expired":
        return error("This code has expired. Please request a new one.", status=410)
    if status in ("invalid", "not_found"):
        session["reset_attempts"] = attempts + 1
        return error("The code you entered is incorrect. Please try again.", status=401)

    session["reset_verified"] = True
    session.pop("reset_attempts", None)
    return ok(message="Code verified. You can now set a new password.")


@auth_api.route("/forgot-password/reset", methods=["POST"])
def forgot_password_reset():
    if not session.get("reset_verified") or "reset_email" not in session:
        return error("Please verify your email and code first.", status=440)

    data = request.get_json(silent=True) or {}
    new_password = data.get("new_password") or ""
    confirm_password = data.get("confirm_password") or ""

    pw_problem = password_error(new_password)
    if pw_problem:
        return error(pw_problem, field="new_password")
    if new_password != confirm_password:
        return error("Passwords do not match.", field="confirm_password")

    email = session["reset_email"]
    user = User.query.filter_by(email=email, is_verified=True).first()
    if not user:
        return error("Account not found.", status=404)

    try:
        user.set_password(new_password)
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Password reset failed.")
        return error("We couldn't update your password. Please try again.", status=500)

    session.pop("reset_email", None)
    session.pop("reset_verified", None)
    session.pop("reset_attempts", None)

    return ok(message="Password updated successfully. Please sign in.")