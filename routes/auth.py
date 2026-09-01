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
)
from utils import create_and_store_otp, send_otp_email, verify_otp_code

print("===== AUTH.PY LOADED =====")

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

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
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

    print("ROLE SAVED:", session["reg_role"])
    print("SESSION:", dict(session))

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

    print("\n========== REGISTER SUBMIT ==========")
    print("SESSION:", dict(session))

    if "reg_role" not in session:
        print("ERROR: reg_role missing")
        return error("Role not found in session.", status=440)

    if "reg_personal" not in session:
        print("ERROR: reg_personal missing")
        return error("Personal information not found in session.", status=440)

    data = request.get_json(silent=True) or {}
    print("REQUEST DATA:", data)

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""
    agree_terms = data.get("agree_terms", False)

    print("Email:", email)
    print("Password:", password)
    print("Confirm:", confirm_password)
    print("Agree Terms:", agree_terms)

    if not EMAIL_REGEX.match(email):
        print("FAILED: Invalid email")
        return error("Please enter a valid email address.", field="email")

    existing = User.query.filter_by(email=email).first()
    print("Existing User:", existing)

    if existing and existing.is_verified:
        print("FAILED: Email already exists")
        return error("An account with this email already exists.", field="email")

    if len(password) < 8:
        print("FAILED: Password too short")
        return error("Password must be at least 8 characters long.", field="password")

    if not re.search(r"[A-Z]", password):
        print("FAILED: Missing uppercase")
        return error("Password must include uppercase letter.", field="password")

    if not re.search(r"[a-z]", password):
        print("FAILED: Missing lowercase")
        return error("Password must include lowercase letter.", field="password")

    if not re.search(r"\d", password):
        print("FAILED: Missing number")
        return error("Password must include a number.", field="password")

    if password != confirm_password:
        print("FAILED: Password mismatch")
        return error("Passwords do not match.", field="confirm_password")

    if not agree_terms:
        print("FAILED: Terms not accepted")
        return error("You must accept the Terms of Service.", field="agree_terms")

    print("Generating OTP...")

    session["reg_account"] = {
        "email": email,
        "password": password
    }

    try:
        otp = create_and_store_otp(email, purpose="registration")
        print("OTP:", otp)

        send_otp_email(
            email,
            otp,
            first_name=session["reg_personal"]["first_name"]
        )

        print("Email sent successfully.")

    except Exception as e:
        print("SMTP ERROR:", e)
        return error(str(e), status=500)

    print("SUCCESS")
    return ok(
        message="Verification code sent successfully.",
        data={"email": email}
    )
@auth_api.route("/register/verify-otp", methods=["POST"])
def register_verify_otp():

    if "reg_account" not in session:
        return error(
            "Your session expired. Please start registration again.",
            status=440
        )

    data = request.get_json(silent=True) or {}
    submitted_code = (data.get("otp") or "").strip()
    email = session["reg_account"]["email"]

    if (
        len(submitted_code) != current_app.config.get("OTP_LENGTH", 6)
        or not submitted_code.isdigit()
    ):
        return error("Please enter the complete 6-digit code.")

    status, _record = verify_otp_code(
        email,
        submitted_code,
        purpose="registration"
    )

    if status == "expired":
        return error(
            "This code has expired. Please request a new one.",
            status=410
        )

    if status in ("invalid", "not_found"):
        return error(
            "The code you entered is incorrect. Please try again.",
            status=401
        )

    # ---------------- Registration Data ----------------

    role = session["reg_role"]
    personal = session["reg_personal"]
    account = session["reg_account"]

    existing = User.query.filter_by(email=email).first()

    if existing and not existing.is_verified:
        db.session.delete(existing)
        db.session.commit()

    # ---------------- Create User ----------------

    user = User(
        role=role,
        first_name=personal["first_name"],
        last_name=personal["last_name"],
        email=email,
        mobile=personal["phone"],
        date_of_birth=datetime.strptime(
            personal["date_of_birth"],
            "%Y-%m-%d"
        ).date(),
        gender=personal["gender"],
        address=personal["address"],
        is_verified=True,
    )

    user.password_hash = generate_password_hash(account["password"])

    db.session.add(user)
    db.session.commit()

    # ---------------- Create Role Profile ----------------

    if role == "doctor":

        doctor = Doctor(
            user_id=user.id,
            status="active"
        )

        db.session.add(doctor)

    elif role == "patient":

        patient = Patient(
            user_id=user.id,
            status="active"
        )

        db.session.add(patient)

    elif role == "family":

        family = FamilyMember(
            user_id=user.id,
            status="active"
        )

        db.session.add(family)

    db.session.commit()

    # ---------------- Clear Session ----------------

    for key in ("reg_role", "reg_personal", "reg_account"):
        session.pop(key, None)

    return ok(
        message="Account verified and created successfully"
    )

