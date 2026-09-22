import os
import uuid

from datetime import datetime

from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session,
    abort,
    jsonify,
)

from werkzeug.utils import secure_filename

from database import db

from models import (
    Patient,
    Doctor,
    Appointment,
    Prescription,
    PrescriptionMedicine,
    PrescriptionReport,
    PrescriptionClinicalData,
    HealthData,
)


prescription_bp = Blueprint(
    "prescription",
    __name__,
    url_prefix="/prescription"
)


# ==========================================================
# Upload Configuration
# ==========================================================

ALLOWED_REPORT_EXTENSIONS = {
    "pdf",
    "jpg",
    "jpeg",
    "png"
}

MAX_REPORT_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

REPORT_UPLOAD_FOLDERS = {
    "Blood Test": "blood_tests",
    "Scan": "scans"
}


# ==========================================================
# Helpers
# ==========================================================

def _get_logged_in_doctor():
    """
    Returns the currently logged-in Doctor record.

    Returns None if:
    - user is not logged in
    - logged-in user is not a doctor
    - doctor record does not exist
    """

    if "user" not in session:
        return None

    if session["user"].get("role") != "doctor":
        return None

    return Doctor.query.filter_by(
        user_id=session["user"]["id"]
    ).first()


def _parse_date(value):
    return (
        datetime.strptime(
            value,
            "%Y-%m-%d"
        ).date()
        if value
        else None
    )


def _parse_time(value):
    return (
        datetime.strptime(
            value,
            "%H:%M"
        ).time()
        if value
        else None
    )

def _parse_optional_float(value, field_name):
    value = (value or "").strip()

    if not value:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError(
            f"{field_name} must be a valid number."
        )


def _parse_optional_int(value, field_name):
    value = (value or "").strip()

    if not value:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValueError(
            f"{field_name} must be a valid whole number."
        )
    
def _collect_medicine_rows(form):
    """
    Reads medicine_name[] / medicine_type[] / ... from the
    submitted form and returns:

      1. list of medicine dictionaries
      2. comma-separated medicine names for legacy column

    Index-safe:
    If one medicine field has fewer values than another,
    it will not raise IndexError.
    """

    names = form.getlist(
        "medicine_name[]"
    )

    types = form.getlist(
        "medicine_type[]"
    )

    dosages = form.getlist(
        "medicine_dosage[]"
    )

    quantities = form.getlist(
        "medicine_quantity[]"
    )

    frequencies = form.getlist(
        "medicine_frequency[]"
    )

    taking_times = form.getlist(
        "medicine_taking_time[]"
    )

    durations = form.getlist(
        "medicine_duration[]"
    )

    instructions = form.getlist(
        "medicine_instructions[]"
    )

    def _at(lst, index, default=None):

        value = (
            lst[index].strip()
            if index < len(lst) and lst[index]
            else ""
        )

        return value or default

    rows = []

    for index, name in enumerate(names):

        name = (
            name or ""
        ).strip()

        if not name:
            continue

        rows.append({
            "medicine_name": name,

            "medicine_type": _at(
                types,
                index,
                "Tablet"
            ),

            "dosage": _at(
                dosages,
                index
            ),

            "quantity": _at(
                quantities,
                index
            ),

            "frequency": _at(
                frequencies,
                index
            ),

            "taking_time": _at(
                taking_times,
                index
            ),

            "duration": _at(
                durations,
                index
            ),

            "instructions": _at(
                instructions,
                index
            ),
        })

    legacy_medicines = ", ".join(
        row["medicine_name"]
        for row in rows
    )

    return rows, legacy_medicines


# ==========================================================
# Prescription Report Upload Helpers
# ==========================================================

def _allowed_report_file(filename):
    """
    Check whether uploaded report has an allowed extension.
    """

    if not filename or "." not in filename:
        return False

    extension = filename.rsplit(
        ".",
        1
    )[1].lower()

    return extension in ALLOWED_REPORT_EXTENSIONS


