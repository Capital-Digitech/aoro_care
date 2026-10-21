import re

from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session,
    jsonify
)
from datetime import date, datetime, timedelta
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import generate_password_hash, check_password_hash

from database import db
from models import (
    User,
    Patient,
    FamilyMember,
    PatientFamily,
    HealthData,
    Appointment,
    Report,
    HealthRing,
    RingSyncLog,
    Doctor,
    DoctorPatient,
    EmergencyAlert,
    Notification,
    Setting,
    LoginHistory
)

family_bp = Blueprint(
    "family",
    __name__,
    url_prefix="/family"
)


# ==========================================================
# Family Member List
# ==========================================================

@family_bp.route("/")
def family_list():

    families = FamilyMember.query.order_by(
        FamilyMember.created_at.desc()
    ).all()

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    return render_template(
        "family/family_list.html",
        families=families,
        patients=patients
    )

## ==========================================================
# Add Family Member
# ==========================================================

@family_bp.route("/add", methods=["GET", "POST"])
def family_add():

    patients = Patient.query.filter_by(status="active").all()

    if request.method == "POST":

        # Check duplicate email
        existing_user = User.query.filter_by(
            email=request.form["email"]
        ).first()

        if existing_user:
            flash("Email already exists. Please use another email.", "danger")
            return redirect(url_for("family.family_list"))

        # ---------------- User ----------------
        user = User(
            role="family",
            first_name=request.form["first_name"],
            last_name=request.form["last_name"],
            email=request.form["email"],
            mobile=request.form.get("mobile"),
            gender=request.form.get("gender"),
            address=request.form.get("address"),
            is_verified=True
        )

        user.password_hash = generate_password_hash("Family@123")

        db.session.add(user)
        db.session.flush()

        # ---------------- Family Member ----------------
        family = FamilyMember(
            user_id=user.id,
            relationship=request.form.get("relationship"),
            can_view_reports=True if request.form.get("can_view_reports") else False,
            can_receive_alerts=True if request.form.get("can_receive_alerts") else False
        )

        db.session.add(family)
        db.session.flush()

        # ---------------- Patient ↔ Family ----------------
        link = PatientFamily(
            patient_id=request.form["patient_id"],
            family_member_id=family.id
        )

        db.session.add(link)
        db.session.commit()

        flash("Family member added successfully.", "success")
        return redirect(url_for("family.family_list"))

    return render_template(
        "family/family_add.html",
        patients=patients
    )


# ==========================================================
# Edit Family Member
# ==========================================================

@family_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def family_edit(id):

    family = FamilyMember.query.get_or_404(id)
    user = family.user

    patients = Patient.query.filter_by(status="active").all()

    link = PatientFamily.query.filter_by(
        family_member_id=family.id
    ).first()

    if request.method == "POST":

        # ---------------- User ----------------
        user.first_name = request.form["first_name"]
        user.last_name = request.form["last_name"]
        user.email = request.form["email"]
        user.mobile = request.form.get("mobile")
        user.gender = request.form.get("gender")
        user.address = request.form.get("address")

        # ---------------- Family Member ----------------
        family.relationship = request.form.get("relationship")
        family.can_view_reports = True if request.form.get("can_view_reports") else False
        family.can_receive_alerts = True if request.form.get("can_receive_alerts") else False

        # ---------------- Update Patient Link ----------------
        if link:
            link.patient_id = request.form["patient_id"]

        db.session.commit()

        flash("Family member updated successfully.", "success")
        return redirect(url_for("family.family_list"))

    return render_template(
        "family/family_edit.html",
        family=family,
        patients=patients,
        link=link
    )
# ==========================================================
# Delete Family Member
# ==========================================================

@family_bp.route("/delete/<string:id>", methods=["POST"])
def family_delete(id):

    family = FamilyMember.query.get_or_404(id)

    user = family.user

    db.session.delete(family)
    db.session.delete(user)

    db.session.commit()

    flash("Family member deleted successfully.", "success")

    return redirect(url_for("family.family_list"))


# ==========================================================
# Family Portal - Linked Patients
# ==========================================================

