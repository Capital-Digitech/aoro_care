import uuid
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

from database import db



# ==========================================================
# Helper
# ==========================================================

def gen_uuid():
    return str(uuid.uuid4())


# ==========================================================
# USERS
# ==========================================================

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)

    role = db.Column(db.String(20), nullable=False)

    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)

    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    mobile = db.Column(db.String(30))

    date_of_birth = db.Column(db.Date)
    gender = db.Column(db.String(20))
    address = db.Column(db.String(255))

    password_hash = db.Column(db.String(255), nullable=False)

    is_verified = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # ---------------- Password ----------------

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    # ---------------- Relationships ----------------

    doctor_profile = db.relationship(
        "Doctor",
        back_populates="user",
        uselist=False,
        cascade="all, delete"
    )

    patient_profile = db.relationship(
        "Patient",
        back_populates="user",
        uselist=False,
        cascade="all, delete"
    )

    family_profile = db.relationship(
        "FamilyMember",
        back_populates="user",
        uselist=False,
        cascade="all, delete"
    )

    notifications = db.relationship(
        "Notification",
        back_populates="user"
    )

    login_history = db.relationship(
        "LoginHistory",
        back_populates="user"
    )

    audit_logs = db.relationship(
        "AuditLog",
        back_populates="user"
    )
    setting = db.relationship(
    "Setting",
    back_populates="user",
    uselist=False,
    cascade="all, delete-orphan"
)
    


# ==========================================================
# OTP
# ==========================================================

class OTP(db.Model):
    __tablename__ = "otps"

    id = db.Column(db.Integer, primary_key=True)

    email = db.Column(db.String(255), nullable=False)

    otp = db.Column(db.String(10), nullable=False)

    purpose = db.Column(
        db.String(30),
        nullable=False,
        default="registration"
    )

    expires_at = db.Column(db.DateTime, nullable=False)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    is_used = db.Column(
        db.Boolean,
        default=False
    )

    def is_expired(self):
        return datetime.utcnow() > self.expires_at
#==========================hospital-------------
class Hospital(db.Model):
    __tablename__ = "hospitals"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=gen_uuid
    )

    hospital_name = db.Column(db.String(150), nullable=False)
    hospital_code = db.Column(db.String(20), unique=True)
    email = db.Column(db.String(150))
    phone = db.Column(db.String(20))
    address = db.Column(db.Text)
    city = db.Column(db.String(100))
    state = db.Column(db.String(100))
    country = db.Column(db.String(100))
    pincode = db.Column(db.String(15))
    website = db.Column(db.String(255))
    license_number = db.Column(db.String(100))
    established_year = db.Column(db.Integer)
    status = db.Column(db.String(20), default="active")

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    doctors = db.relationship(
        "Doctor",
        back_populates="hospital"
    )
    appointments = db.relationship(
        "Appointment",
        back_populates="hospital"
    )
# ==========================================================
# DOCTORS
# ==========================================================

