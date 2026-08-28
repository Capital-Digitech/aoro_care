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
    current_app
)

from werkzeug.utils import secure_filename

from database import db
from models import Patient, Doctor, Report


report_bp = Blueprint(
    "report",
    __name__,
    url_prefix="/report"
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
    Validates and saves an uploaded report file.
    Returns the relative path (to store in report_file) or None
    if no valid file was provided.
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

    full_path = os.path.join(current_app.root_path, "static", relative_path)

    if os.path.isfile(full_path):
        try:
            os.remove(full_path)
        except OSError:
            pass


# ==========================================================
# Report List
# ==========================================================

@report_bp.route("/")
def report_list():

    reports = Report.query.order_by(
        Report.generated_at.desc()
    ).all()

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    doctors = Doctor.query.filter_by(
        status="active"
    ).all()

    # Extra context used only by the "Reports Generated Today" stat card —
    # the core CRUD contract of reports / patients / doctors is unchanged.
    today_count = sum(
        1 for report in reports
        if report.generated_at and report.generated_at.date() == date.today()
    )

    return render_template(
        "report/report_list.html",
        reports=reports,
        patients=patients,
        doctors=doctors,
        today_count=today_count
    )

# ==========================================================
# Add Report
# ==========================================================

@report_bp.route("/add", methods=["GET", "POST"])
def report_add():

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    doctors = Doctor.query.filter_by(
        status="active"
    ).all()

    if request.method == "POST":

        uploaded_file = request.files.get("report_file")
        saved_path = _save_report_file(uploaded_file)

        if saved_path is False:
            # Invalid file type or size — flash already set inside helper
            return redirect(url_for("report.report_list"))

        report = Report(
            patient_id=request.form["patient_id"],
            doctor_id=request.form.get("doctor_id") or None,
            report_title=request.form["report_title"],
            report_type=request.form.get("report_type"),
            report_file=saved_path,
            notes=request.form.get("notes")
        )

        db.session.add(report)
        db.session.commit()

        flash(
            "Report added successfully.",
            "success"
        )

        return redirect(
            url_for("report.report_list")
        )

    return render_template(
        "report/report_add.html",
        patients=patients,
        doctors=doctors
    )
# ==========================================================
# Edit Report
# ==========================================================

@report_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def report_edit(id):

    report = Report.query.get_or_404(id)

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    doctors = Doctor.query.filter_by(
        status="active"
    ).all()

    if request.method == "POST":

        uploaded_file = request.files.get("report_file")
        saved_path = _save_report_file(uploaded_file)

        if saved_path is False:
            # Invalid file type or size — flash already set inside helper
            return redirect(url_for("report.report_edit", id=id))

        if saved_path:
            # A new file was uploaded — remove the old one and swap it in.
            _delete_report_file(report.report_file)
            report.report_file = saved_path

        report.patient_id = request.form["patient_id"]
        report.doctor_id = request.form.get("doctor_id") or None
        report.report_title = request.form["report_title"]
        report.report_type = request.form.get("report_type")
        report.notes = request.form.get("notes")

        db.session.commit()

        flash("Report updated successfully.", "success")

        return redirect(url_for("report.report_list"))

    return render_template(
        "report/report_edit.html",
        report=report,
        patients=patients,
        doctors=doctors
    )
# ==========================================================
# Delete Report
# ==========================================================

@report_bp.route("/delete/<string:id>", methods=["POST"])
def report_delete(id):

    report = Report.query.get_or_404(id)

    _delete_report_file(report.report_file)

    db.session.delete(report)
    db.session.commit()

    flash("Report deleted successfully.", "success")

    return redirect(url_for("report.report_list"))

from flask import session, abort

# ==========================================================
# Doctor Medical Reports
# ==========================================================

@report_bp.route("/doctor")
def doctor_report_list():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    if session["user"]["role"] != "doctor":
        abort(403)

    doctor = Doctor.query.filter_by(
        user_id=session["user"]["id"]
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
        reports=reports
    )