@family_bp.route("/linked-patients")
def family_linked_patients():

    # Validate family login
    if "user" not in session:
        return redirect(url_for("pages.login"))

    session_user = session["user"]

    if session_user.get("role") != "family":
        return redirect(url_for("pages.login"))

    user = db.session.get(User, session_user.get("id"))

    if not user:
        session.clear()
        return redirect(url_for("pages.login"))

    # Load only this logged-in user's family profile
    family_member = FamilyMember.query.filter_by(
        user_id=user.id
    ).first()

    patients = []

    if family_member:
        patients = [
            link.patient
            for link in family_member.patients
            if link.patient is not None
            and (link.patient.status or "active") == "active"
        ]

    can_view_reports = bool(
        family_member and family_member.can_view_reports
    )

    connected_rings = 0
    critical_patients = 0
    today = date.today()

    for patient in patients:

        # Latest health data (ring)
        latest = (
            HealthData.query
            .filter_by(patient_id=patient.id)
            .order_by(HealthData.recorded_at.desc())
            .first()
        )

        patient.latest_health = latest
        patient.health_score = None
        patient.is_critical = False

        # Latest appointment (any doctor)
        patient.latest_appointment = (
            Appointment.query
            .filter_by(patient_id=patient.id)
            .order_by(
                Appointment.appointment_date.desc(),
                Appointment.appointment_time.desc()
            )
            .first()
        )

        # Latest report: only if this family member is allowed to see reports
        patient.latest_report = None

        if can_view_reports:
            patient.latest_report = (
                Report.query
                .filter_by(patient_id=patient.id)
                .order_by(Report.generated_at.desc())
                .first()
            )

        # Emergency contact
        name = patient.emergency_contact_name
        phone = patient.emergency_contact_phone

        if name and phone:
            patient.view_emergency_contact = f"{name} - {phone}"
        else:
            patient.view_emergency_contact = name or phone or "—"

        # Assigned doctor + hospital
        doctor = patient.doctor
        patient.view_doctor_name = "—"
        patient.view_hospital_name = "—"

        if doctor and doctor.user:
            full_name = (
                f"{doctor.user.first_name or ''} "
                f"{doctor.user.last_name or ''}"
            ).strip()
            patient.view_doctor_name = full_name or "—"

        if doctor and doctor.hospital:
            patient.view_hospital_name = (
                doctor.hospital.hospital_name or "—"
            )

        # Age
        patient.view_age = "—"

        if patient.user and patient.user.date_of_birth:
            dob = patient.user.date_of_birth
            patient.view_age = (
                today.year - dob.year
                - ((today.month, today.day) < (dob.month, dob.day))
            )

        # Health score + critical flag (same rules as doctor portal)
        if latest:
            score = 100
            is_critical = False

            if latest.heart_rate is not None and (
                latest.heart_rate > 110 or latest.heart_rate < 50
            ):
                score -= 20

            if latest.spo2 is not None and latest.spo2 < 95:
                score -= 20

            patient.health_score = max(score, 0)
            connected_rings += 1

            if (
                (latest.heart_rate is not None and latest.heart_rate > 110)
                or (latest.spo2 is not None and latest.spo2 < 95)
            ):
                is_critical = True

            if is_critical:
                patient.is_critical = True
                critical_patients += 1

    upcoming_appointments = 0

    if patients:
        upcoming_appointments = (
            Appointment.query
            .filter(
                Appointment.patient_id.in_([p.id for p in patients]),
                Appointment.appointment_date >= today
            )
            .count()
        )

    return render_template(
        "family/linked_patients.html",
        user=user,
        family_member=family_member,
        linked_patients=patients,
        total_patients=len(patients),
        connected_rings=connected_rings,
        critical_patients=critical_patients,
        upcoming_appointments=upcoming_appointments,
        can_view_reports=can_view_reports
    )


# ==========================================================
# Family Portal - Live Health Monitoring
# ==========================================================

def _vitals_status(record):
    """Same thresholds as the Doctor Portal live monitoring page."""

    hr = record.heart_rate
    spo2 = record.spo2
    temp = record.body_temperature
    sys_bp = record.blood_pressure_systolic

    ring = getattr(record, "ring", None)

    if (hr is None and spo2 is None) or (
        ring and ring.connection_status == "disconnected"
    ):
        return "offline"

    if (
        (hr is not None and (hr < 50 or hr > 130))
        or (spo2 is not None and spo2 < 90)
        or (temp is not None and (temp >= 103 or temp <= 95))
        or (sys_bp is not None and (sys_bp >= 180 or sys_bp <= 90))
    ):
        return "critical"

    if (
        (hr is not None and (hr < 60 or hr > 100))
        or (spo2 is not None and spo2 < 95)
    ):
        return "warning"

    return "healthy"


