from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session,
    abort
)

from database import db

from models import (
    Patient,
    Doctor,
    Appointment,
    Prescription
)

prescription_bp = Blueprint(
    "prescription",
    __name__,
    url_prefix="/prescription"
)

# ==========================================================
# Prescription List (Admin)
# ==========================================================

@prescription_bp.route("/")
def prescription_list():

    prescriptions = (
        Prescription.query
        .order_by(Prescription.prescribed_date.desc())
        .all()
    )

    patients = (
        Patient.query
        .filter_by(status="active")
        .all()
    )

    doctors = (
        Doctor.query
        .filter_by(status="active")
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
# Add Prescription
# ==========================================================

@prescription_bp.route("/add", methods=["GET", "POST"])
def prescription_add():

    patients = (
        Patient.query
        .filter_by(status="active")
        .all()
    )

    doctors = (
        Doctor.query
        .filter_by(status="active")
        .all()
    )

    appointments = Appointment.query.all()

    if request.method == "POST":

        prescription = Prescription(

            patient_id=request.form["patient_id"],

            doctor_id=request.form["doctor_id"],

            appointment_id=(
                request.form.get("appointment_id")
                or None
            ),

            diagnosis=request.form["diagnosis"],

            medicines=request.form["medicines"],

            dosage=request.form.get("dosage"),

            instructions=request.form.get("instructions"),

            status=request.form.get(
                "status",
                "Active"
            )

        )

        db.session.add(prescription)
        db.session.commit()

        flash(
            "Prescription added successfully.",
            "success"
        )

        return redirect(
            url_for("prescription.prescription_list")
        )

    return render_template(
        "prescription/prescription_add.html",
        patients=patients,
        doctors=doctors,
        appointments=appointments
    )
# ==========================================================
# Edit Prescription
# ==========================================================

@prescription_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def prescription_edit(id):

    prescription = Prescription.query.get_or_404(id)

    patients = (
        Patient.query
        .filter_by(status="active")
        .all()
    )

    doctors = (
        Doctor.query
        .filter_by(status="active")
        .all()
    )

    appointments = Appointment.query.all()

    if request.method == "POST":

        prescription.patient_id = request.form["patient_id"]

        prescription.doctor_id = request.form["doctor_id"]

        prescription.appointment_id = (
            request.form.get("appointment_id")
            or None
        )

        prescription.diagnosis = request.form["diagnosis"]

        prescription.medicines = request.form["medicines"]

        prescription.dosage = request.form.get("dosage")

        prescription.instructions = request.form.get("instructions")

        prescription.status = request.form.get(
            "status",
            "Active"
        )

        db.session.commit()

        flash(
            "Prescription updated successfully.",
            "success"
        )

        # Doctor editing from Doctor Portal
        if (
            "user" in session
            and session["user"]["role"] == "doctor"
        ):
            return redirect(
                url_for("prescription.doctor_prescription_list")
            )

        # Admin editing
        return redirect(
            url_for("prescription.prescription_list")
        )

    return render_template(
        "prescription/prescription_edit.html",
        prescription=prescription,
        patients=patients,
        doctors=doctors,
        appointments=appointments
    )


# ==========================================================
# Delete Prescription
# ==========================================================

@prescription_bp.route("/delete/<string:id>", methods=["POST"])
def prescription_delete(id):

    prescription = Prescription.query.get_or_404(id)

    db.session.delete(prescription)

    db.session.commit()

    flash(
        "Prescription deleted successfully.",
        "success"
    )

    if (
        "user" in session
        and session["user"]["role"] == "doctor"
    ):
        return redirect(
            url_for("prescription.doctor_prescription_list")
        )

    return redirect(
        url_for("prescription.prescription_list")
    )
# ==========================================================
# Doctor Prescription List
# ==========================================================

@prescription_bp.route("/doctor")
def doctor_prescription_list():

    # ---------------- Login Required ----------------

    if "user" not in session:
        return redirect(url_for("pages.login"))

    # ---------------- Doctor Only ----------------

    if session["user"]["role"] != "doctor":
        abort(403)

    # ---------------- Current Doctor ----------------

    doctor = Doctor.query.filter_by(
        user_id=session["user"]["id"]
    ).first_or_404()

    # ---------------- Only My Patients ----------------

    prescriptions = (
        Prescription.query
        .join(Patient)
        .filter(
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