def _save_prescription_reports(
    prescription,
    files,
    report_type,
    start_times=None,
    end_times=None,
    remarks=None
):
    """
    Save uploaded prescription reports with optional
    report timing and doctor remarks.
    """

    if report_type not in REPORT_UPLOAD_FOLDERS:
        raise ValueError("Invalid report type.")

    start_times = start_times or []
    end_times = end_times or []
    remarks = remarks or []

    folder_name = REPORT_UPLOAD_FOLDERS[report_type]

    upload_dir = os.path.join(
        os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))
        ),
        "static",
        "uploads",
        "prescriptions",
        prescription.id,
        folder_name
    )

    os.makedirs(
        upload_dir,
        exist_ok=True
    )

    saved_files = []

    try:
        for index, file in enumerate(files):

            if not file or not file.filename:
                continue

            # ------------------------------------------
            # Validate extension
            # ------------------------------------------
            if not _allowed_report_file(file.filename):
                raise ValueError(
                    f"Unsupported file format: {file.filename}"
                )

            # ------------------------------------------
            # Validate file size
            # ------------------------------------------
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)

            if file_size > MAX_REPORT_FILE_SIZE:
                raise ValueError(
                    f"{file.filename} exceeds the 10 MB limit."
                )

            # ------------------------------------------
            # Secure original filename
            # ------------------------------------------
            original_filename = secure_filename(
                file.filename
            )

            if not original_filename:
                raise ValueError(
                    "Invalid file name."
                )

            # ------------------------------------------
            # Generate stored filename
            # ------------------------------------------
            extension = os.path.splitext(
                original_filename
            )[1].lower()

            stored_filename = (
                f"{uuid.uuid4().hex}{extension}"
            )

            absolute_file_path = os.path.join(
                upload_dir,
                stored_filename
            )

            # ------------------------------------------
            # Save physical file
            # ------------------------------------------
            file.save(
                absolute_file_path
            )

            # ------------------------------------------
            # Relative static path
            # ------------------------------------------
            relative_file_path = os.path.join(
                "uploads",
                "prescriptions",
                prescription.id,
                folder_name,
                stored_filename
            ).replace("\\", "/")

            # ------------------------------------------
            # Per-file metadata
            # ------------------------------------------
            start_time_value = (
                start_times[index]
                if index < len(start_times)
                else ""
            )

            end_time_value = (
                end_times[index]
                if index < len(end_times)
                else ""
            )

            remarks_value = (
                remarks[index].strip()
                if index < len(remarks) and remarks[index]
                else None
            )

            # ------------------------------------------
            # Parse times
            # ------------------------------------------
            start_time = _parse_time(
                start_time_value
            )

            end_time = _parse_time(
                end_time_value
            )

            # ------------------------------------------
            # Create DB record
            # ------------------------------------------
            report = PrescriptionReport(
                prescription_id=prescription.id,
                report_type=report_type,
                original_filename=original_filename,
                stored_filename=stored_filename,
                file_path=relative_file_path,
                file_type=file.mimetype,
                file_size=file_size,
                report_start_time=start_time,
                report_end_time=end_time,
                remarks=remarks_value
            )

            db.session.add(report)

            saved_files.append(
                absolute_file_path
            )

    except Exception:
        # ------------------------------------------
        # Cleanup physical files if saving fails
        # ------------------------------------------
        for saved_file in saved_files:
            try:
                if os.path.exists(saved_file):
                    os.remove(saved_file)
            except Exception:
                pass

        raise

# ==========================================================
# ADMIN
# Prescription List
# ==========================================================

@prescription_bp.route("/")
def prescription_list():

    prescriptions = (
        Prescription.query
        .order_by(
            Prescription.prescribed_date.desc()
        )
        .all()
    )

    patients = (
        Patient.query
        .filter_by(
            status="active"
        )
        .all()
    )

    doctors = (
        Doctor.query
        .filter_by(
            status="active"
        )
        .all()
    )

    appointments = (
        Appointment.query
        .all()
    )

    return render_template(
        "prescription/prescription_list.html",
        prescriptions=prescriptions,
        patients=patients,
        doctors=doctors,
        appointments=appointments
    )


# ==========================================================
# ADMIN
# Add Prescription
# ==========================================================

@prescription_bp.route(
    "/add",
    methods=["GET", "POST"]
)
def prescription_add():

    patients = (
        Patient.query
        .filter_by(
            status="active"
        )
        .all()
    )

    doctors = (
        Doctor.query
        .filter_by(
            status="active"
        )
        .all()
    )

    appointments = (
        Appointment.query
        .all()
    )

    if request.method == "POST":

        patient_id = request.form.get(
            "patient_id"
        )

        doctor_id = request.form.get(
            "doctor_id"
        )

        appointment_id = (
            request.form.get(
                "appointment_id"
            )
            or None
        )

        diagnosis = (
            request.form.get(
                "diagnosis",
                ""
            ).strip()
        )

        current_analysis = (
            request.form.get(
                "current_analysis",
                ""
            ).strip()
        )

        follow_up_notes = (
            request.form.get(
                "follow_up_notes",
                ""
            ).strip()
        )

        status = request.form.get(
            "status",
            "Active"
        )

        # --------------------------------------------------
        # Validation
        # --------------------------------------------------

        if (
            not patient_id
            or not doctor_id
            or not diagnosis
        ):

            flash(
                "Patient, Doctor and Diagnosis are required.",
                "danger"
            )

            return render_template(
                "prescription/prescription_add.html",
                patients=patients,
                doctors=doctors,
                appointments=appointments
            )

        medicine_rows, legacy_medicines = (
            _collect_medicine_rows(
                request.form
            )
        )

        if not medicine_rows:

            flash(
                "Please add at least one medicine.",
                "danger"
            )

            return render_template(
                "prescription/prescription_add.html",
                patients=patients,
                doctors=doctors,
                appointments=appointments
            )

        # --------------------------------------------------
        # Create Prescription
        # --------------------------------------------------

        prescription = Prescription(
            patient_id=patient_id,
            doctor_id=doctor_id,
            appointment_id=appointment_id,
            diagnosis=diagnosis,
            medicines=legacy_medicines,
            dosage=None,
            instructions=None,
            current_analysis=(
                current_analysis
                or None
            ),
            follow_up_date=_parse_date(
                request.form.get(
                    "follow_up_date"
                )
                or None
            ),
            follow_up_time=_parse_time(
                request.form.get(
                    "follow_up_time"
                )
                or None
            ),
            follow_up_notes=(
                follow_up_notes
                or None
            ),
            status=status
        )

        db.session.add(
            prescription
        )

        db.session.flush()

        # --------------------------------------------------
        # Add Medicines
        # --------------------------------------------------

        for row in medicine_rows:

            db.session.add(
                PrescriptionMedicine(
                    prescription_id=prescription.id,
                    **row
                )
            )

        db.session.commit()

        flash(
            "Prescription added successfully.",
            "success"
        )

        return redirect(
            url_for(
                "prescription.prescription_list"
            )
        )

    return render_template(
        "prescription/prescription_add.html",
        patients=patients,
        doctors=doctors,
        appointments=appointments
    )