@family_bp.route("/live-monitoring")
def family_live_monitoring():

    # Validate family login
    if "user" not in session:
        return redirect(url_for("pages.login"))

    session_user = session["user"]

    if session_user.get("role") != "family":
        return redirect(url_for("pages.login"))

    user = db.session.get(User, session_user.get("id"))

    if not user:
        session.clear()
        return redirect(url_for("pages.login"))

    family_member = FamilyMember.query.filter_by(
        user_id=user.id
    ).first()

    patients = []

    if family_member:
        patients = [
            link.patient
            for link in family_member.patients
            if link.patient is not None
            and (link.patient.status or "active") == "active"
        ]

    patient_ids = [p.id for p in patients]
    today = date.today()

    records = []

    if patient_ids:
        records = (
            HealthData.query
            .filter(HealthData.patient_id.in_(patient_ids))
            .order_by(HealthData.recorded_at.desc())
            .limit(500)
            .all()
        )

    # Age per patient
    ages = {}

    for patient in patients:
        ages[patient.id] = ""

        if patient.user and patient.user.date_of_birth:
            dob = patient.user.date_of_birth
            ages[patient.id] = (
                today.year - dob.year
                - ((today.month, today.day) < (dob.month, dob.day))
            )

    latest_status = {}

    for record in records:
        record.row_status = _vitals_status(record)
        record.view_age = ages.get(record.patient_id, "")

        # records are newest-first, so the first one seen is the latest
        if record.patient_id not in latest_status:
            latest_status[record.patient_id] = record.row_status

    statuses = list(latest_status.values())

    return render_template(
        "family/live_monitoring.html",
        user=user,
        family_member=family_member,
        health_data_records=records,
        total_patients=len(patients),
        healthy_count=statuses.count("healthy"),
        warning_count=statuses.count("warning"),
        critical_count=statuses.count("critical")
    )


# ==========================================================
# Family Portal - shared helpers for Health Ring / Appointments
# ==========================================================

def _family_portal_context():
    """Return (user, family_member, linked_patients) for the logged-in
    family member, or None when the session is not a valid family login.

    Every family-portal data query below is scoped to these linked
    patients only, so a family member can never see another family's
    rings or appointments.
    """

    if "user" not in session:
        return None

    session_user = session["user"]

    if session_user.get("role") != "family":
        return None

    user = db.session.get(User, session_user.get("id"))

    if not user:
        session.clear()
        return None

    family_member = FamilyMember.query.filter_by(
        user_id=user.id
    ).first()

    patients = []

    if family_member:
        patients = [
            link.patient
            for link in family_member.patients
            if link.patient is not None
            and (link.patient.status or "active") == "active"
        ]

    return user, family_member, patients


def _person_name(user_obj):
    if not user_obj:
        return "-"

    return (
        f"{user_obj.first_name or ''} {user_obj.last_name or ''}"
    ).strip() or "-"


def _fmt_dt(value, fmt="%Y-%m-%d %H:%M"):
    return value.strftime(fmt) if value else ""


# ==========================================================
# Family Portal - Health Ring
# ==========================================================

@family_bp.route("/health-ring")
def family_health_ring():

    ctx = _family_portal_context()

    if ctx is None:
        return redirect(url_for("pages.login"))

    user, family_member, patients = ctx
    patient_ids = [p.id for p in patients]

    rings = []

    if patient_ids:
        rings = (
            HealthRing.query
            .filter(HealthRing.patient_id.in_(patient_ids))
            .order_by(HealthRing.created_at.desc())
            .all()
        )

    return render_template(
        "family/health_ring.html",
        user=user,
        family_member=family_member,
        rings=rings,
        total_rings=len(rings),
        connected_rings=sum(
            1 for r in rings if r.connection_status == "connected"
        ),
        disconnected_rings=sum(
            1 for r in rings
            if r.connection_status not in ("connected", "syncing")
        ),
        low_battery_rings=sum(
            1 for r in rings
            if r.battery_percentage is not None
            and r.battery_percentage < 20
        ),
        active_page="family_health_ring"
    )


