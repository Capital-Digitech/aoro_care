from datetime import datetime

from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    jsonify,
    abort,
    session,
    send_file
)
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment
from openpyxl.worksheet.table import Table, TableStyleInfo

from database import db
from models import Patient, Doctor, Appointment, Hospital, Notification
from utils import get_hospital_scope


# ==========================================================
# Blueprint
# ==========================================================

appointment_bp = Blueprint(
    "appointment",
    __name__,
    url_prefix="/appointment"
)


# ==========================================================
# Helpers
# ==========================================================

def _parse_date(value):

    if not value:
        return None

    try:
        return datetime.strptime(
            value,
            "%Y-%m-%d"
        ).date()

    except ValueError:
        return None



def _parse_time(value):

    if not value:
        return None

    try:
        return datetime.strptime(
            value,
            "%H:%M"
        ).time()

    except ValueError:
        return None



def _current_doctor():
    # NOTE: this helper was previously defined twice, back to back,
    # with identical bodies (harmless but dead duplicate code). The
    # duplicate has been removed since this function sits directly in
    # the section that powers the My Appointments page.

    if "user" not in session:
        abort(401, description="Login required.")

    if session["user"]["role"] != "doctor":
        abort(403, description="Doctor access required.")

    user_id = session["user"]["id"]

    doctor = Doctor.query.filter_by(
        user_id=user_id
    ).first()

    if doctor is None:
        abort(403, description="Doctor profile not found.")

    return doctor


def _get_doctor_appointment(appointment_id):
    """Fetch an appointment, scoped to the logged-in doctor.

    This is the single authorization choke point for every doctor
    appointment action (view/edit/delete): if the appointment doesn't
    belong to the current doctor, it 404s rather than leaking whether
    the ID exists at all.
    """

    doctor = _current_doctor()

    appointment = Appointment.query.filter_by(
        id=appointment_id,
        doctor_id=doctor.id
    ).first()

    if appointment is None:
        abort(404, description="Appointment not found.")

    return appointment


def _serialize_appointment(appointment):
    patient_name = "-"
    patient_code = "-"

    if appointment.patient and appointment.patient.user:
        patient_name = (
            f"{appointment.patient.user.first_name} "
            f"{appointment.patient.user.last_name}"
        ).strip()
        patient_code = appointment.patient.patient_code or "-"

    doctor_name = "-"

    if appointment.doctor and appointment.doctor.user:
        doctor_name = (
            f"Dr. {appointment.doctor.user.first_name} "
            f"{appointment.doctor.user.last_name}"
        ).strip()

    return dict(
        id=appointment.id,
        patient_name=patient_name,
        patient_code=patient_code,
        doctor_name=doctor_name,
        appointment_date=(
            appointment.appointment_date.strftime("%Y-%m-%d")
            if appointment.appointment_date else ""
        ),
        appointment_time=(
            appointment.appointment_time.strftime("%H:%M")
            if appointment.appointment_time else ""
        ),
        appointment_type=appointment.appointment_type or "",
        status=appointment.status or "scheduled",
        reason=appointment.reason or "",
        rejection_reason=appointment.rejection_reason or "",
        meeting_link=appointment.meeting_link or ""
    )


# ==========================================================
# ADMIN APPOINTMENT LIST
# ==========================================================

@appointment_bp.route("/")
def appointment_list():
    scope = get_hospital_scope()

    if scope.is_admin:
        if scope.unassigned:
            appointments = []
            patients = []
            doctors = []
            hospitals = []
        else:
            appointments = (
                Appointment.query
                .filter(Appointment.hospital_id == scope.hospital_id)
                .order_by(Appointment.created_at.desc())
                .all()
            )
            patients = (
                Patient.query
                .filter(Patient.id.in_(scope.patient_ids), Patient.status == "active")
                .all()
            )
            doctors = (
                Doctor.query
                .filter(Doctor.hospital_id == scope.hospital_id, Doctor.status == "active")
                .all()
            )
            hospitals = [scope.hospital] if scope.hospital else []
    else:
        appointments = Appointment.query.order_by(
            Appointment.created_at.desc()
        ).all()
        patients = Patient.query.filter_by(
            status="active"
        ).all()
        doctors = Doctor.query.filter_by(
            status="active"
        ).all()
        hospitals = Hospital.query.filter_by(
            status="active"
        ).all()

    return render_template(
        "appointment/appointment_list.html",
        appointments=appointments,
        patients=patients,
        doctors=doctors,
        hospitals=hospitals
    )