# ==========================================================
# ADMIN
# Edit Prescription
# ==========================================================

@prescription_bp.route(
    "/edit/<string:id>",
    methods=["GET", "POST"]
)
def prescription_edit(id):

    prescription = (
        Prescription.query
        .get_or_404(id)
    )

    # ------------------------------------------------------
    # Check Admin / Super Admin login
    # ------------------------------------------------------

    if "user" not in session:
        return redirect(
            url_for("pages.login")
        )

    role = session["user"].get("role")

    if role not in (
        "admin",
        "super_admin"
    ):
        abort(403)

    # ------------------------------------------------------
    # Admin data
    # ------------------------------------------------------

    patients = (
        Patient.query
        .filter_by(
            status="active"
        )
        .all()
    )

    doctors = (
        Doctor.query
        .filter_by(
            status="active"
        )
        .all()
    )

    appointments = (
        Appointment.query
        .all()
    )

    # ------------------------------------------------------
    # POST
    # ------------------------------------------------------

    if request.method == "POST":

        patient_id = request.form.get(
            "patient_id"
        )

        diagnosis = (
            request.form.get(
                "diagnosis",
                ""
            ).strip()
        )

        # --------------------------------------------------
        # Required fields
        # --------------------------------------------------

        if not patient_id or not diagnosis:

            flash(
                "Patient and Diagnosis are required.",
                "danger"
            )

            return render_template(
                "prescription/prescription_edit.html",
                prescription=prescription,
                patients=patients,
                doctors=doctors,
                appointments=appointments
            )

        # --------------------------------------------------
        # Doctor
        # --------------------------------------------------

        doctor_id = request.form.get(
            "doctor_id"
        )

        if not doctor_id:

            flash(
                "Doctor is required.",
                "danger"
            )

            return render_template(
                "prescription/prescription_edit.html",
                prescription=prescription,
                patients=patients,
                doctors=doctors,
                appointments=appointments
            )

        # --------------------------------------------------
        # Appointment
        # --------------------------------------------------

        appointment_id = (
            request.form.get(
                "appointment_id"
            )
            or None
        )

        if appointment_id:

            appointment = (
                Appointment.query
                .filter_by(
                    id=appointment_id,
                    patient_id=patient_id
                )
                .first()
            )

            if not appointment:
                abort(403)

        # --------------------------------------------------
        # Medicines
        # --------------------------------------------------

        medicine_rows, legacy_medicines = (
            _collect_medicine_rows(
                request.form
            )
        )

        if not medicine_rows:

            flash(
                "Please add at least one medicine.",
                "danger"
            )

            return render_template(
                "prescription/prescription_edit.html",
                prescription=prescription,
                patients=patients,
                doctors=doctors,
                appointments=appointments
            )

        # --------------------------------------------------
        # Update Prescription
        # --------------------------------------------------

        prescription.patient_id = (
            patient_id
        )

        prescription.doctor_id = (
            doctor_id
        )

        prescription.appointment_id = (
            appointment_id
        )

        prescription.diagnosis = (
            diagnosis
        )

        prescription.current_analysis = (
            request.form.get(
                "current_analysis",
                ""
            ).strip()
            or None
        )

        prescription.follow_up_date = (
            _parse_date(
                request.form.get(
                    "follow_up_date"
                )
                or None
            )
        )

        prescription.follow_up_time = (
            _parse_time(
                request.form.get(
                    "follow_up_time"
                )
                or None
            )
        )

        prescription.follow_up_notes = (
            request.form.get(
                "follow_up_notes",
                ""
            ).strip()
            or None
        )

        prescription.status = (
            request.form.get(
                "status",
                "Active"
            )
        )

        # Keep legacy medicines column synced
        prescription.medicines = (
            legacy_medicines
        )

        # --------------------------------------------------
        # Replace Medicines
        # --------------------------------------------------

        PrescriptionMedicine.query.filter_by(
            prescription_id=prescription.id
        ).delete()

        for row in medicine_rows:

            db.session.add(
                PrescriptionMedicine(
                    prescription_id=prescription.id,
                    **row
                )
            )

        # --------------------------------------------------
        # Save
        # --------------------------------------------------

        db.session.commit()

        flash(
            "Prescription updated successfully.",
            "success"
        )

        return redirect(
            url_for(
                "prescription.prescription_list"
            )
        )

    # ------------------------------------------------------
    # GET
    # ------------------------------------------------------

    return render_template(
        "prescription/prescription_edit.html",
        prescription=prescription,
        patients=patients,
        doctors=doctors,
        appointments=appointments
    )



# ==========================================================
# DOCTOR
# Edit Prescription
# ==========================================================