@family_bp.route("/health-ring/<string:ring_id>/details")
def family_health_ring_details(ring_id):
    """JSON details for one ring (view modal). Scoped to linked patients."""

    ctx = _family_portal_context()

    if ctx is None:
        return jsonify(success=False, message="Login required."), 401

    _user, _family_member, patients = ctx
    patient_ids = [p.id for p in patients]

    ring = HealthRing.query.filter_by(id=ring_id).first()

    if ring is None or ring.patient_id not in patient_ids:
        return jsonify(success=False, message="Health ring not found."), 404

    latest = (
        HealthData.query
        .filter_by(ring_id=ring.id)
        .order_by(HealthData.recorded_at.desc())
        .first()
    )

    logs = (
        RingSyncLog.query
        .filter_by(ring_id=ring.id)
        .order_by(RingSyncLog.created_at.desc())
        .limit(5)
        .all()
    )

    return jsonify(
        success=True,
        ring=dict(
            id=ring.id,
            patient_name=_person_name(ring.patient.user) if ring.patient else "-",
            patient_code=(ring.patient.patient_code if ring.patient else "") or "",
            serial_number=ring.ring_serial_number or "",
            mac_address=ring.mac_address or "",
            model=ring.model or "",
            firmware=ring.firmware_version or "",
            battery=ring.battery_percentage,
            connection=ring.connection_status or "disconnected",
            status=ring.status or "active",
            last_sync=_fmt_dt(ring.last_sync),
            purchased_date=_fmt_dt(ring.purchased_date, "%Y-%m-%d"),
            warranty_expiry=_fmt_dt(ring.warranty_expiry, "%Y-%m-%d")
        ),
        latest_reading=(
            dict(
                recorded_at=_fmt_dt(latest.recorded_at),
                heart_rate=latest.heart_rate,
                spo2=latest.spo2,
                body_temperature=latest.body_temperature,
                steps=latest.steps
            ) if latest else None
        ),
        sync_logs=[
            dict(
                time=_fmt_dt(log.sync_end or log.sync_start or log.created_at),
                status=log.sync_status or "",
                records=log.records_uploaded or 0,
                battery=log.battery_level,
                error=log.error_message or ""
            )
            for log in logs
        ]
    )


# ==========================================================
# Family Portal - Appointments
# ==========================================================

def _serialize_family_appointment(appointment):
    patient_name = "-"
    patient_code = ""

    if appointment.patient:
        patient_name = _person_name(appointment.patient.user)
        patient_code = appointment.patient.patient_code or ""

    doctor_name = "-"

    if appointment.doctor and appointment.doctor.user:
        doctor_name = "Dr. " + _person_name(appointment.doctor.user)

    status = appointment.status or "scheduled"

    return dict(
        id=appointment.id,
        patient_name=patient_name,
        patient_code=patient_code,
        doctor_name=doctor_name,
        specialization=(
            getattr(appointment.doctor, "specialization", "") or ""
        ) if appointment.doctor else "",
        hospital_name=(
            appointment.hospital.hospital_name
            if appointment.hospital else ""
        ) or "",
        appointment_date=_fmt_dt(appointment.appointment_date, "%Y-%m-%d"),
        appointment_time=_fmt_dt(appointment.appointment_time, "%H:%M"),
        appointment_type=appointment.appointment_type or "",
        status="pending" if status in ("scheduled", "pending") else status,
        reason=appointment.reason or "",
        meeting_link=appointment.meeting_link or ""
    )


@family_bp.route("/appointments")
def family_appointments():

    ctx = _family_portal_context()

    if ctx is None:
        return redirect(url_for("pages.login"))

    user, family_member, patients = ctx
    patient_ids = [p.id for p in patients]

    appointments = []

    if patient_ids:
        appointments = (
            Appointment.query
            .filter(Appointment.patient_id.in_(patient_ids))
            .order_by(
                Appointment.appointment_date.desc(),
                Appointment.appointment_time.desc()
            )
            .all()
        )

    today = date.today()

    def _is_pending(a):
        return (a.status or "scheduled") in ("scheduled", "pending")

    return render_template(
        "family/appointments.html",
        user=user,
        family_member=family_member,
        appointments=appointments,
        today_count=sum(
            1 for a in appointments if a.appointment_date == today
        ),
        pending_count=sum(1 for a in appointments if _is_pending(a)),
        missed_count=sum(1 for a in appointments if a.status == "missed"),
        completed_count=sum(
            1 for a in appointments if a.status == "completed"
        ),
        active_page="family_appointments"
    )


@family_bp.route("/appointments/<string:appointment_id>")
def family_appointment_detail(appointment_id):
    """JSON details for one appointment (view modal). Scoped to linked patients."""

    ctx = _family_portal_context()

    if ctx is None:
        return jsonify(success=False, message="Login required."), 401

    _user, _family_member, patients = ctx
    patient_ids = [p.id for p in patients]

    appointment = Appointment.query.filter_by(id=appointment_id).first()

    if appointment is None or appointment.patient_id not in patient_ids:
        return jsonify(success=False, message="Appointment not found."), 404

    return jsonify(
        success=True,
        appointment=_serialize_family_appointment(appointment)
    )


# ==========================================================
# Family Portal - Doctors
# ==========================================================

