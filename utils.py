import random
import re
import string
from datetime import datetime, timedelta
from flask import current_app, render_template
from flask_mail import Message
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from database import db, mail
from models import OTP


def generate_otp(length=6):
    """Generate a cryptographically reasonable numeric OTP."""
    return "".join(random.SystemRandom().choice(string.digits) for _ in range(length))


def resync_pk_sequence(table, column="id"):
    """
    PostgreSQL only: move the auto-increment sequence of table.column to
    MAX(column) + 1.

    After rows are copied in with explicit ids (e.g. the MySQL -> PostgreSQL
    migration) the sequence stays behind, and every new INSERT fails with
    'duplicate key value violates unique constraint "<table>_pkey"'.
    `table` / `column` are fixed names from our own code, never user input.
    """
    if db.engine.dialect.name != "postgresql":
        return False

    sequence = db.session.execute(
        text("SELECT pg_get_serial_sequence(:t, :c)"),
        {"t": table, "c": column},
    ).scalar()

    if not sequence:
        # Sequence exists but is not "owned" by the column: read it from the default
        default = db.session.execute(
            text(
                "SELECT column_default FROM information_schema.columns "
                "WHERE table_schema = current_schema() "
                "AND table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).scalar()
        match = re.search(r"nextval\('(.+?)'::regclass\)", default or "")
        sequence = match.group(1) if match else None

    if not sequence:
        return False

    db.session.execute(
        text(
            "SELECT setval(CAST(:seq AS regclass), "
            f'COALESCE((SELECT MAX("{column}") FROM "{table}"), 0) + 1, false)'
        ),
        {"seq": sequence},
    )
    db.session.commit()
    return True


def create_and_store_otp(email, purpose="registration"):
    """Create a new OTP record for the given email + purpose and persist it."""
    length = current_app.config.get("OTP_LENGTH", 6)
    expiry_minutes = current_app.config.get("OTP_EXPIRY_MINUTES", 5)

    code = generate_otp(length)

    for attempt in (1, 2):
        try:
            # Invalidate previous unused OTPs for this email/purpose
            OTP.query.filter_by(email=email, purpose=purpose, is_used=False).update(
                {"is_used": True}
            )

            otp_record = OTP(
                email=email,
                otp=code,
                purpose=purpose,
                expires_at=datetime.utcnow() + timedelta(minutes=expiry_minutes),
            )
            db.session.add(otp_record)
            db.session.commit()
            return code

        except IntegrityError as exc:
            db.session.rollback()

            # Only the "id sequence is behind the data" case is healed, once.
            if attempt == 2 or "otps_pkey" not in str(exc.orig):
                raise

            current_app.logger.warning(
                "otps id sequence was behind the data - resyncing and retrying."
            )
            resync_pk_sequence("otps", "id")


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