@prescription_bp.route(
    "/doctor/edit/<string:id>",
    methods=["GET", "POST"]
)
def doctor_prescription_edit(id):

    # ------------------------------------------------------
    # Get logged-in doctor
    # ------------------------------------------------------

    doctor = _get_logged_in_doctor()

    if not doctor:
        return redirect(
            url_for("pages.login")
        )

    # ------------------------------------------------------
    # Get prescription
    # ------------------------------------------------------

    prescription = (
        Prescription.query
        .get_or_404(id)
    )

    # ------------------------------------------------------
    # Doctor can edit ONLY own prescription
    # ------------------------------------------------------

    if prescription.doctor_id != doctor.id:
        abort(403)

    # ------------------------------------------------------
    # Existing prescription patient
    # Patient must belong to this doctor
    # ------------------------------------------------------

    patient = (
        Patient.query
        .filter_by(
            id=prescription.patient_id,
            assigned_doctor_id=doctor.id
        )
        .first()
    )

    if not patient:
        abort(403)

    # ------------------------------------------------------
    # Doctor patients
    # ------------------------------------------------------

    patients = (
        Patient.query
        .filter_by(
            assigned_doctor_id=doctor.id,
            status="active"
        )
        .all()
    )

    # ------------------------------------------------------
    # Doctor appointments
    # ------------------------------------------------------

    appointments = (
        Appointment.query
        .filter_by(
            doctor_id=doctor.id
        )
        .order_by(
            Appointment.appointment_date.desc()
        )
        .all()
    )

    # ------------------------------------------------------
    # Existing medicines
    # ------------------------------------------------------

    medicines = (
        PrescriptionMedicine.query
        .filter_by(
            prescription_id=prescription.id
        )
        .all()
    )

    # ------------------------------------------------------
    # Existing clinical data
    # ------------------------------------------------------

    clinical = (
        PrescriptionClinicalData.query
        .filter_by(
            prescription_id=prescription.id
        )
        .first()
    )

    # ------------------------------------------------------
    # Existing uploaded reports
    # ------------------------------------------------------

    reports = (
        PrescriptionReport.query
        .filter_by(
            prescription_id=prescription.id
        )
        .order_by(
            PrescriptionReport.uploaded_at.desc()
        )
        .all()
    )

    # ------------------------------------------------------
    # Existing uploaded reports
    # Convert to JSON-safe data for JavaScript
    # ------------------------------------------------------

    reports_data = []

    for report in reports:

        reports_data.append({
            "id": str(
                report.id or ""
            ),

            "report_type": str(
                report.report_type or ""
            ),

            "original_filename": str(
                report.original_filename or ""
            ),

            "stored_filename": str(
                report.stored_filename or ""
            ),

            "file_path": str(
                report.file_path or ""
            ),

            "file_url": url_for(
                "static",
                filename=(
                    report.file_path or ""
                ).replace("\\", "/")
            ),

            "file_type": str(
                report.file_type or ""
            ),

            "file_size": (
                int(report.file_size)
                if report.file_size is not None
                else 0
            ),

            "uploaded_at": (
                report.uploaded_at.isoformat()
                if report.uploaded_at
                else ""
            ),

            "report_start_time": (
                report.report_start_time.strftime("%H:%M")
                if report.report_start_time
                else ""
            ),

            "report_end_time": (
                report.report_end_time.strftime("%H:%M")
                if report.report_end_time
                else ""
            ),

            "remarks": str(
                report.remarks or ""
            )
        })

    # ------------------------------------------------------
    # POST
    # ------------------------------------------------------

    if request.method == "POST":

        patient_id = (
            request.form.get(
                "patient_id"
            )
        )

        diagnosis = (
            request.form.get(
                "diagnosis",
                ""
            ).strip()
        )

        # --------------------------------------------------
        # Required fields
        # --------------------------------------------------

        if not patient_id or not diagnosis:

            flash(
                "Patient and Diagnosis are required.",
                "danger"
            )

            return render_template(
                "doctor/doctor_prescription_edit.html",
                prescription=prescription,
                patient=patient,
                patients=patients,
                appointments=appointments,
                medicines=medicines,
                doctor=doctor,
                clinical=clinical,
                reports=reports,
                reports_data=reports_data,
            )

        # --------------------------------------------------
        # Patient security
        # --------------------------------------------------

        selected_patient = (
            Patient.query
            .filter_by(
                id=patient_id,
                assigned_doctor_id=doctor.id,
                status="active"
            )
            .first()
        )

        if not selected_patient:
            abort(403)

        # --------------------------------------------------
        # Doctor ID
        # Always use logged-in doctor
        # --------------------------------------------------

        prescription.doctor_id = doctor.id

        # --------------------------------------------------
        # Appointment
        # --------------------------------------------------

        appointment_id = (
            request.form.get(
                "appointment_id"
            )
            or None
        )

        if appointment_id:

            appointment = (
                Appointment.query
                .filter_by(
                    id=appointment_id,
                    doctor_id=doctor.id,
                    patient_id=patient_id
                )
                .first()
            )

            if not appointment:
                abort(403)

        # --------------------------------------------------
        # Medicines
        # --------------------------------------------------

        medicine_rows, legacy_medicines = (
            _collect_medicine_rows(
                request.form
            )
        )

        if not medicine_rows:

            flash(
                "Please add at least one medicine.",
                "danger"
            )

            return render_template(
                "doctor/doctor_prescription_edit.html",
                prescription=prescription,
                patient=patient,
                patients=patients,
                appointments=appointments,
                medicines=medicines,
                doctor=doctor,
                clinical=clinical,
                reports=reports,
                reports_data=reports_data,
            )

        # --------------------------------------------------
        # Update Prescription
        # --------------------------------------------------

        prescription.patient_id = (
            patient_id
        )

        prescription.appointment_id = (
            appointment_id
        )

        prescription.diagnosis = (
            diagnosis
        )

        prescription.current_analysis = (
            request.form.get(
                "current_analysis",
                ""
            ).strip()
            or None
        )

        prescription.follow_up_date = (
            _parse_date(
                request.form.get(
                    "follow_up_date"
                )
                or None
            )
        )

        prescription.follow_up_time = (
            _parse_time(
                request.form.get(
                    "follow_up_time"
                )
                or None
            )
        )

        prescription.follow_up_notes = (
            request.form.get(
                "follow_up_notes",
                ""
            ).strip()
            or None
        )

        prescription.status = (
            request.form.get(
                "status",
                "Active"
            )
        )

        # --------------------------------------------------
        # Keep legacy medicines column synced
        # --------------------------------------------------

        prescription.medicines = (
            legacy_medicines
        )

        # --------------------------------------------------
        # Replace existing medicines
        # --------------------------------------------------

        PrescriptionMedicine.query.filter_by(
            prescription_id=prescription.id
        ).delete()

        for row in medicine_rows:

            db.session.add(
                PrescriptionMedicine(
                    prescription_id=prescription.id,
                    **row
                )
            )

        # --------------------------------------------------
        # Update existing uploaded report metadata
        # --------------------------------------------------

        existing_report_ids = (
            request.form.getlist(
                "existing_report_id[]"
            )
        )

        existing_report_start_times = (
            request.form.getlist(
                "existing_report_start_time[]"
            )
        )

        existing_report_end_times = (
            request.form.getlist(
                "existing_report_end_time[]"
            )
        )

        existing_report_remarks = (
            request.form.getlist(
                "existing_report_remarks[]"
            )
        )

        for index, report_id in enumerate(
            existing_report_ids
        ):

            if not report_id:
                continue

            report = (
                PrescriptionReport.query
                .filter_by(
                    id=report_id,
                    prescription_id=prescription.id
                )
                .first()
            )

            if not report:
                abort(403)

            # ----------------------------------------------
            # Start time
            # ----------------------------------------------

            start_time_value = (
                existing_report_start_times[index]
                if index < len(
                    existing_report_start_times
                )
                else ""
            )

            # ----------------------------------------------
            # End time
            # ----------------------------------------------

            end_time_value = (
                existing_report_end_times[index]
                if index < len(
                    existing_report_end_times
                )
                else ""
            )

            # ----------------------------------------------
            # Doctor remarks
            # ----------------------------------------------

            remarks_value = (
                existing_report_remarks[index].strip()
                if index < len(
                    existing_report_remarks
                )
                and existing_report_remarks[index]
                else ""
            )

            # ----------------------------------------------
            # Save report metadata
            # ----------------------------------------------

            report.report_start_time = (
                _parse_time(
                    start_time_value
                )
            )

            report.report_end_time = (
                _parse_time(
                    end_time_value
                )
            )

            report.remarks = (
                remarks_value
                or None
            )

        # --------------------------------------------------
        # Save everything
        # --------------------------------------------------

        db.session.commit()

        flash(
            "Prescription updated successfully.",
            "success"
        )

        return redirect(
            url_for(
                "prescription.doctor_prescription_list"
            )
        )

    # ------------------------------------------------------
    # GET
    # ------------------------------------------------------

    return render_template(
        "doctor/doctor_prescription_edit.html",
        prescription=prescription,
        patient=patient,
        patients=patients,
        appointments=appointments,
        medicines=medicines,
        reports=reports,
        reports_data=reports_data,
        clinical=clinical,
        doctor=doctor
    )