class Doctor(db.Model):
    __tablename__ = "doctors"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=gen_uuid
    )

    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id"),
        nullable=False,
        unique=True
    )

    hospital_id = db.Column(
        db.String(36),
        db.ForeignKey("hospitals.id")
    )

    doctor_code = db.Column(
        db.String(20),
        unique=True
    )

    specialization = db.Column(
        db.String(100)
    )

    qualification = db.Column(
        db.String(150)
    )

    experience_years = db.Column(
        db.Integer
    )

    medical_license = db.Column(
        db.String(100)
    )

    consultation_fee = db.Column(
        db.Numeric(10, 2)
    )

    about = db.Column(
        db.Text
    )

    available_days = db.Column(
        db.String(100)
    )

    available_time = db.Column(
        db.String(100)
    )

    status = db.Column(
        db.String(20),
        default="active"
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    user = db.relationship(
        "User",
        back_populates="doctor_profile"
    )

    hospital = db.relationship(
        "Hospital",
        back_populates="doctors"
    )

    patients = db.relationship(
        "DoctorPatient",
        back_populates="doctor"
    )

    appointments = db.relationship(
        "Appointment",
        back_populates="doctor"
    )
    

# ==========================================================
# PATIENTS
# ==========================================================

class Patient(db.Model):
    __tablename__ = "patients"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=gen_uuid
    )

    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id"),
        nullable=False,
        unique=True
    )

    patient_code = db.Column(
        db.String(20),
        unique=True
    )

    blood_group = db.Column(db.String(10))

    height = db.Column(db.Float)

    weight = db.Column(db.Float)

    emergency_contact_name = db.Column(db.String(100))

    emergency_contact_phone = db.Column(db.String(20))

    medical_history = db.Column(db.Text)

    allergies = db.Column(db.Text)

    assigned_doctor_id = db.Column(
        db.String(36),
        db.ForeignKey("doctors.id")
    )

    status = db.Column(
        db.String(20),
        default="active"
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )
    

    # ==========================
    # Relationships
    # ==========================

    user = db.relationship(
        "User",
        back_populates="patient_profile"
    )

    doctor = db.relationship(
        "Doctor"
    )

    subscriptions = db.relationship(
    "Subscription",
    back_populates="patient",
    cascade="all, delete-orphan"
)

    rings = db.relationship(
        "HealthRing",
        back_populates="patient",
        cascade="all, delete-orphan"
    )

    health_data = db.relationship(
        "HealthData",
        back_populates="patient",
        cascade="all, delete-orphan"
    )

    appointments = db.relationship(
        "Appointment",
        back_populates="patient"
    )

    alerts = db.relationship(
        "EmergencyAlert",
        back_populates="patient"
    )

    reports = db.relationship(
        "Report",
        back_populates="patient"
    )

    insights = db.relationship(
        "AIInsight",
        back_populates="patient"
    )

    family_members = db.relationship(
        "PatientFamily",
        back_populates="patient"
    )

    doctors = db.relationship(
        "DoctorPatient",
        back_populates="patient"
    )
    sync_logs = db.relationship(
    "RingSyncLog",
    back_populates="patient"
)

# ==========================================================
# FAMILY MEMBERS
# ==========================================================