@auth_api.route("/register/resend-otp", methods=["POST"])
def register_resend_otp():
    if "reg_account" not in session:
        return error("Your session expired. Please start registration again.", status=440)

    email = session["reg_account"]["email"]
    first_name = session.get("reg_personal", {}).get("first_name", "")

    otp_code = create_and_store_otp(email, purpose="registration")
    try:
        send_otp_email(email, otp_code, first_name=first_name)
    except Exception as exc:  # noqa: BLE001
        current_app.logger.error(f"Failed to resend OTP email: {exc}")
        return error("We couldn't resend the verification email. Please try again shortly.", status=500)

    return ok(message="A new verification code has been sent")


@auth_api.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    role = (data.get("role") or "patient").strip().lower()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    remember = bool(data.get("remember"))

    if role not in LOGIN_ROLES:
        return error("Invalid account type selected.", field="role")

    if not EMAIL_REGEX.match(email):
        return error("Please enter a valid email address.", field="email")

    if not password:
        return error("Please enter your password.", field="password")

    user = User.query.filter_by(
        email=email,
        role=role
    ).first()

    if not user or not user.check_password(password):
        return error("Invalid email or password.", status=401)

    if not user.is_verified:
        return error("Please verify your email before signing in.", status=403)

    session.permanent = remember

    session["user"] = {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }

    session["user_id"] = user.id
    session["role"] = user.role

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
        otp_code = create_and_store_otp(email, purpose="password_reset")
        try:
            send_otp_email(email, otp_code, first_name=user.first_name, purpose="password_reset")
        except Exception as exc:  # noqa: BLE001
            current_app.logger.error(f"Failed to send password reset OTP: {exc}")
            return error("We couldn't send the reset email. Please try again shortly.", status=500)

    session["reset_email"] = email
    return ok(message="If that email is registered, a reset code has been sent.")


@auth_api.route("/forgot-password/verify-otp", methods=["POST"])
def forgot_password_verify_otp():
    if "reset_email" not in session:
        return error("Your session expired. Please start again.", status=440)

    data = request.get_json(silent=True) or {}
    submitted_code = (data.get("otp") or "").strip()
    email = session["reset_email"]

    status, _record = verify_otp_code(email, submitted_code, purpose="password_reset")

    if status == "expired":
        return error("This code has expired. Please request a new one.", status=410)
    if status in ("invalid", "not_found"):
        return error("The code you entered is incorrect. Please try again.", status=401)

    session["reset_verified"] = True
    return ok(message="Code verified. You can now set a new password.")


@auth_api.route("/forgot-password/reset", methods=["POST"])
def forgot_password_reset():
    if not session.get("reset_verified") or "reset_email" not in session:
        return error("Please verify your email and code first.", status=440)

    data = request.get_json(silent=True) or {}
    new_password = data.get("new_password") or ""
    confirm_password = data.get("confirm_password") or ""

    if len(new_password) < 8:
        return error("Password must be at least 8 characters long.", field="new_password")
    if new_password != confirm_password:
        return error("Passwords do not match.", field="confirm_password")

    email = session["reset_email"]
    user = User.query.filter_by(email=email, is_verified=True).first()
    if not user:
        return error("Account not found.", status=404)

    user.set_password(new_password)
    db.session.commit()

    session.pop("reset_email", None)
    session.pop("reset_verified", None)

    return ok(message="Password updated successfully. Please sign in.")