# ==========================================================
# ADMIN / DOCTOR
# Delete Prescription
# ==========================================================

@prescription_bp.route(
    "/delete/<string:id>",
    methods=["POST"]
)
def prescription_delete(id):

    prescription = (
        Prescription.query
        .get_or_404(id)
    )

    # ------------------------------------------------------
    # Check login
    # ------------------------------------------------------

    if "user" not in session:

        return redirect(
            url_for(
                "pages.login"
            )
        )

    role = session["user"].get(
        "role"
    )

    # ------------------------------------------------------
    # Doctor cannot delete
    # ------------------------------------------------------

    if role == "doctor":
        abort(403)

    # ------------------------------------------------------
    # Only Admin / Super Admin
    # ------------------------------------------------------

    if role not in (
        "admin",
        "super_admin"
    ):
        abort(403)

    db.session.delete(
        prescription
    )

    db.session.commit()

    flash(
        "Prescription deleted successfully.",
        "success"
    )

    return redirect(
        url_for(
            "prescription.prescription_list"
        )
    )


# ==========================================================
# DOCTOR
# Prescription List
# ==========================================================

@prescription_bp.route(
    "/doctor"
)
def doctor_prescription_list():

    doctor = _get_logged_in_doctor()

    if not doctor:

        return redirect(
            url_for(
                "pages.login"
            )
        )

    # ------------------------------------------------------
    # Only prescriptions belonging to this doctor's
    # assigned patients
    # ------------------------------------------------------

    prescriptions = (
        Prescription.query
        .join(Patient)
        .filter(
            Prescription.doctor_id == doctor.id,
            Patient.assigned_doctor_id == doctor.id
        )
        .order_by(
            Prescription.prescribed_date.desc()
        )
        .all()
    )

    return render_template(
        "doctor/doctor_prescription_list.html",
        doctor=doctor,
        prescriptions=prescriptions
    )