class FamilyMember(db.Model):
    __tablename__ = "family_members"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=gen_uuid
    )

    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id"),
        nullable=False,
        unique=True
    )

    relationship = db.Column(
        db.String(50)
    )

    can_view_reports = db.Column(
        db.Boolean,
        default=True
    )

    can_receive_alerts = db.Column(
        db.Boolean,
        default=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    # Relationships
    user = db.relationship(
        "User",
        back_populates="family_profile"
    )

    patients = db.relationship(
        "PatientFamily",
        back_populates="family_member"
    )

# ==========================================================
# DOCTOR ↔ PATIENT
# ==========================================================

class DoctorPatient(db.Model):
    __tablename__ = "doctor_patient"

    id = db.Column(db.Integer, primary_key=True)

    doctor_id = db.Column(db.String(36), db.ForeignKey("doctors.id"))
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"))

    assigned_date = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    status = db.Column(
        db.String(20),
        default="active"
    )

    doctor = db.relationship(
        "Doctor",
        back_populates="patients"
    )

    patient = db.relationship(
        "Patient",
        back_populates="doctors"
    )


# ==================patient family=================
class PatientFamily(db.Model):
    __tablename__ = "patient_family"

    id = db.Column(db.Integer, primary_key=True)

    patient_id = db.Column(
        db.String(36),
        db.ForeignKey("patients.id"),
        nullable=False
    )

    family_member_id = db.Column(
        db.String(36),
        db.ForeignKey("family_members.id"),
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    patient = db.relationship(
        "Patient",
        back_populates="family_members"
    )

    family_member = db.relationship(
        "FamilyMember",
        back_populates="patients"
    )


# ==================health ring=================
class HealthRing(db.Model):
    __tablename__ = "health_rings"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=gen_uuid
    )

    patient_id = db.Column(
        db.String(36),
        db.ForeignKey("patients.id"),
        nullable=False
    )

    ring_serial_number = db.Column(
        db.String(50),
        unique=True,
        nullable=False
    )

    model = db.Column(db.String(50))
    firmware_version = db.Column(db.String(30))

    mac_address = db.Column(
        db.String(30),
        unique=True
    )

    battery_percentage = db.Column(
        db.Integer,
        default=100
    )

    connection_status = db.Column(
        db.String(20),
        default="offline"
    )

    last_sync = db.Column(db.DateTime)

    purchased_date = db.Column(db.Date)

    warranty_expiry = db.Column(db.Date)

    status = db.Column(
        db.String(20),
        default="active"
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    # ==========================
    # Relationships
    # ==========================

    patient = db.relationship(
        "Patient",
        back_populates="rings"
    )

    health_data = db.relationship(
        "HealthData",
        back_populates="ring",
        cascade="all, delete-orphan"
    )

    sync_logs = db.relationship(
        "RingSyncLog",
        back_populates="ring",
        cascade="all, delete-orphan"
    )
# ==========================================================
# HEALTH DATA
# ==========================================================

class HealthData(db.Model):
    __tablename__ = "health_data"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True
    )

    patient_id = db.Column(
        db.String(36),
        db.ForeignKey("patients.id"),
        nullable=False
    )

    ring_id = db.Column(
        db.String(36),
        db.ForeignKey("health_rings.id")
    )

    heart_rate = db.Column(db.Integer)
    spo2 = db.Column(db.Float)
    body_temperature = db.Column(db.Float)
    stress_level = db.Column(db.Integer)
    sleep_hours = db.Column(db.Float)
    steps = db.Column(db.Integer)
    calories = db.Column(db.Float)
    distance = db.Column(db.Float)
    heart_rate_variability = db.Column(db.Float)
    respiratory_rate = db.Column(db.Float)
    blood_pressure_systolic = db.Column(db.Integer)
    blood_pressure_diastolic = db.Column(db.Integer)

    recorded_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    # Relationships
    patient = db.relationship(
        "Patient",
        back_populates="health_data"
    )

    ring = db.relationship(
        "HealthRing",
        back_populates="health_data"
    )

# ==========================================================
# APPOINTMENTS
# ==========================================================

class Appointment(db.Model):
    __tablename__ = "appointments"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=gen_uuid
    )

    patient_id = db.Column(
        db.String(36),
        db.ForeignKey("patients.id"),
        nullable=False
    )

    doctor_id = db.Column(
        db.String(36),
        db.ForeignKey("doctors.id"),
        nullable=False
    )

    hospital_id = db.Column(
        db.String(36),
        db.ForeignKey("hospitals.id"),
        nullable=False
    )

    appointment_date = db.Column(
        db.Date,
        nullable=False
    )

    appointment_time = db.Column(
        db.Time,
        nullable=False
    )

    appointment_type = db.Column(
        db.Enum(
            "online",
            "offline",
            "emergency",
            name="appointment_type_enum"
        ),
        default="online"
    )

    reason = db.Column(
        db.Text
    )

    meeting_link = db.Column(
        db.String(255)
    )

    status = db.Column(
        db.Enum(
            "scheduled",
            "completed",
            "cancelled",
            "missed",
            name="appointment_status_enum"
        ),
        default="scheduled"
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


    # ==========================
    # Relationships
    # ==========================

    patient = db.relationship(
        "Patient",
        back_populates="appointments"
    )

    doctor = db.relationship(
        "Doctor",
        back_populates="appointments"
    )
    hospital = db.relationship(
        "Hospital",
        back_populates="appointments"
    )


 # ==========================================================
# EMERGENCY ALERTS
# ==========================================================
class EmergencyAlert(db.Model):

    __tablename__ = "emergency_alerts"


    id = db.Column(
        db.String(36),
        primary_key=True,
        default=gen_uuid
    )


    patient_id = db.Column(
        db.String(36),
        db.ForeignKey("patients.id"),
        nullable=False
    )


    ring_id = db.Column(
        db.String(36),
        db.ForeignKey("health_rings.id"),
        nullable=True
    )


    alert_type = db.Column(
        db.String(100)
    )


    severity = db.Column(
        db.String(30),
        default="medium"
    )


    heart_rate = db.Column(
        db.Integer
    )


    spo2 = db.Column(
        db.Numeric(5,2)
    )


    message = db.Column(
        db.Text
    )


    latitude = db.Column(
        db.Numeric(10,7)
    )


    longitude = db.Column(
        db.Numeric(10,7)
    )


    status = db.Column(
        db.String(30),
        default="active"
    )


    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


    # ==========================
    # Relationships
    # ==========================

    patient = db.relationship(
        "Patient",
        back_populates="alerts"
    )


    ring = db.relationship(
        "HealthRing"
    )


# ==========================================================
# REPORTS
# ==========================================================

class Report(db.Model):

    __tablename__ = "reports"


    id = db.Column(
        db.String(36),
        primary_key=True,
        default=gen_uuid
    )


    patient_id = db.Column(
        db.String(36),
        db.ForeignKey("patients.id"),
        nullable=False
    )


    doctor_id = db.Column(
        db.String(36),
        db.ForeignKey("doctors.id")
    )


    report_title = db.Column(
        db.String(150)
    )


    report_type = db.Column(
        db.Enum(
            "daily",
            "weekly",
            "monthly",
            "medical",
            name="report_type_enum"
        )
    )


    report_file = db.Column(
        db.String(255)
    )


    notes = db.Column(
        db.Text
    )


    generated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


    # ==========================
    # Relationships
    # ==========================

    patient = db.relationship(
        "Patient",
        back_populates="reports"
    )


    doctor = db.relationship(
        "Doctor"
    )

# ==========================================================
# NOTIFICATIONS
# ==========================================================

class Notification(db.Model):

    __tablename__ = "notifications"


    id = db.Column(
        db.String(36),
        primary_key=True,
        default=gen_uuid
    )


    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id"),
        nullable=False
    )


    title = db.Column(
        db.String(150)
    )


    message = db.Column(
        db.Text
    )


    notification_type = db.Column(
        db.Enum(
            "alert",
            "appointment",
            "report",
            "system",
            name="notification_type_enum"
        )
    )


    is_read = db.Column(
        db.Boolean,
        default=False
    )


    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


    # ==========================
    # Relationship
    # ==========================

    user = db.relationship(
        "User"
    )