# ==========================================================
# ADMIN ADD APPOINTMENT
# ==========================================================

@appointment_bp.route(
    "/add",
    methods=["GET", "POST"]
)
def appointment_add():
    scope = get_hospital_scope()

    if scope.is_admin:
        if scope.unassigned:
            flash("You must be assigned to a hospital to schedule appointments.", "danger")
            return redirect(url_for("appointment.appointment_list"))
        patients = Patient.query.filter(
            Patient.id.in_(scope.patient_ids),
            Patient.status == "active"
        ).all()
        doctors = Doctor.query.filter(
            Doctor.hospital_id == scope.hospital_id,
            Doctor.status == "active"
        ).all()
        hospitals = [scope.hospital] if scope.hospital else []
    else:
        patients = Patient.query.filter_by(
            status="active"
        ).all()
        doctors = Doctor.query.filter_by(
            status="active"
        ).all()
        hospitals = Hospital.query.filter_by(
            status="active"
        ).all()

    if request.method == "POST":
        patient_id = request.form.get("patient_id")
        doctor_id = request.form.get("doctor_id") or None
        hospital_id = scope.hospital_id if scope.is_admin else request.form.get("hospital_id")

        if scope.is_admin:
            from models import Patient as PatientModel
            patient_valid = db.session.query(
                PatientModel.query.filter(
                    PatientModel.id == patient_id,
                    PatientModel.id.in_(scope.patient_ids)
                ).exists()
            ).scalar()
            if not patient_valid:
                flash("Selected patient does not belong to your hospital.", "danger")
                return render_template(
                    "appointment/add_appointment.html",
                    patients=patients,
                    doctors=doctors,
                    hospitals=hospitals
                )

            if doctor_id:
                doc = Doctor.query.get(doctor_id)
                if not doc or doc.hospital_id != scope.hospital_id:
                    flash("Selected doctor does not belong to your hospital.", "danger")
                    return render_template(
                        "appointment/add_appointment.html",
                        patients=patients,
                        doctors=doctors,
                        hospitals=hospitals
                    )

        appointment = Appointment(
            patient_id=patient_id,
            doctor_id=doctor_id,
            hospital_id=hospital_id,
            appointment_date=_parse_date(
                request.form.get("appointment_date")
            ),
            appointment_time=_parse_time(
                request.form.get("appointment_time")
            ),
            appointment_type=request.form.get("appointment_type"),
            reason=request.form.get("reason"),
            meeting_link=request.form.get("meeting_link"),
            status=request.form.get("status", "scheduled")
        )

        db.session.add(appointment)
        db.session.commit()

        flash(
            "Appointment added successfully.",
            "success"
        )

        return redirect(
            url_for("appointment.appointment_list")
        )

    return render_template(
        "appointment/add_appointment.html",
        patients=patients,
        doctors=doctors,
        hospitals=hospitals
    )


# ==========================================================
# ADMIN EDIT APPOINTMENT
# ==========================================================