# ==========================================================
# DOCTOR
# Prescription / Clinical History
# ==========================================================

@prescription_bp.route(
    "/doctor/history/<string:patient_id>",
    methods=["GET"]
)
def doctor_prescription_history(patient_id):

    # ------------------------------------------------------
    # Get logged-in doctor
    # ------------------------------------------------------

    doctor = _get_logged_in_doctor()

    if not doctor:

        return jsonify({
            "success": False,
            "message": "Doctor login required."
        }), 401

    # ------------------------------------------------------
    # Verify patient belongs to this doctor
    # ------------------------------------------------------

    patient = (
        Patient.query
        .filter_by(
            id=patient_id,
            assigned_doctor_id=doctor.id,
            status="active"
        )
        .first()
    )

    if not patient:

        return jsonify({
            "success": False,
            "message": "Patient not found or access denied."
        }), 403

    # ------------------------------------------------------
    # Get all previous prescriptions
    # for this patient and this doctor
    # ------------------------------------------------------

    prescriptions = (
        Prescription.query
        .filter_by(
            patient_id=patient.id,
            doctor_id=doctor.id
        )
        .order_by(
            Prescription.prescribed_date.desc()
        )
        .all()
    )

    history = []

    for prescription in prescriptions:

        # --------------------------------------------------
        # Clinical data
        # --------------------------------------------------

        clinical = prescription.clinical_data

        clinical_data = None

        if clinical:

            clinical_data = {
                "temperature": clinical.temperature,
                "heart_rate": clinical.heart_rate,
                "spo2": clinical.spo2,

                "blood_pressure_systolic": (
                    clinical.blood_pressure_systolic
                ),

                "blood_pressure_diastolic": (
                    clinical.blood_pressure_diastolic
                ),

                "respiratory_rate": (
                    clinical.respiratory_rate
                ),

                "stress": clinical.stress,

                "sleep_hours": clinical.sleep_hours,

                "steps": clinical.steps,

                "recorded_at": (
                    clinical.recorded_at.isoformat()
                    if clinical.recorded_at
                    else None
                )
            }

        # --------------------------------------------------
        # Medicines
        # --------------------------------------------------

        medicines = []

        for medicine in prescription.medicine_items:

            medicines.append({
                "medicine_name": medicine.medicine_name,
                "medicine_type": medicine.medicine_type,
                "dosage": medicine.dosage,
                "quantity": medicine.quantity,
                "frequency": medicine.frequency,
                "taking_time": medicine.taking_time,
                "duration": medicine.duration,
                "instructions": medicine.instructions
            })

        # --------------------------------------------------
        # Reports
        # --------------------------------------------------

        reports = []

        for report in prescription.reports:

            reports.append({
                "id": report.id,
                "report_type": report.report_type,
                "original_filename": (
                    report.original_filename
                ),
                "file_type": report.file_type,
                "file_size": report.file_size,
                "file_url": url_for(
                    "static",
                    filename=report.file_path
                )
            })

        # --------------------------------------------------
        # Appointment
        # --------------------------------------------------

        appointment_data = None

        if prescription.appointment:

            appointment_data = {
                "id": prescription.appointment.id,
                "date": (
                    prescription.appointment.appointment_date.isoformat()
                    if prescription.appointment.appointment_date
                    else None
                ),
                "time": (
                    prescription.appointment.appointment_time.strftime("%H:%M")
                    if prescription.appointment.appointment_time
                    else None
                ),
                "status": prescription.appointment.status
            }

        # --------------------------------------------------
        # Prescription history record
        # --------------------------------------------------

        history.append({

            "prescription_id": prescription.id,

            "prescribed_date": (
                prescription.prescribed_date.isoformat()
                if prescription.prescribed_date
                else None
            ),

            "status": prescription.status,

            "diagnosis": prescription.diagnosis,

            "current_analysis": (
                prescription.current_analysis
                or ""
            ),

            "clinical_data": clinical_data,

            "medicines": medicines,

            "reports": reports,

            "follow_up": {
                "date": (
                    prescription.follow_up_date.isoformat()
                    if prescription.follow_up_date
                    else None
                ),
                "time": (
                    prescription.follow_up_time.strftime("%H:%M")
                    if prescription.follow_up_time
                    else None
                ),
                "notes": (
                    prescription.follow_up_notes
                    or ""
                ),
                "status": prescription.status
            },

            "appointment": appointment_data
        })

    # ------------------------------------------------------
    # Response
    # ------------------------------------------------------

    return jsonify({

        "success": True,

        "patient": {
            "id": patient.id,
            "name": (
                f"{patient.user.first_name} "
                f"{patient.user.last_name}"
            ),
            "patient_code": (
                patient.patient_code
                or ""
            )
        },

        "history": history
    })
# ==========================================================
# DOCTOR
# Add Prescription
# ==========================================================

