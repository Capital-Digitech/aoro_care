
import os
import uuid
from datetime import date

from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    current_app,
    session,
    abort,
)

from werkzeug.utils import secure_filename

from database import db
from models import Patient, Doctor, Report
from utils import get_hospital_scope


report_bp = Blueprint(
    "report",
    __name__,
    url_prefix="/report",
)


# ==========================================================
# Upload Config
# ==========================================================

ALLOWED_EXTENSIONS = {"pdf", "docx"}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB

UPLOAD_SUBFOLDER = os.path.join("static", "uploads", "reports")


def _allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


def _upload_folder():
    folder = os.path.join(current_app.root_path, UPLOAD_SUBFOLDER)
    os.makedirs(folder, exist_ok=True)
    return folder


def _save_report_file(file_storage):
    """
    Validate and save an uploaded report file.
    Returns the relative path, None if no file was provided,
    or False if validation fails.
    """

    if not file_storage or file_storage.filename == "":
        return None

    if not _allowed_file(file_storage.filename):
        flash("Only PDF and DOCX files are allowed.", "danger")
        return False

    file_storage.seek(0, os.SEEK_END)
    size = file_storage.tell()
    file_storage.seek(0)

    if size > MAX_UPLOAD_SIZE:
        flash("File size must not exceed 10 MB.", "danger")
        return False

    original_name = secure_filename(file_storage.filename)
    unique_name = f"{uuid.uuid4().hex}_{original_name}"

    save_path = os.path.join(_upload_folder(), unique_name)
    file_storage.save(save_path)

    return f"uploads/reports/{unique_name}"


def _delete_report_file(relative_path):
    if not relative_path:
        return

    full_path = os.path.join(
        current_app.root_path,
        "static",
        relative_path,
    )

    if os.path.isfile(full_path):
        try:
            os.remove(full_path)
        except OSError:
            pass


# ==========================================================
# Scope Helpers
# ==========================================================

def _get_report_form_data(scope):
    """Return active patients and doctors allowed by the user's scope."""

    patients = scope.filter_patients(
        Patient.query.filter_by(status="active")
    ).all()

    doctors = scope.filter_doctors(
        Doctor.query.filter_by(status="active")
    ).all()

    return patients, doctors


def _validate_report_selection(scope, patient_id, doctor_id):
    """Validate patient and optional doctor against the user's scope."""

    patient = Patient.query.get(patient_id) if patient_id else None

    if not patient or patient.status != "active":
        return False, "Please select a valid active patient."

    if not scope.can_access_patient(patient):
        return False, "Access denied. Invalid patient selected for your hospital."

    if doctor_id:
        doctor = Doctor.query.get(doctor_id)

        if not doctor or doctor.status != "active":
            return False, "Please select a valid active doctor."

        if not scope.can_access_doctor(doctor):
            return False, "Access denied. Invalid doctor selected for your hospital."

    return True, None


# ==========================================================
# Report List
# ==========================================================

@report_bp.route("/")
def report_list():
    scope = get_hospital_scope()

    reports = scope.filter_reports(
        Report.query
    ).order_by(
        Report.generated_at.desc()
    ).all()

    patients, doctors = _get_report_form_data(scope)

    today_count = sum(
        1
        for report in reports
        if report.generated_at
        and report.generated_at.date() == date.today()
    )

    return render_template(
        "report/report_list.html",
        reports=reports,
        patients=patients,
        doctors=doctors,
        today_count=today_count,
    )


# ==========================================================
# Add Report
# ==========================================================