# ==========================================================
# AI INSIGHTS
# ==========================================================

class AIInsight(db.Model):
    __tablename__ = "ai_insights"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=gen_uuid
    )

    patient_id = db.Column(
        db.String(36),
        db.ForeignKey("patients.id"),
        nullable=False
    )

    insight_type = db.Column(
        db.String(100)
    )

    risk_level = db.Column(
        db.String(20),
        default="low"
    )

    title = db.Column(
        db.String(150)
    )

    description = db.Column(
        db.Text
    )

    recommendation = db.Column(
        db.Text
    )

    confidence_score = db.Column(
        db.Numeric(5, 2)
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    # ==========================
    # Relationships
    # ==========================

    patient = db.relationship(
        "Patient",
        back_populates="insights"
    )
# ==========================================================
# LOGIN HISTORY
# ==========================================================

class LoginHistory(db.Model):
    __tablename__ = "login_history"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True
    )

    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id"),
        nullable=False
    )

    login_time = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    logout_time = db.Column(
        db.DateTime
    )

    ip_address = db.Column(
        db.String(45)
    )

    device_name = db.Column(
        db.String(100)
    )

    browser = db.Column(
        db.String(100)
    )

    operating_system = db.Column(
        db.String(100)
    )

    login_status = db.Column(
        db.String(20),
        default="success"
    )

    # ==========================
    # Relationship
    # ==========================

    user = db.relationship(
        "User",
        back_populates="login_history"
    )
# ==========================================================
# AUDIT LOGS
# ==========================================================

class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True
    )

    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id")
    )

    action = db.Column(
        db.String(100)
    )

    table_name = db.Column(
        db.String(100)
    )

    record_id = db.Column(
        db.String(36)
    )

    description = db.Column(
        db.Text
    )

    ip_address = db.Column(
        db.String(45)
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    # ==========================
    # Relationship
    # ==========================

    user = db.relationship(
        "User",
        back_populates="audit_logs"
    )

# ==========================================================
# RING SYNC LOGS
# ==========================================================

class RingSyncLog(db.Model):
    __tablename__ = "ring_sync_logs"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    ring_id = db.Column(
        db.String(36),
        db.ForeignKey("health_rings.id"),
        nullable=False
    )

    patient_id = db.Column(
        db.String(36),
        db.ForeignKey("patients.id"),
        nullable=True
    )

    sync_start = db.Column(db.DateTime)

    sync_end = db.Column(db.DateTime)

    records_uploaded = db.Column(
        db.Integer,
        default=0
    )

    battery_level = db.Column(db.Integer)

    sync_status = db.Column(
        db.String(20),
        default="success"
    )

    error_message = db.Column(db.Text)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    # ==========================
    # Relationships
    # ==========================

    ring = db.relationship(
        "HealthRing",
        back_populates="sync_logs"
    )

    patient = db.relationship(
        "Patient",
        back_populates="sync_logs"
    )
# ==========================================================
# SETTINGS
# ==========================================================

class Setting(db.Model):
    __tablename__ = "settings"

    id = db.Column(
        db.String(36),
        primary_key=True
    )

    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id"),
        nullable=False,
        unique=True
    )

    # ==========================
    # Appearance
    # ==========================

    theme = db.Column(
        db.String(20),
        default="light"
    )

    language = db.Column(
        db.String(30),
        default="English"
    )

    timezone = db.Column(
        db.String(50),
        default="Asia/Kolkata"
    )

    # ==========================
    # Notifications
    # ==========================

    email_notifications = db.Column(
        db.Boolean,
        default=True
    )

    sms_notifications = db.Column(
        db.Boolean,
        default=False
    )

    emergency_notifications = db.Column(
        db.Boolean,
        default=True
    )

    appointment_notifications = db.Column(
        db.Boolean,
        default=True
    )

    report_notifications = db.Column(
        db.Boolean,
        default=True
    )

    ai_notifications = db.Column(
        db.Boolean,
        default=True
    )

    battery_notifications = db.Column(
        db.Boolean,
        default=True
    )

    # ==========================
    # Health Ring
    # ==========================

    auto_sync = db.Column(
        db.Boolean,
        default=True
    )

    sync_interval = db.Column(
        db.Integer,
        default=15
    )

    battery_alert_percentage = db.Column(
        db.Integer,
        default=20
    )

    # ==========================
    # Privacy & Security
    # ==========================

    two_factor_auth = db.Column(
        db.Boolean,
        default=False
    )

    login_alerts = db.Column(
        db.Boolean,
        default=True
    )

    share_with_doctor = db.Column(
        db.Boolean,
        default=True
    )

    share_with_family = db.Column(
        db.Boolean,
        default=True
    )

    # ==========================
    # Timestamps
    # ==========================

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # ==========================
    # Relationship
    # ==========================

    user = db.relationship(
        "User",
        back_populates="setting"
    )