@appointment_bp.route(
    "/edit/<string:id>",
    methods=["GET", "POST"]
)
def appointment_edit(id):

    appointment = Appointment.query.get_or_404(id)
    scope = get_hospital_scope()

    if not scope.can_access_appointment(appointment):
        flash("Access denied. You do not have permission to edit this appointment.", "danger")
        return redirect(url_for("appointment.appointment_list"))

    if scope.is_admin:
        patients = Patient.query.filter(
            Patient.id.in_(scope.patient_ids),
            Patient.status == "active"
        ).all()
        doctors = Doctor.query.filter(
            Doctor.hospital_id == scope.hospital_id,
            Doctor.status == "active"
        ).all()
        hospitals = [scope.hospital] if scope.hospital else []
    else:
        patients = Patient.query.filter_by(
            status="active"
        ).all()
        doctors = Doctor.query.filter_by(
            status="active"
        ).all()
        hospitals = Hospital.query.filter_by(
            status="active"
        ).all()

    if request.method == "POST":
        patient_id = request.form.get("patient_id")
        doctor_id = request.form.get("doctor_id") or None
        hospital_id = scope.hospital_id if scope.is_admin else request.form.get("hospital_id")

        if scope.is_admin:
            from models import Patient as PatientModel
            patient_valid = db.session.query(
                PatientModel.query.filter(
                    PatientModel.id == patient_id,
                    PatientModel.id.in_(scope.patient_ids)
                ).exists()
            ).scalar()
            if not patient_valid:
                flash("Selected patient does not belong to your hospital.", "danger")
                return render_template(
                    "appointment/edit_appointment.html",
                    appointment=appointment,
                    patients=patients,
                    doctors=doctors,
                    hospitals=hospitals
                )

            if doctor_id:
                doc = Doctor.query.get(doctor_id)
                if not doc or doc.hospital_id != scope.hospital_id:
                    flash("Selected doctor does not belong to your hospital.", "danger")
                    return render_template(
                        "appointment/edit_appointment.html",
                        appointment=appointment,
                        patients=patients,
                        doctors=doctors,
                        hospitals=hospitals
                    )

        appointment.patient_id = patient_id
        appointment.doctor_id = doctor_id
        appointment.hospital_id = hospital_id
        appointment.appointment_date = _parse_date(
            request.form.get("appointment_date")
        )
        appointment.appointment_time = _parse_time(
            request.form.get("appointment_time")
        )
        appointment.appointment_type = request.form.get("appointment_type")
        appointment.reason = request.form.get("reason")
        appointment.meeting_link = request.form.get("meeting_link")
        appointment.status = request.form.get("status")

        db.session.commit()

        flash(
            "Appointment updated successfully.",
            "success"
        )

        return redirect(
            url_for("appointment.appointment_list")
        )

    return render_template(
        "appointment/edit_appointment.html",
        appointment=appointment,
        patients=patients,
        doctors=doctors,
        hospitals=hospitals
    )
# ==========================================================
# ADMIN EXPORT APPOINTMENTS — EXCEL
# ==========================================================