@prescription_bp.route(
    "/doctor/add",
    methods=["GET", "POST"]
)
def doctor_prescription_add():

    # ------------------------------------------------------
    # Get logged-in doctor
    # ------------------------------------------------------

    doctor = _get_logged_in_doctor()

    if not doctor:
        return redirect(
            url_for("pages.login")
        )

    # ------------------------------------------------------
    # Only patients assigned to this doctor
    # ------------------------------------------------------

    patients = (
        Patient.query
        .filter_by(
            assigned_doctor_id=doctor.id,
            status="active"
        )
        .all()
    )

    # ------------------------------------------------------
    # Latest HealthData for each assigned patient
    # ------------------------------------------------------

    health_data_map = {}

    for p in patients:

        latest = (
            HealthData.query
            .filter_by(
                patient_id=p.id
            )
            .order_by(
                HealthData.recorded_at.desc()
            )
            .first()
        )

        if latest:
            health_data_map[p.id] = latest

    # ------------------------------------------------------
    # Only appointments belonging to this doctor
    # ------------------------------------------------------

    appointments = (
        Appointment.query
        .filter_by(
            doctor_id=doctor.id
        )
        .order_by(
            Appointment.appointment_date.desc()
        )
        .all()
    )

    # ------------------------------------------------------
    # Optional patient selected from My Patients
    # ------------------------------------------------------

    selected_patient_id = request.args.get(
        "patient_id"
    )

    if selected_patient_id:

        allowed_patient = (
            Patient.query
            .filter_by(
                id=selected_patient_id,
                assigned_doctor_id=doctor.id,
                status="active"
            )
            .first()
        )

        if not allowed_patient:
            abort(403)

    # ======================================================
    # POST
    # ======================================================

    if request.method == "POST":

        # --------------------------------------------------
        # Basic Prescription Fields
        # --------------------------------------------------

        patient_id = request.form.get(
            "patient_id"
        )

        appointment_id = (
            request.form.get(
                "appointment_id"
            )
            or None
        )

        diagnosis = (
            request.form.get(
                "diagnosis",
                ""
            ).strip()
        )

        current_analysis = (
            request.form.get(
                "current_analysis",
                ""
            ).strip()
        )

        follow_up_notes = (
            request.form.get(
                "follow_up_notes",
                ""
            ).strip()
        )

        status = request.form.get(
            "status",
            "Active"
        )

        # --------------------------------------------------
        # Current Clinical Parameters
        # --------------------------------------------------

        try:

            temperature = _parse_optional_float(
                request.form.get(
                    "body_temperature"
                ),
                "Temperature"
            )

            heart_rate = _parse_optional_int(
                request.form.get(
                    "heart_rate"
                ),
                "Heart Rate"
            )

            spo2 = _parse_optional_float(
                request.form.get(
                    "spo2"
                ),
                "SpO₂"
            )

            bp_systolic = _parse_optional_int(
                request.form.get(
                    "blood_pressure_systolic"
                ),
                "Systolic blood pressure"
            )

            bp_diastolic = _parse_optional_int(
                request.form.get(
                    "blood_pressure_diastolic"
                ),
                "Diastolic blood pressure"
            )

            respiratory_rate = _parse_optional_float(
                request.form.get(
                    "respiratory_rate"
                ),
                "Respiratory rate"
            )

            stress = _parse_optional_int(
                request.form.get(
                    "stress_level"
                ),
                "Stress"
            )

            sleep_hours = _parse_optional_float(
                request.form.get(
                    "sleep_hours"
                ),
                "Sleep"
            )

            steps = _parse_optional_int(
                request.form.get(
                    "steps"
                ),
                "Steps"
            )

        except ValueError as exc:

            flash(
                str(exc),
                "danger"
            )

            return render_template(
                "doctor/doctor_prescription_add.html",
                doctor=doctor,
                patients=patients,
                appointments=appointments,
                selected_patient_id=patient_id,
                health_data_map=health_data_map,
            

            )

        # --------------------------------------------------
        # Blood Pressure Validation
        # --------------------------------------------------

        if (
            (
                bp_systolic is None
                and
                bp_diastolic is not None
            )
            or
            (
                bp_systolic is not None
                and
                bp_diastolic is None
            )
        ):

            flash(
                "Please enter both systolic and diastolic blood pressure.",
                "danger"
            )

            return render_template(
                "doctor/doctor_prescription_add.html",
                doctor=doctor,
                patients=patients,
                appointments=appointments,
                selected_patient_id=patient_id,
                health_data_map=health_data_map
            )

        # --------------------------------------------------
        # Required Fields
        # --------------------------------------------------

        if not patient_id or not diagnosis:

            flash(
                "Patient and Diagnosis are required.",
                "danger"
            )

            return render_template(
               "doctor/doctor_prescription_add.html",
                doctor=doctor,
                patients=patients,
                appointments=appointments,
                selected_patient_id=patient_id,
                health_data_map=health_data_map
            )

        # --------------------------------------------------
        # Verify Patient Belongs to Doctor
        # --------------------------------------------------

        patient = (
            Patient.query
            .filter_by(
                id=patient_id,
                assigned_doctor_id=doctor.id,
                status="active"
            )
            .first()
        )

        if not patient:
            abort(403)

        # --------------------------------------------------
        # Verify Appointment
        # --------------------------------------------------

        if appointment_id:

            appointment = (
                Appointment.query
                .filter_by(
                    id=appointment_id,
                    doctor_id=doctor.id,
                    patient_id=patient.id
                )
                .first()
            )

            if not appointment:
                abort(403)

        # --------------------------------------------------
        # Medicines
        # --------------------------------------------------

        medicine_rows, legacy_medicines = (
            _collect_medicine_rows(
                request.form
            )
        )

        if not medicine_rows:

            flash(
                "Please add at least one medicine.",
                "danger"
            )

            return render_template(
               "doctor/doctor_prescription_add.html",
                doctor=doctor,
                patients=patients,
                appointments=appointments,
                selected_patient_id=patient_id,
                health_data_map=health_data_map
            )

        # ==================================================
        # Create Prescription
        # ==================================================

        prescription = Prescription(

            patient_id=patient.id,

            doctor_id=doctor.id,

            appointment_id=appointment_id,

            diagnosis=diagnosis,

            medicines=legacy_medicines,

            dosage=None,

            instructions=None,

            current_analysis=(
                current_analysis
                or None
            ),

            follow_up_date=_parse_date(
                request.form.get(
                    "follow_up_date"
                )
                or None
            ),

            follow_up_time=_parse_time(
                request.form.get(
                    "follow_up_time"
                )
                or None
            ),

            follow_up_notes=(
                follow_up_notes
                or None
            ),

            status=status
        )

        db.session.add(
            prescription
        )

        # --------------------------------------------------
        # Flush so prescription.id exists
        # --------------------------------------------------

        db.session.flush()

        # ==================================================
        # Current Clinical Parameters
        # ==================================================

        clinical_data = PrescriptionClinicalData(

            prescription_id=prescription.id,

            patient_id=patient.id,

            temperature=temperature,

            heart_rate=heart_rate,

            spo2=spo2,

            blood_pressure_systolic=bp_systolic,

            blood_pressure_diastolic=bp_diastolic,

            respiratory_rate=respiratory_rate,

            stress=stress,

            sleep_hours=sleep_hours,

            steps=steps,

            recorded_at=datetime.utcnow()
        )

        db.session.add(
            clinical_data
        )

        # ==================================================
        # LAB REPORT FILES
        # ==================================================

        # --------------------------------------------------
        # Blood Test Files
        # --------------------------------------------------

        blood_test_files = (
            request.files.getlist(
                "blood_test_files"
            )
        )

        # --------------------------------------------------
        # Blood Test Metadata
        # One metadata row per selected file
        # --------------------------------------------------

        blood_test_start_times = (
            request.form.getlist(
                "blood_test_start_time[]"
            )
        )

        blood_test_end_times = (
            request.form.getlist(
                "blood_test_end_time[]"
            )
        )

        blood_test_remarks = (
            request.form.getlist(
                "blood_test_remarks[]"
            )
        )

        # --------------------------------------------------
        # Scan Files
        # --------------------------------------------------

        scan_files = (
            request.files.getlist(
                "scan_files"
            )
        )

        # --------------------------------------------------
        # Scan Metadata
        # One metadata row per selected file
        # --------------------------------------------------

        scan_start_times = (
            request.form.getlist(
                "scan_start_time[]"
            )
        )

        scan_end_times = (
            request.form.getlist(
                "scan_end_time[]"
            )
        )

        scan_remarks = (
            request.form.getlist(
                "scan_remarks[]"
            )
        )

        # ==================================================
        # Save Reports
        # ==================================================

        try:

            # ------------------------------------------------
            # Blood Test Reports
            # ------------------------------------------------

            _save_prescription_reports(
                prescription=prescription,
                files=blood_test_files,
                report_type="Blood Test",
                start_times=blood_test_start_times,
                end_times=blood_test_end_times,
                remarks=blood_test_remarks
            )

            # ------------------------------------------------
            # Scan Reports
            # ------------------------------------------------

            _save_prescription_reports(
                prescription=prescription,
                files=scan_files,
                report_type="Scan",
                start_times=scan_start_times,
                end_times=scan_end_times,
                remarks=scan_remarks
            )

        except ValueError as exc:

            db.session.rollback()

            flash(
                str(exc),
                "danger"
            )

            return render_template(
              "doctor/doctor_prescription_add.html",
                doctor=doctor,
                patients=patients,
                appointments=appointments,
                selected_patient_id=patient_id,
                health_data_map=health_data_map
            )

        except Exception:

            db.session.rollback()

            flash(
                "Unable to upload prescription reports.",
                "danger"
            )

            return render_template(
                "doctor/doctor_prescription_add.html",
                doctor=doctor,
                patients=patients,
                appointments=appointments,
                selected_patient_id=patient_id,
                health_data_map=health_data_map
            )

        # ==================================================
        # Add Medicines
        # ==================================================

        for row in medicine_rows:

            db.session.add(
                PrescriptionMedicine(
                    prescription_id=prescription.id,
                    **row
                )
            )

        # ==================================================
        # Commit Everything
        # ==================================================

        try:

            db.session.commit()

        except Exception:

            db.session.rollback()

            flash(
                "Unable to save prescription.",
                "danger"
            )

            return render_template(
                "doctor/doctor_prescription_add.html",
                doctor=doctor,
                patients=patients,
                appointments=appointments,
                selected_patient_id=patient_id,
                health_data_map=health_data_map
            )

        # ==================================================
        # Success
        # ==================================================

        flash(
            "Prescription created successfully.",
            "success"
        )

        return redirect(
            url_for(
                "prescription.doctor_prescription_list"
            )
        )

    # ======================================================
    # GET
    # ======================================================

    return render_template(
        "doctor/doctor_prescription_add.html",
        doctor=doctor,
        patients=patients,
        appointments=appointments,
        selected_patient_id=selected_patient_id,
        health_data_map=health_data_map
    )