def _family_linked_doctors(patients):
    """Doctors connected to the family member's linked patients.

    A doctor is included when he/she is the patient's assigned doctor,
    has an active doctor_patient row for the patient, or has an
    appointment with the patient. Returns {doctor_id: (doctor, [patients])}.
    """

    patient_map = {p.id: p for p in patients}
    patient_ids = list(patient_map.keys())
    connections = {}

    def _connect(doctor_id, patient_id):
        if not doctor_id or patient_id not in patient_map:
            return

        linked = connections.setdefault(doctor_id, [])

        if patient_id not in linked:
            linked.append(patient_id)

    for patient in patients:
        _connect(patient.assigned_doctor_id, patient.id)

    if patient_ids:
        for row in DoctorPatient.query.filter(
            DoctorPatient.patient_id.in_(patient_ids)
        ).all():
            if (row.status or "active") == "active":
                _connect(row.doctor_id, row.patient_id)

        for appt in Appointment.query.filter(
            Appointment.patient_id.in_(patient_ids)
        ).all():
            _connect(appt.doctor_id, appt.patient_id)

    result = {}

    if connections:
        doctors = Doctor.query.filter(
            Doctor.id.in_(list(connections.keys()))
        ).all()

        for doctor in doctors:
            result[doctor.id] = (
                doctor,
                [patient_map[pid] for pid in connections[doctor.id]]
            )

    return result


def _serialize_family_doctor(doctor, linked_patients):
    user_obj = doctor.user
    hospital = doctor.hospital

    if hospital is None and doctor.hospital_name:
        hospital_name = doctor.hospital_name
    else:
        hospital_name = hospital.hospital_name if hospital else ""

    fee = doctor.consultation_fee

    return dict(
        id=doctor.id,
        doctor_name="Dr. " + _person_name(user_obj),
        doctor_code=doctor.doctor_code or "",
        specialization=doctor.specialization or "",
        qualification=doctor.qualification or "",
        experience_years=(
            doctor.experience_years
            if doctor.experience_years is not None else ""
        ),
        hospital_name=hospital_name or "",
        hospital_city=(hospital.city if hospital else "") or "",
        consultation_fee=(f"{float(fee):.2f}" if fee is not None else ""),
        available_days=doctor.available_days or "",
        available_time=doctor.available_time or "",
        email=(user_obj.email if user_obj else "") or "",
        mobile=(user_obj.mobile if user_obj else "") or "",
        about=doctor.about or "",
        status=doctor.status or "active",
        linked_patients=[
            _person_name(p.user) for p in linked_patients
        ]
    )


@family_bp.route("/doctors")
def family_doctors():

    ctx = _family_portal_context()

    if ctx is None:
        return redirect(url_for("pages.login"))

    user, family_member, patients = ctx

    connected = _family_linked_doctors(patients)

    doctors = []

    for doctor, linked in connected.values():
        info = _serialize_family_doctor(doctor, linked)
        info["doctor"] = doctor
        doctors.append(info)

    doctors.sort(key=lambda d: d["doctor_name"].lower())

    specializations = sorted({
        d["specialization"] for d in doctors if d["specialization"]
    })

    return render_template(
        "family/doctors.html",
        user=user,
        family_member=family_member,
        doctors=doctors,
        specializations=specializations,
        total_doctors=len(doctors),
        active_doctors=sum(1 for d in doctors if d["status"] == "active"),
        hospital_count=len({
            d["hospital_name"] for d in doctors if d["hospital_name"]
        }),
        specialization_count=len(specializations),
        active_page="family_doctors"
    )


@family_bp.route("/doctors/<string:doctor_id>")
def family_doctor_detail(doctor_id):
    """JSON details for one doctor (view modal). Scoped to linked patients."""

    ctx = _family_portal_context()

    if ctx is None:
        return jsonify(success=False, message="Login required."), 401

    _user, _family_member, patients = ctx

    connected = _family_linked_doctors(patients)

    if doctor_id not in connected:
        return jsonify(success=False, message="Doctor not found."), 404

    doctor, linked = connected[doctor_id]

    return jsonify(
        success=True,
        doctor=_serialize_family_doctor(doctor, linked)
    )


# ==========================================================
# Family Portal - Medical Reports
# ==========================================================

@family_bp.route("/medical-reports")
def family_medical_reports():

    ctx = _family_portal_context()

    if ctx is None:
        return redirect(url_for("pages.login"))

    user, family_member, patients = ctx
    patient_ids = [p.id for p in patients]

    # Respect the permission the admin set for this family member.
    can_view_reports = bool(
        family_member and family_member.can_view_reports
    )

    reports = []

    if can_view_reports and patient_ids:
        reports = (
            Report.query
            .filter(Report.patient_id.in_(patient_ids))
            .order_by(Report.generated_at.desc())
            .all()
        )

    cutoff = datetime.utcnow() - timedelta(days=30)

    return render_template(
        "family/medical_reports.html",
        user=user,
        family_member=family_member,
        reports=reports,
        can_view_reports=can_view_reports,
        medical_count=sum(1 for r in reports if r.report_type == "medical"),
        summary_count=sum(
            1 for r in reports
            if r.report_type in ("daily", "weekly", "monthly")
        ),
        recent_count=sum(
            1 for r in reports
            if r.generated_at and r.generated_at >= cutoff
        ),
        active_page="family_medical_reports"
    )


