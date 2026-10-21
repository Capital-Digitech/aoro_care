import hashlib
import hmac
import random
import re
import string
from datetime import datetime, timedelta
from flask import current_app, render_template
from flask_mail import Message
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from database import db, mail
from models import OTP, User


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

    if not hmac.compare_digest(str(otp_record.otp), str(submitted_code)):
        return "invalid", otp_record

    otp_record.is_used = True
    db.session.commit()
    return "valid", otp_record


# ----------------------------------------------------------------------
# Doctor account activation (admin-created doctors)
# ----------------------------------------------------------------------
ACTIVATION_MAX_AGE_SECONDS = 72 * 60 * 60  # activation link is valid for 72 hours


def _activation_serializer():
    return URLSafeTimedSerializer(
        current_app.config["SECRET_KEY"], salt="doctor-account-activation"
    )


def _password_fingerprint(user):
    return hashlib.sha256((user.password_hash or "").encode("utf-8")).hexdigest()[:20]


def generate_activation_token(user):
    """Signed, expiring token. It embeds a fingerprint of the current password
    hash, so it stops working as soon as the password is set (single use)."""
    return _activation_serializer().dumps(
        {"uid": user.id, "fp": _password_fingerprint(user)}
    )


def load_activation_user(token, allowed_roles=("doctor",)):
    """Validate a signed, expiring, single-use activation token."""
    try:
        data = _activation_serializer().loads(
            token,
            max_age=ACTIVATION_MAX_AGE_SECONDS,
        )
    except SignatureExpired:
        return None, "expired"
    except BadSignature:
        return None, "invalid"

    user = db.session.get(User, data.get("uid"))

    if (
        not user
        or user.role not in allowed_roles
        or not hmac.compare_digest(
            data.get("fp", ""),
            _password_fingerprint(user),
        )
    ):
        return None, "invalid"

    return user, "valid"



def send_activation_email(user, activation_url):
    """Send an account activation email for a supported role."""
    if user.role == "admin":
        template = "email/admin_activation.html"
        subject = "aoro Care - Activate Your Admin Account"
        fallback_name = "Admin"
    elif user.role == "doctor":
        template = "email/doctor_activation.html"
        subject = "Health Ring - Activate Your Doctor Account"
        fallback_name = "Doctor"
    else:
        raise ValueError("Unsupported account activation role.")

    html_body = render_template(
        template,
        first_name=user.first_name or fallback_name,
        activation_url=activation_url,
        valid_hours=ACTIVATION_MAX_AGE_SECONDS // 3600,
    )

    text_body = (
        f"Hello {user.first_name or fallback_name},\n\n"
        "Your account has been created. Use the link below "
        "to set your password and activate your account:\n\n"
        f"{activation_url}\n\n"
        f"This link expires in {ACTIVATION_MAX_AGE_SECONDS // 3600} hours."
    )

    msg = Message(
        subject=subject,
        recipients=[user.email],
        body=text_body,
        html=html_body,
    )
    mail.send(msg)