@appointment_bp.route("/export")
def appointment_export():
    ids = request.args.get("ids", "")

    if not ids:
        return jsonify(
            success=False,
            message="No appointments selected for export."
        ), 400

    appointment_ids = [
        value.strip()
        for value in ids.split(",")
        if value.strip()
    ]

    if not appointment_ids:
        return jsonify(
            success=False,
            message="No appointments selected for export."
        ), 400

    scope = get_hospital_scope()
    query = Appointment.query.filter(
        Appointment.id.in_(appointment_ids)
    )
    if scope.is_admin:
        if scope.unassigned:
            return jsonify(
                success=False,
                message="No appointments found."
            ), 404
        query = query.filter(Appointment.hospital_id == scope.hospital_id)

    appointments = query.order_by(
        Appointment.created_at.desc()
    ).all()

    if not appointments:
        return jsonify(
            success=False,
            message="No appointments found."
        ), 404

    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Appointments"

    headers = [
        "Patient",
        "Doctor",
        "Appointment Date",
        "Appointment Time",
        "Appointment Type",
        "Status",
        "Reason",
        "Meeting Link"
    ]

    worksheet.append(headers)

    for appointment in appointments:
        patient_name = "-"

        if appointment.patient and appointment.patient.user:
            patient_name = (
                f"{appointment.patient.user.first_name} "
                f"{appointment.patient.user.last_name}"
            ).strip()

        doctor_name = "-"

        if appointment.doctor and appointment.doctor.user:
            doctor_name = (
                f"Dr. {appointment.doctor.user.first_name} "
                f"{appointment.doctor.user.last_name}"
            ).strip()

        appointment_type = (
            appointment.appointment_type or "-"
        ).strip()

        appointment_type_map = {
            "online": "Online",
            "offline": "Offline"
        }

        appointment_type = appointment_type_map.get(
            appointment_type.lower(),
            appointment_type
        )

        status = (appointment.status or "-").strip()

        status_map = {
            "pending": "Pending Confirmation",
            "scheduled": "Scheduled",
            "completed": "Completed",
            "cancelled": "Cancelled",
            "rejected": "Rejected"
        }

        status = status_map.get(
            status.lower(),
            status
        )

        worksheet.append([
            patient_name,
            doctor_name,
            appointment.appointment_date,
            appointment.appointment_time,
            appointment_type,
            status,
            appointment.reason or "",
            appointment.meeting_link or ""
        ])

    # Header formatting
    for cell in worksheet[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(
            horizontal="center",
            vertical="center"
        )

    # Cell alignment
    for row in worksheet.iter_rows(
        min_row=2,
        max_row=worksheet.max_row
    ):
        for cell in row:
            cell.alignment = Alignment(
                vertical="center"
            )

    # Date/time formatting
    for row in worksheet.iter_rows(
        min_row=2,
        max_row=worksheet.max_row
    ):
        date_cell = row[2]
        time_cell = row[3]

        if date_cell.value:
            date_cell.number_format = "yyyy-mm-dd"

        if time_cell.value:
            time_cell.number_format = "hh:mm AM/PM"

    # Meeting links as clickable hyperlinks
    for row in worksheet.iter_rows(
        min_row=2,
        max_row=worksheet.max_row
    ):
        meeting_cell = row[7]

        if meeting_cell.value:
            meeting_cell.hyperlink = meeting_cell.value
            meeting_cell.style = "Hyperlink"

    # Excel table
    if worksheet.max_row >= 2:
        table_ref = (
            f"A1:H{worksheet.max_row}"
        )

        excel_table = Table(
            displayName="AppointmentsTable",
            ref=table_ref
        )

        table_style = TableStyleInfo(
            name="TableStyleMedium2",
            showFirstColumn=False,
            showLastColumn=False,
            showRowStripes=True,
            showColumnStripes=False
        )

        excel_table.tableStyleInfo = table_style
        worksheet.add_table(excel_table)

    # Column widths
    column_widths = {
        "A": 24,
        "B": 24,
        "C": 18,
        "D": 20,
        "E": 20,
        "F": 16,
        "G": 35,
        "H": 45
    }

    for column, width in column_widths.items():
        worksheet.column_dimensions[column].width = width

    worksheet.freeze_panes = "A2"
    worksheet.auto_filter.ref = worksheet.dimensions

    output = BytesIO()
    workbook.save(output)
    output.seek(0)

    filename = (
        f"appointments_"
        f"{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    )

    return send_file(
        output,
        as_attachment=True,
        download_name=filename,
        mimetype=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        )
    )

# ==========================================================
# ADMIN VIEW APPOINTMENT
# ==========================================================

@appointment_bp.route(
    "/view/<string:id>"
)
def appointment_view(id):

    appointment = Appointment.query.get_or_404(
        id
    )
    scope = get_hospital_scope()
    if not scope.can_access_appointment(appointment):
        flash("Access denied. You do not have permission to view this appointment.", "danger")
        return redirect(url_for("appointment.appointment_list"))

    return render_template(
        "appointment/view_appointment.html",
        appointment=appointment
    )



# ==========================================================
# ADMIN DELETE APPOINTMENT
# ==========================================================

@appointment_bp.route(
    "/delete/<string:id>",
    methods=["POST"]
)
def appointment_delete(id):

    appointment = Appointment.query.get_or_404(
        id
    )
    scope = get_hospital_scope()
    if not scope.can_access_appointment(appointment):
        flash("Access denied. You do not have permission to delete this appointment.", "danger")
        return redirect(url_for("appointment.appointment_list"))

    db.session.delete(
        appointment
    )

    db.session.commit()

    flash(
        "Appointment deleted successfully.",
        "success"
    )

    return redirect(
        url_for(
            "appointment.appointment_list"
        )
    )
# ==========================================================
# DOCTOR APPOINTMENT LIST
# ==========================================================

@appointment_bp.route("/doctor")
def doctor_appointment_list():

    doctor = _current_doctor()

    appointments = Appointment.query.filter_by(
        doctor_id=doctor.id
    ).order_by(
        Appointment.appointment_date.desc()
    ).all()

    return render_template(
        "doctor/doctor_appointment_list.html",
        doctor=doctor,
        appointments=appointments,
        now=datetime.utcnow
    )


# ==========================================================
# DOCTOR VIEW APPOINTMENT (JSON)
#
# Powers the "View" action and also feeds the "Edit" modal's
# pre-fill, so there's one source of truth for what a doctor
# is allowed to see about one of their own appointments.
# ==========================================================

@appointment_bp.route(
    "/doctor/<string:appointment_id>",
    methods=["GET"]
)
def doctor_appointment_detail(appointment_id):

    appointment = _get_doctor_appointment(
        appointment_id
    )

    return jsonify(
        success=True,
        appointment=_serialize_appointment(appointment)
    )


# ==========================================================
# DOCTOR EDIT APPOINTMENT
#
# Replaces the old confirm/complete/cancel/reschedule routes.
# Those set status="confirmed", which is not a valid value in
# the Appointment.status enum (scheduled/completed/cancelled/
# missed) and would fail at commit time — this route validates
# against the real enum instead. A doctor can update date,
# time, type, status and reason for an appointment that
# belongs to them; patient/doctor/hospital assignment stays
# admin-only, unchanged from before.
# ==========================================================

VALID_APPOINTMENT_TYPES = {"online", "offline", "emergency"}
VALID_APPOINTMENT_STATUSES = {
    "pending", "scheduled", "completed", "cancelled", "missed", "rejected"
}


@appointment_bp.route(
    "/doctor/<string:appointment_id>/edit",
    methods=["POST"]
)
def doctor_appointment_edit(appointment_id):

    appointment = _get_doctor_appointment(
        appointment_id
    )

    new_date = _parse_date(
        request.form.get("appointment_date")
    )

    new_time = _parse_time(
        request.form.get("appointment_time")
    )

    appointment_type = request.form.get("appointment_type")
    status = request.form.get("status")
    reason = request.form.get("reason")

    if not new_date or not new_time:
        abort(400, description="Valid date and time required.")

    if appointment_type not in VALID_APPOINTMENT_TYPES:
        abort(400, description="Invalid appointment type.")

    if status not in VALID_APPOINTMENT_STATUSES:
        abort(400, description="Invalid status.")

    appointment.appointment_date = new_date
    appointment.appointment_time = new_time
    appointment.appointment_type = appointment_type
    appointment.status = status
    appointment.reason = reason

    # A rejection reason only applies while the appointment is rejected
    if status != "rejected":
        appointment.rejection_reason = None

    db.session.commit()

    return jsonify(
        success=True,
        message="Appointment updated successfully.",
        appointment=_serialize_appointment(appointment)
    )


# ==========================================================
# DOCTOR CONFIRM / REJECT APPOINTMENT REQUEST
#
# A patient request is stored as status="pending" (shown as
# "Pending Confirmation"). The assigned doctor either confirms it
# (status becomes "scheduled") or rejects it (status becomes
# "rejected" with a stored rejection_reason). Only pending
# requests belonging to the logged-in doctor can be actioned;
# _get_doctor_appointment() already enforces the ownership.
# ==========================================================

def _notify_patient(appointment, title, message):
    patient = appointment.patient

    if patient and patient.user_id:
        db.session.add(Notification(
            user_id=patient.user_id,
            title=title,
            message=message,
            notification_type="appointment",
            is_read=False
        ))


def _appointment_when(appointment):
    return (
        f"{appointment.appointment_date.strftime('%b %d, %Y')} at "
        f"{appointment.appointment_time.strftime('%I:%M %p')}"
    )


@appointment_bp.route(
    "/doctor/<string:appointment_id>/confirm",
    methods=["POST"]
)
def doctor_appointment_confirm(appointment_id):

    appointment = _get_doctor_appointment(
        appointment_id
    )

    if appointment.status != "pending":
        return jsonify(
            success=False,
            message="Only appointments pending confirmation can be confirmed."
        ), 400

    appointment.status = "scheduled"
    appointment.rejection_reason = None

    _notify_patient(
        appointment,
        "Appointment Confirmed",
        f"Your appointment on {_appointment_when(appointment)} "
        "has been confirmed."
    )

    db.session.commit()

    return jsonify(
        success=True,
        message="Appointment confirmed.",
        appointment=_serialize_appointment(appointment)
    )


@appointment_bp.route(
    "/doctor/<string:appointment_id>/reject",
    methods=["POST"]
)
def doctor_appointment_reject(appointment_id):

    appointment = _get_doctor_appointment(
        appointment_id
    )

    if appointment.status != "pending":
        return jsonify(
            success=False,
            message="Only appointments pending confirmation can be rejected."
        ), 400

    rejection_reason = (
        request.form.get("rejection_reason") or ""
    ).strip()

    if not rejection_reason:
        return jsonify(
            success=False,
            message="Please enter a reason for rejecting this appointment."
        ), 400

    if len(rejection_reason) > 500:
        return jsonify(
            success=False,
            message="Rejection reason must be 500 characters or fewer."
        ), 400

    appointment.status = "rejected"
    appointment.rejection_reason = rejection_reason

    _notify_patient(
        appointment,
        "Appointment Rejected",
        f"Your appointment request for {_appointment_when(appointment)} "
        f"was rejected. Reason: {rejection_reason}"
    )

    db.session.commit()

    return jsonify(
        success=True,
        message="Appointment rejected.",
        appointment=_serialize_appointment(appointment)
    )


# ==========================================================
# DOCTOR DELETE APPOINTMENT
# ==========================================================

@appointment_bp.route(
    "/doctor/<string:appointment_id>/delete",
    methods=["POST"]
)
def doctor_appointment_delete(appointment_id):

    appointment = _get_doctor_appointment(
        appointment_id
    )

    db.session.delete(appointment)
    db.session.commit()

    return jsonify(
        success=True,
        message="Appointment deleted successfully."
    )


# ==========================================================
# ERROR HANDLERS
# ==========================================================

@appointment_bp.errorhandler(400)
def bad_request(error):

    return jsonify(
        success=False,
        message=str(error.description)
    ), 400



@appointment_bp.errorhandler(401)
def unauthorized(error):

    return jsonify(
        success=False,
        message=str(error.description)
    ), 401



@appointment_bp.errorhandler(403)
def forbidden(error):

    return jsonify(
        success=False,
        message=str(error.description)
    ), 403



@appointment_bp.errorhandler(404)
def not_found(error):

    return jsonify(
        success=False,
        message=str(error.description)
    ), 404



@appointment_bp.errorhandler(500)
def internal_error(error):

    db.session.rollback()


    return jsonify(
        success=False,
        message="Internal Server Error."
    ), 500