# ==========================================================
# Family Portal - AI Health Insights
# ==========================================================

@family_bp.route("/ai-health-insights")
def family_ai_health_insights():

    ctx = _family_portal_context()

    if ctx is None:
        return redirect(url_for("pages.login"))

    user, family_member, patients = ctx

    patient_options = [
        {
            "id": p.id,
            "name": _person_name(p.user) if p.user else None,
            "code": p.patient_code,
        }
        for p in patients
    ]

    patient_options.sort(key=lambda x: (x["name"] or "").lower())

    # Optional ?patient_id= preselect - honoured only for a linked patient
    selected_patient_id = request.args.get("patient_id")

    if selected_patient_id not in {p["id"] for p in patient_options}:
        selected_patient_id = None

    # With a single linked patient there is nothing to choose.
    if selected_patient_id is None and len(patient_options) == 1:
        selected_patient_id = patient_options[0]["id"]

    return render_template(
        "family/ai_health_insights.html",
        user=user,
        family_member=family_member,
        patient_options=patient_options,
        selected_patient_id=selected_patient_id,
        active_page="family_ai_health_insights"
    )


@family_bp.route("/ai-health-insights/data")
def family_ai_health_insights_data():
    """JSON analysis for one linked patient (same engine as the Doctor Portal)."""

    ctx = _family_portal_context()

    if ctx is None:
        return jsonify(
            success=False,
            message="Please log in as a family member to continue."
        ), 401

    _user, _family_member, patients = ctx

    patient_id = (request.args.get("patient_id") or "").strip()

    if not patient_id:
        return jsonify(
            success=False,
            message="Select a patient to view health insights."
        ), 400

    # Never trust the raw patient_id: it must be one of the linked patients.
    patient = next((p for p in patients if p.id == patient_id), None)

    if patient is None:
        return jsonify(success=False, message="Patient not found."), 404

    from routes.pages import _ai_patient_insight_response

    response = _ai_patient_insight_response(patient)

    # Re-word the clinician-facing phrases of the shared analysis for families.
    try:
        payload = response.get_json()

        if payload and payload.get("success"):
            analysis = payload.get("analysis")

            if analysis:
                analysis["follow_up"] = [
                    "Consider discussing these readings with the assigned doctor."
                    if item.startswith("Consider follow-up assessment")
                    else item
                    for item in analysis.get("follow_up", [])
                ]

                for item in analysis.get("attention", []):
                    if item.get("reason") == "Requires clinical review":
                        item["reason"] = "Worth discussing with the doctor"

            return jsonify(payload)
    except Exception:
        pass

    return response


# ==========================================================
# Family Portal - sidebar / topbar badge counts
#
# Injected into every template rendered for a logged-in family
# member so the sidebar badges and the topbar bell always show
# real numbers (no hard-coded values).
# ==========================================================

def _family_unread_notification_count(user_id):
    return Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).count()


def _family_active_alert_count(family_member, patients):
    """Active emergency alerts for the linked patients. Zero when the
    admin has switched alerts off for this family member."""

    if not family_member or not family_member.can_receive_alerts:
        return 0

    patient_ids = [p.id for p in patients]

    if not patient_ids:
        return 0

    return EmergencyAlert.query.filter(
        EmergencyAlert.patient_id.in_(patient_ids),
        EmergencyAlert.status == "active"
    ).count()


@family_bp.app_context_processor
def inject_family_nav_counts():

    session_user = session.get("user") if session else None

    if not session_user or session_user.get("role") != "family":
        return {}

    try:
        ctx = _family_portal_context()

        if ctx is None:
            return {}

        user, family_member, patients = ctx

        return {
            "family_unread_notification_count":
                _family_unread_notification_count(user.id),
            "family_active_alert_count":
                _family_active_alert_count(family_member, patients)
        }

    except SQLAlchemyError:
        db.session.rollback()
        return {}


# ==========================================================
# Family Portal - Emergency Alerts
#
# Read-only. Only alerts of patients linked to this family
# member are ever returned, and only when the admin has left
# "can_receive_alerts" switched on for the account.
# ==========================================================

