import random
import string
from datetime import datetime, timedelta
from flask import current_app, render_template
from flask_mail import Message
from database import db, mail
from models import OTP


def generate_otp(length=6):
    """Generate a cryptographically reasonable numeric OTP."""
    return "".join(random.SystemRandom().choice(string.digits) for _ in range(length))


def create_and_store_otp(email, purpose="registration"):
    """Create a new OTP record for the given email + purpose and persist it."""
    length = current_app.config.get("OTP_LENGTH", 6)
    expiry_minutes = current_app.config.get("OTP_EXPIRY_MINUTES", 5)

    # Invalidate previous unused OTPs for this email/purpose
    OTP.query.filter_by(email=email, purpose=purpose, is_used=False).update(
        {"is_used": True}
    )

    code = generate_otp(length)
    otp_record = OTP(
        email=email,
        otp=code,
        purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=expiry_minutes),
    )
    db.session.add(otp_record)
    db.session.commit()
    return code


def send_otp_email(email, otp_code, first_name="", purpose="registration"):
    """Send the OTP code to the user's Gmail address via Flask-Mail."""
    if purpose == "registration":
        subject = "Health Ring - Verify Your Email"
        heading = "Verify your email address"
    else:
        subject = "Health Ring - Password Reset Code"
        heading = "Reset your password"

    html_body = render_template(
        "email/otp_email.html",
        otp_code=otp_code,
        heading=heading,
        first_name=first_name or "there",
    )

    msg = Message(subject=subject, recipients=[email], html=html_body)
    mail.send(msg)


def verify_otp_code(email, submitted_code, purpose="registration"):
    """
    Verify a submitted OTP against the most recent active OTP for this email/purpose.
    Returns a tuple: (status, otp_record)
    status is one of: 'valid', 'invalid', 'expired', 'not_found'
    """
    otp_record = (
        OTP.query.filter_by(email=email, purpose=purpose, is_used=False)
        .order_by(OTP.created_at.desc())
        .first()
    )

    if not otp_record:
        return "not_found", None

    if otp_record.is_expired():
        return "expired", otp_record

    if otp_record.otp != submitted_code:
        return "invalid", otp_record

    otp_record.is_used = True
    db.session.commit()
    return "valid", otp_record