@report_bp.route("/add", methods=["GET", "POST"])
def report_add():
    scope = get_hospital_scope()

    if scope.unassigned:
        flash(
            "Access denied. Please contact the system administrator "
            "to assign a hospital.",
            "danger",
        )
        return redirect(url_for("report.report_list"))

    patients, doctors = _get_report_form_data(scope)

    if request.method == "POST":
        patient_id = request.form.get("patient_id")
        doctor_id = request.form.get("doctor_id") or None

        valid, error_message = _validate_report_selection(
            scope,
            patient_id,
            doctor_id,
        )

        if not valid:
            flash(error_message, "danger")
            return redirect(url_for("report.report_add"))

        uploaded_file = request.files.get("report_file")
        saved_path = _save_report_file(uploaded_file)

        if saved_path is False:
            return redirect(url_for("report.report_add"))

        report = Report(
            patient_id=patient_id,
            doctor_id=doctor_id,
            report_title=request.form["report_title"],
            report_type=request.form.get("report_type"),
            report_file=saved_path,
            notes=request.form.get("notes"),
        )

        try:
            db.session.add(report)
            db.session.commit()
        except Exception:
            db.session.rollback()

            if saved_path:
                _delete_report_file(saved_path)

            current_app.logger.exception("Failed to add report.")
            flash("Unable to add the report. Please try again.", "danger")
            return redirect(url_for("report.report_add"))

        flash("Report added successfully.", "success")
        return redirect(url_for("report.report_list"))

    return render_template(
        "report/report_add.html",
        patients=patients,
        doctors=doctors,
    )


# ==========================================================
# Edit Report
# ==========================================================

@report_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def report_edit(id):
    scope = get_hospital_scope()
    report = Report.query.get_or_404(id)

    if not scope.can_access_report(report):
        flash(
            "Access denied. You do not have permission to access this report.",
            "danger",
        )
        return redirect(url_for("report.report_list"))

    patients, doctors = _get_report_form_data(scope)

    if request.method == "POST":
        patient_id = request.form.get("patient_id")
        doctor_id = request.form.get("doctor_id") or None

        valid, error_message = _validate_report_selection(
            scope,
            patient_id,
            doctor_id,
        )

        if not valid:
            flash(error_message, "danger")
            return redirect(url_for("report.report_edit", id=id))

        uploaded_file = request.files.get("report_file")
        saved_path = _save_report_file(uploaded_file)

        if saved_path is False:
            return redirect(url_for("report.report_edit", id=id))

        old_path = report.report_file

        try:
            report.patient_id = patient_id
            report.doctor_id = doctor_id
            report.report_title = request.form["report_title"]
            report.report_type = request.form.get("report_type")
            report.notes = request.form.get("notes")

            if saved_path:
                report.report_file = saved_path

            db.session.commit()

        except Exception:
            db.session.rollback()

            if saved_path:
                _delete_report_file(saved_path)

            current_app.logger.exception("Failed to update report.")
            flash("Unable to update the report. Please try again.", "danger")
            return redirect(url_for("report.report_edit", id=id))

        if saved_path and old_path:
            _delete_report_file(old_path)

        flash("Report updated successfully.", "success")
        return redirect(url_for("report.report_list"))

    return render_template(
        "report/report_edit.html",
        report=report,
        patients=patients,
        doctors=doctors,
    )


# ==========================================================
# Delete Report
# ==========================================================

@report_bp.route("/delete/<string:id>", methods=["POST"])
def report_delete(id):
    scope = get_hospital_scope()
    report = Report.query.get_or_404(id)

    if not scope.can_access_report(report):
        flash(
            "Access denied. You do not have permission to delete this report.",
            "danger",
        )
        return redirect(url_for("report.report_list"))

    old_path = report.report_file

    try:
        db.session.delete(report)
        db.session.commit()

    except Exception:
        db.session.rollback()
        current_app.logger.exception("Failed to delete report.")
        flash("Unable to delete the report. Please try again.", "danger")
        return redirect(url_for("report.report_list"))

    if old_path:
        _delete_report_file(old_path)

    flash("Report deleted successfully.", "success")
    return redirect(url_for("report.report_list"))


# ==========================================================
# Doctor Medical Reports
# ==========================================================

@report_bp.route("/doctor")
def doctor_report_list():
    if "user" not in session:
        return redirect(url_for("pages.login"))

    session_user = session.get("user") or {}

    if session_user.get("role") != "doctor":
        abort(403)

    doctor = Doctor.query.filter_by(
        user_id=session_user.get("id")
    ).first_or_404()

    reports = (
        Report.query
        .join(Patient)
        .filter(Patient.assigned_doctor_id == doctor.id)
        .order_by(Report.generated_at.desc())
        .all()
    )

    return render_template(
        "doctor/doctor_report_list.html",
        doctor=doctor,
        reports=reports,
    )