def _serialize_family_alert(alert):

    patient_user = alert.patient.user if alert.patient else None

    return {
        "id": alert.id,
        "patient_name": _person_name(patient_user),
        "patient_code": (
            alert.patient.patient_code if alert.patient else None
        ),
        "alert_type": alert.alert_type or "-",
        "heart_rate": (
            f"{alert.heart_rate} bpm"
            if alert.heart_rate is not None else "-"
        ),
        "spo2": (
            f"{float(alert.spo2):g}%"
            if alert.spo2 is not None else "-"
        ),
        "severity": alert.severity or "medium",
        "status": alert.status or "active",
        "alert_time": _fmt_dt(alert.created_at, "%d-%m-%Y %H:%M") or "-",
        "ring_code": (
            alert.ring.ring_serial_number if alert.ring else None
        ),
        "message": alert.message,
        "has_location": (
            alert.latitude is not None and alert.longitude is not None
        ),
        "latitude": (
            float(alert.latitude) if alert.latitude is not None else None
        ),
        "longitude": (
            float(alert.longitude) if alert.longitude is not None else None
        )
    }


@family_bp.route("/emergency-alerts")
def family_emergency_alerts():

    ctx = _family_portal_context()

    if ctx is None:
        return redirect(url_for("pages.login"))

    user, family_member, patients = ctx

    alerts_enabled = bool(
        family_member and family_member.can_receive_alerts
    )

    patient_ids = [p.id for p in patients]

    alerts = []

    if alerts_enabled and patient_ids:
        alerts = (
            EmergencyAlert.query
            .filter(EmergencyAlert.patient_id.in_(patient_ids))
            .order_by(EmergencyAlert.created_at.desc())
            .all()
        )

    return render_template(
        "family/emergency_alerts.html",
        user=user,
        family_member=family_member,
        alerts=alerts,
        alerts_enabled=alerts_enabled,
        total_count=len(alerts),
        critical_count=sum(1 for a in alerts if a.severity == "critical"),
        active_count=sum(1 for a in alerts if a.status == "active"),
        resolved_count=sum(1 for a in alerts if a.status == "resolved"),
        active_page="family_emergency_alerts"
    )


@family_bp.route("/emergency-alerts/<string:alert_id>")
def family_emergency_alert_detail(alert_id):

    ctx = _family_portal_context()

    if ctx is None:
        return jsonify({
            "success": False,
            "message": "Please log in first."
        }), 401

    user, family_member, patients = ctx

    if not (family_member and family_member.can_receive_alerts):
        return jsonify({
            "success": False,
            "message": "Emergency alerts are not enabled for your account."
        }), 403

    patient_ids = [p.id for p in patients]

    alert = None

    if patient_ids:
        alert = EmergencyAlert.query.filter(
            EmergencyAlert.id == alert_id,
            EmergencyAlert.patient_id.in_(patient_ids)
        ).first()

    # Same answer for "does not exist" and "belongs to someone else"
    if alert is None:
        return jsonify({
            "success": False,
            "message": "Alert not found."
        }), 404

    return jsonify({
        "success": True,
        "alert": _serialize_family_alert(alert)
    })


# ==========================================================
# Family Portal - Notifications
#
# The family account's own notifications. "Mark as read" is
# handled by notification.notification_mark_read, which already
# restricts non-admin users to their own rows.
# ==========================================================