# ==========================================================
# SUBSCRIPTIONS
# ==========================================================

class Subscription(db.Model):
    __tablename__ = "subscriptions"

    id = db.Column(
        db.String(36),
        primary_key=True
    )

    patient_id = db.Column(
        db.String(36),
        db.ForeignKey("patients.id"),
        nullable=False
    )

    plan_name = db.Column(
        db.String(50),
        default="Basic"
    )

    price = db.Column(
        db.Numeric(10, 2)
    )

    billing_cycle = db.Column(
        db.String(20),
        default="Monthly"
    )

    start_date = db.Column(
        db.Date
    )

    end_date = db.Column(
        db.Date
    )

    payment_status = db.Column(
        db.String(20),
        default="Pending"
    )

    auto_renew = db.Column(
        db.Boolean,
        default=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    # ==========================
    # Relationship
    # ==========================

    patient = db.relationship(
        "Patient",
        back_populates="subscriptions"
    )


# import uuid
# from datetime import datetime

class Prescription(db.Model):
    __tablename__ = "prescriptions"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False)
    doctor_id = db.Column(db.String(36), db.ForeignKey("doctors.id"), nullable=False)
    appointment_id = db.Column(db.String(36), db.ForeignKey("appointments.id"), nullable=True)

    diagnosis = db.Column(db.Text, nullable=False)

    # Legacy fields — kept for backward compatibility, do not remove
    medicines = db.Column(db.Text, nullable=False)
    dosage = db.Column(db.Text)
    instructions = db.Column(db.Text)

    prescribed_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default="Active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    current_analysis = db.Column(db.Text, nullable=True)
    follow_up_date = db.Column(db.Date, nullable=True)
    follow_up_time = db.Column(db.Time, nullable=True)
    follow_up_notes = db.Column(db.Text, nullable=True)

    patient = db.relationship("Patient", backref="prescriptions")
    doctor = db.relationship("Doctor", backref="prescriptions")
    appointment = db.relationship("Appointment", backref="prescriptions")

    medicine_items = db.relationship(
        "PrescriptionMedicine",
        back_populates="prescription",
        cascade="all, delete-orphan",
        lazy=True
    )


class PrescriptionMedicine(db.Model):
    __tablename__ = "prescription_medicines"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    prescription_id = db.Column(
        db.String(36),
        db.ForeignKey("prescriptions.id", ondelete="CASCADE"),
        nullable=False
    )

    medicine_name = db.Column(db.String(255), nullable=False)
    medicine_type = db.Column(db.String(50), nullable=False)
    dosage = db.Column(db.String(100), nullable=True)
    quantity = db.Column(db.String(100), nullable=True)
    frequency = db.Column(db.String(100), nullable=True)
    taking_time = db.Column(db.String(255), nullable=True)
    duration = db.Column(db.String(100), nullable=True)
    instructions = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    prescription = db.relationship("Prescription", back_populates="medicine_items")