# ----------------------------------------------------------------------
# Hospital Scoping Helper (Admin vs. Super Admin data separation)
# ----------------------------------------------------------------------
class HospitalScope:
    def __init__(self, user=None):
        from flask import session, has_request_context
        from database import db
        from models import (
            User,
            Doctor,
            Patient,
            DoctorPatient,
            Appointment,
            Hospital,
        )
        from sqlalchemy import select as sa_select, union as sa_union, false as sa_false

        session_user = session.get("user") or {} if has_request_context() else {}
        role = None
        user_id = None
        if has_request_context():
            role = session.get("role") or (
                session_user.get("role") if isinstance(session_user, dict)
                else getattr(session_user, "role", None)
            )
            user_id = session.get("user_id") or (
                session_user.get("id") if isinstance(session_user, dict)
                else getattr(session_user, "id", None)
            )

        if user is None and user_id:
            user = User.query.get(user_id)
        elif user and not role:
            role = user.role

        self.role = role
        self.user = user
        self.is_super_admin = (role == "super_admin")
        self.is_admin = (role == "admin")

        if self.is_super_admin:
            self.hospital_id = None
            self.hospital = None
            self.unassigned = False
            self.doctor_ids = None
            self.patient_ids = None
            self.user_ids = None
        elif self.is_admin:
            self.hospital_id = user.hospital_id if user else None
            self.hospital = user.hospital if user else None
            self.unassigned = not bool(self.hospital_id)

            if self.unassigned:
                self.doctor_ids = sa_select(Doctor.id).where(sa_false())
                self.patient_ids = sa_select(Patient.id).where(sa_false())
                self.user_ids = sa_select(User.id).where(sa_false())
            else:
                hid = self.hospital_id
                self.doctor_ids = sa_select(Doctor.id).where(Doctor.hospital_id == hid)
                self.patient_ids = sa_union(
                    sa_select(Patient.id).join(User, Patient.user_id == User.id).where(User.hospital_id == hid),
                    sa_select(Patient.id).where(Patient.assigned_doctor_id.in_(self.doctor_ids)),
                    sa_select(DoctorPatient.patient_id).where(
                        DoctorPatient.doctor_id.in_(self.doctor_ids),
                        DoctorPatient.status == "active",
                    ),
                    sa_select(Appointment.patient_id).where(
                        Appointment.hospital_id == hid
                    ),
                )
                self.user_ids = sa_union(
                    sa_select(User.id).where(User.hospital_id == hid),
                    sa_select(Doctor.user_id).where(Doctor.hospital_id == hid),
                    sa_select(Patient.user_id).where(Patient.id.in_(self.patient_ids)),
                    sa_select(User.id).where(User.id == user.id) if user else sa_select(User.id).where(sa_false()),
                )
        else:
            self.hospital_id = None
            self.hospital = None
            self.unassigned = True
            self.doctor_ids = sa_select(Doctor.id).where(sa_false())
            self.patient_ids = sa_select(Patient.id).where(sa_false())
            self.user_ids = sa_select(User.id).where(sa_false())

    def filter_doctors(self, query):
        from sqlalchemy import false as sa_false
        from models import Doctor
        if self.is_super_admin:
            return query
        if self.unassigned:
            return query.filter(sa_false())
        return query.filter(Doctor.hospital_id == self.hospital_id)

    def filter_patients(self, query):
        from sqlalchemy import false as sa_false
        from models import Patient
        if self.is_super_admin:
            return query
        if self.unassigned:
            return query.filter(sa_false())
        return query.filter(Patient.id.in_(self.patient_ids))

    def filter_appointments(self, query):
        from sqlalchemy import false as sa_false
        from models import Appointment
        if self.is_super_admin:
            return query
        if self.unassigned:
            return query.filter(sa_false())
        return query.filter(Appointment.hospital_id == self.hospital_id)

    def filter_rings(self, query):
        from sqlalchemy import false as sa_false
        from models import HealthRing
        if self.is_super_admin:
            return query
        if self.unassigned:
            return query.filter(sa_false())
        return query.filter(HealthRing.patient_id.in_(self.patient_ids))

    def filter_reports(self, query):
        from sqlalchemy import false as sa_false
        from models import Report
        from database import db
        if self.is_super_admin:
            return query
        if self.unassigned:
            return query.filter(sa_false())
        return query.filter(
            db.or_(
                Report.patient_id.in_(self.patient_ids),
                Report.doctor_id.in_(self.doctor_ids),
            )
        )

    def filter_alerts(self, query):
        from sqlalchemy import false as sa_false
        from models import EmergencyAlert
        if self.is_super_admin:
            return query
        if self.unassigned:
            return query.filter(sa_false())
        return query.filter(EmergencyAlert.patient_id.in_(self.patient_ids))

    def filter_insights(self, query):
        from sqlalchemy import false as sa_false
        from models import AIInsight
        if self.is_super_admin:
            return query
        if self.unassigned:
            return query.filter(sa_false())
        return query.filter(AIInsight.patient_id.in_(self.patient_ids))

    def filter_notifications(self, query):
        from sqlalchemy import false as sa_false
        from models import Notification
        if self.is_super_admin:
            return query
        if self.unassigned:
            return query.filter(sa_false())
        return query.filter(Notification.user_id.in_(self.user_ids))

    def filter_health_data(self, query):
        from sqlalchemy import false as sa_false
        from models import HealthData
        if self.is_super_admin:
            return query
        if self.unassigned:
            return query.filter(sa_false())
        return query.filter(HealthData.patient_id.in_(self.patient_ids))

    def filter_hospitals(self, query):
        from sqlalchemy import false as sa_false
        from models import Hospital
        if self.is_super_admin:
            return query
        if self.unassigned:
            return query.filter(sa_false())
        return query.filter(Hospital.id == self.hospital_id)

    def can_access_doctor(self, doctor):
        if self.is_super_admin:
            return True
        if self.unassigned or not doctor:
            return False
        return doctor.hospital_id == self.hospital_id

    def can_access_patient(self, patient):
        if self.is_super_admin:
            return True
        if self.unassigned or not patient:
            return False
        from database import db
        from models import Patient
        return bool(
            db.session.query(
                Patient.query.filter(
                    Patient.id == patient.id,
                    Patient.id.in_(self.patient_ids)
                ).exists()
            ).scalar()
        )

    def can_access_appointment(self, appointment):
        if self.is_super_admin:
            return True
        if self.unassigned or not appointment:
            return False
        return appointment.hospital_id == self.hospital_id

    def can_access_ring(self, ring):
        if self.is_super_admin:
            return True
        if self.unassigned or not ring:
            return False
        from database import db
        from models import Patient
        return bool(
            db.session.query(
                Patient.query.filter(
                    Patient.id == ring.patient_id,
                    Patient.id.in_(self.patient_ids)
                ).exists()
            ).scalar()
        )

    def can_access_report(self, report):
        if self.is_super_admin:
            return True
        if self.unassigned or not report:
            return False
        from database import db
        if report.patient_id:
            from models import Patient
            if db.session.query(Patient.query.filter(Patient.id == report.patient_id, Patient.id.in_(self.patient_ids)).exists()).scalar():
                return True
        if report.doctor_id:
            from models import Doctor
            if db.session.query(Doctor.query.filter(Doctor.id == report.doctor_id, Doctor.id.in_(self.doctor_ids)).exists()).scalar():
                return True
        return False

    def can_access_alert(self, alert):
        if self.is_super_admin:
            return True
        if self.unassigned or not alert:
            return False
        from database import db
        from models import Patient
        return bool(
            db.session.query(
                Patient.query.filter(
                    Patient.id == alert.patient_id,
                    Patient.id.in_(self.patient_ids)
                ).exists()
            ).scalar()
        )

    def can_access_insight(self, insight):
        if self.is_super_admin:
            return True
        if self.unassigned or not insight:
            return False
        from database import db
        from models import Patient
        return bool(
            db.session.query(
                Patient.query.filter(
                    Patient.id == insight.patient_id,
                    Patient.id.in_(self.patient_ids)
                ).exists()
            ).scalar()
        )

    def can_access_notification(self, notification):
        if self.is_super_admin:
            return True
        if self.unassigned or not notification:
            return False
        from database import db
        from models import User
        return bool(
            db.session.query(
                User.query.filter(
                    User.id == notification.user_id,
                    User.id.in_(self.user_ids)
                ).exists()
            ).scalar()
        )

    def can_access_health_data(self, record):
        if self.is_super_admin:
            return True
        if self.unassigned or not record:
            return False
        from database import db
        from models import Patient
        return bool(
            db.session.query(
                Patient.query.filter(
                    Patient.id == record.patient_id,
                    Patient.id.in_(self.patient_ids)
                ).exists()
            ).scalar()
        )

    def can_access_hospital(self, hospital):
        if self.is_super_admin:
            return True
        if self.unassigned or not hospital:
            return False
        return hospital.id == self.hospital_id


def get_hospital_scope(user=None):
    return HospitalScope(user=user)