@family_bp.route("/notifications")
def family_notifications():

    ctx = _family_portal_context()

    if ctx is None:
        return redirect(url_for("pages.login"))

    user, family_member, patients = ctx

    notifications = (
        Notification.query
        .filter_by(user_id=user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )

    start_of_today = datetime.combine(date.today(), datetime.min.time())

    return render_template(
        "family/notifications.html",
        user=user,
        family_member=family_member,
        notifications=notifications,
        total_notifications=len(notifications),
        unread_notifications=sum(
            1 for n in notifications if not n.is_read
        ),
        alert_notifications=sum(
            1 for n in notifications if n.notification_type == "alert"
        ),
        today_notifications=sum(
            1 for n in notifications
            if n.created_at and n.created_at >= start_of_today
        ),
        active_page="family_notifications"
    )


# ==========================================================
# Family Portal - Settings
#
# Manages only what applies to a family member's own account:
# portal preferences, notification preferences, sign-in
# security and password. Ring options (auto-sync, battery %,
# data sharing) belong to the patient and are not shown.
# ==========================================================

FAMILY_LANGUAGES = [
    "English", "Tamil", "Hindi", "Malayalam", "Telugu", "Kannada"
]

FAMILY_TIMEZONES = [
    ("Asia/Kolkata", "India Standard Time (Asia/Kolkata)"),
    ("Asia/Dubai", "Gulf Standard Time (Asia/Dubai)"),
    ("Asia/Singapore", "Singapore Time (Asia/Singapore)"),
    ("Europe/London", "UK Time (Europe/London)"),
    ("America/New_York", "US Eastern (America/New_York)"),
    ("America/Los_Angeles", "US Pacific (America/Los_Angeles)"),
    ("Australia/Sydney", "Australia Eastern (Australia/Sydney)"),
    ("UTC", "Coordinated Universal Time (UTC)"),
]

FAMILY_NOTIFICATION_FIELDS = (
    "email_notifications",
    "sms_notifications",
    "emergency_notifications",
    "appointment_notifications",
    "report_notifications",
    "ai_notifications",
)


def _get_or_create_family_setting(user_id):
    """Return this user's Setting row, creating it with defaults."""

    setting = Setting.query.filter_by(user_id=user_id).first()

    if not setting:
        setting = Setting(user_id=user_id)
        db.session.add(setting)
        db.session.commit()

    return setting


def _validate_family_password(password):
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


@family_bp.route("/settings", methods=["GET", "POST"])
def family_settings():

    ctx = _family_portal_context()

    if ctx is None:
        return redirect(url_for("pages.login"))

    user, family_member, patients = ctx

    setting = _get_or_create_family_setting(user.id)

    def back(anchor=None):
        return redirect(url_for("family.family_settings", _anchor=anchor))

    if request.method == "POST":

        section = request.form.get("section", "")

        # ---------------- Portal preferences ----------------
        if section == "preferences":

            theme = request.form.get("theme", "light")
            language = request.form.get("language", "English")
            timezone = request.form.get("timezone", "Asia/Kolkata")

            valid_timezones = {tz for tz, _ in FAMILY_TIMEZONES}
            valid_timezones.add(setting.timezone)
            valid_languages = set(FAMILY_LANGUAGES)
            valid_languages.add(setting.language)

            if (
                theme not in ("light", "dark")
                or language not in valid_languages
                or timezone not in valid_timezones
            ):
                flash("Please choose valid preference options.", "danger")
                return back("preferences")

            setting.theme = theme
            setting.language = language
            setting.timezone = timezone
            db.session.commit()

            flash("Preferences saved successfully.", "success")
            return back("preferences")

        # ---------------- Notification preferences ----------------
        if section == "notifications":

            for field in FAMILY_NOTIFICATION_FIELDS:
                setattr(setting, field, field in request.form)

            db.session.commit()

            flash("Notification preferences saved successfully.", "success")
            return back("notifications")

        # ---------------- Sign-in security ----------------
        if section == "security":

            setting.login_alerts = "login_alerts" in request.form
            db.session.commit()

            flash("Security preferences saved successfully.", "success")
            return back("security")

        # ---------------- Reset to defaults ----------------
        if section == "reset_preferences":

            setting.theme = "light"
            setting.language = "English"
            setting.timezone = "Asia/Kolkata"
            db.session.commit()

            flash("Preferences reset to defaults.", "success")
            return back("preferences")

        if section == "reset_notifications":

            setting.email_notifications = True
            setting.sms_notifications = False
            setting.emergency_notifications = True
            setting.appointment_notifications = True
            setting.report_notifications = True
            setting.ai_notifications = True
            db.session.commit()

            flash("Notification preferences reset to defaults.", "success")
            return back("notifications")

        flash("Invalid request.", "danger")
        return back()

    recent_logins = (
        LoginHistory.query
        .filter_by(user_id=user.id)
        .order_by(LoginHistory.login_time.desc())
        .limit(5)
        .all()
    )

    return render_template(
        "family/settings.html",
        user=user,
        family_member=family_member,
        setting=setting,
        languages=FAMILY_LANGUAGES,
        timezones=FAMILY_TIMEZONES,
        recent_logins=recent_logins,
        active_page="family_settings"
    )


@family_bp.route("/settings/password", methods=["POST"])
def family_change_password():

    ctx = _family_portal_context()

    if ctx is None:
        return redirect(url_for("pages.login"))

    user, family_member, patients = ctx

    current_pwd = request.form.get("current_password", "")
    new_pwd = request.form.get("new_password", "")
    confirm_pwd = request.form.get("confirm_password", "")

    target = url_for("family.family_settings", _anchor="password")

    if not user.password_hash or not check_password_hash(
        user.password_hash, current_pwd
    ):
        flash("Current password is incorrect.", "danger")
        return redirect(target)

    problem = _validate_family_password(new_pwd)

    if problem:
        flash(problem, "warning")
        return redirect(target)

    if new_pwd != confirm_pwd:
        flash("New passwords do not match.", "warning")
        return redirect(target)

    if check_password_hash(user.password_hash, new_pwd):
        flash(
            "New password must be different from the current password.",
            "warning"
        )
        return redirect(target)

    user.password_hash = generate_password_hash(new_pwd)
    db.session.commit()

    flash("Password changed successfully.", "success")
    return redirect(target)
