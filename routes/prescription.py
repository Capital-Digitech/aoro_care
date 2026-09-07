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

from datetime import datetime

from database import db

from models import (
    Patient,
    Doctor,
    Appointment,
    Prescription,
    PrescriptionMedicine
)


prescription_bp = Blueprint(
    "prescription",
    __name__,
    url_prefix="/prescription"
)


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
        datetime.strptime(value, "%Y-%m-%d").date()
        if value
        else None
    )


def _parse_time(value):
    return (
        datetime.strptime(value, "%H:%M").time()
        if value
        else None
    )


def _collect_medicine_rows(form):
    """
    Reads medicine_name[] / medicine_type[] / ... from the submitted
    form and returns:

      1. list of medicine dictionaries
      2. comma-separated medicine names for legacy column

    Index-safe:
    If one medicine field has fewer values than another,
    it will not raise IndexError.
    """

    names = form.getlist("medicine_name[]")
    types = form.getlist("medicine_type[]")
    dosages = form.getlist("medicine_dosage[]")
    quantities = form.getlist("medicine_quantity[]")
    frequencies = form.getlist("medicine_frequency[]")
    taking_times = form.getlist("medicine_taking_time[]")
    durations = form.getlist("medicine_duration[]")
    instructions = form.getlist("medicine_instructions[]")

    def _at(lst, index, default=None):
        value = (
            lst[index].strip()
            if index < len(lst) and lst[index]
            else ""
        )

        return value or default

    rows = []

    for index, name in enumerate(names):

        name = (name or "").strip()

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
        .filter_by(status="active")
        .all()
    )

    doctors = (
        Doctor.query
        .filter_by(status="active")
        .all()
    )

    appointments = Appointment.query.all()

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

        patient_id = request.form.get(
            "patient_id"
        )

        doctor_id = request.form.get(
            "doctor_id"
        )

        appointment_id = (
            request.form.get("appointment_id")
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

        if not patient_id or not doctor_id or not diagnosis:

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

        db.session.add(prescription)

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
# ADMIN / DOCTOR
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
    # Check logged-in role
    # ------------------------------------------------------

    logged_doctor = None

    if "user" in session:

        if session["user"].get("role") == "doctor":

            logged_doctor = _get_logged_in_doctor()

            if not logged_doctor:
                abort(403)

            # Doctor can edit ONLY own prescriptions
            if prescription.doctor_id != logged_doctor.id:
                abort(403)

            # Doctor's prescription patient must still
            # belong to that doctor
            patient_check = Patient.query.filter_by(
                id=prescription.patient_id,
                assigned_doctor_id=logged_doctor.id
            ).first()

            if not patient_check:
                abort(403)

    # ------------------------------------------------------
    # Doctor Edit
    # ------------------------------------------------------

    if logged_doctor:

        patients = (
            Patient.query
            .filter_by(
                assigned_doctor_id=logged_doctor.id,
                status="active"
            )
            .all()
        )

        appointments = (
            Appointment.query
            .filter_by(
                doctor_id=logged_doctor.id
            )
            .order_by(
                Appointment.appointment_date.desc()
            )
            .all()
        )

        doctors = [logged_doctor]

    # ------------------------------------------------------
    # Admin Edit
    # ------------------------------------------------------

    else:

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
                appointments=appointments,
                doctor=logged_doctor
            )

        # --------------------------------------------------
        # Doctor Security
        # --------------------------------------------------

        if logged_doctor:

            patient = Patient.query.filter_by(
                id=patient_id,
                assigned_doctor_id=logged_doctor.id,
                status="active"
            ).first()

            if not patient:
                abort(403)

            # Doctor cannot change doctor_id.
            prescription.doctor_id = logged_doctor.id

        else:

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

            prescription.doctor_id = doctor_id

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

            if logged_doctor:

                appointment = Appointment.query.filter_by(
                    id=appointment_id,
                    doctor_id=logged_doctor.id,
                    patient_id=patient_id
                ).first()

            else:

                appointment = Appointment.query.filter_by(
                    id=appointment_id,
                    patient_id=patient_id
                ).first()

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
                appointments=appointments,
                doctor=logged_doctor
            )

        # --------------------------------------------------
        # Update Prescription
        # --------------------------------------------------

        prescription.patient_id = patient_id

        prescription.appointment_id = (
            appointment_id
        )

        prescription.diagnosis = diagnosis

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

        prescription.status = request.form.get(
            "status",
            "Active"
        )

        # Keep legacy medicines column synced
        prescription.medicines = legacy_medicines

        # --------------------------------------------------
        # Replace medicines
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

        db.session.commit()

        flash(
            "Prescription updated successfully.",
            "success"
        )

        if logged_doctor:

            return redirect(
                url_for(
                    "prescription.doctor_prescription_list"
                )
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
        appointments=appointments,
        doctor=logged_doctor
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
    # Doctor Security
    # ------------------------------------------------------

    if "user" not in session:
        return redirect(
            url_for("pages.login")
        )

    role = session["user"].get("role")

    # Doctor is NOT allowed to delete
    if role == "doctor":
        abort(403)

    # Only Admin/Super Admin should reach here
    if role not in (
        "admin",
        "super_admin"
    ):
        abort(403)

    db.session.delete(prescription)

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

@prescription_bp.route("/doctor")
def doctor_prescription_list():

    doctor = _get_logged_in_doctor()

    if not doctor:
        return redirect(
            url_for("pages.login")
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

        allowed_patient = Patient.query.filter_by(
            id=selected_patient_id,
            assigned_doctor_id=doctor.id,
            status="active"
        ).first()

        if not allowed_patient:
            abort(403)

    # ------------------------------------------------------
    # POST
    # ------------------------------------------------------

    if request.method == "POST":

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
        # Required fields
        # --------------------------------------------------

        if not patient_id or not diagnosis:

            flash(
                "Patient and Diagnosis are required.",
                "danger"
            )

            return render_template(
                "prescription/doctor_prescription_add.html",
                doctor=doctor,
                patients=patients,
                appointments=appointments,
                selected_patient_id=patient_id
            )

        # --------------------------------------------------
        # Verify patient belongs to doctor
        # --------------------------------------------------

        patient = Patient.query.filter_by(
            id=patient_id,
            assigned_doctor_id=doctor.id,
            status="active"
        ).first()

        if not patient:
            abort(403)

        # --------------------------------------------------
        # Verify appointment
        # --------------------------------------------------

        if appointment_id:

            appointment = Appointment.query.filter_by(
                id=appointment_id,
                doctor_id=doctor.id,
                patient_id=patient.id
            ).first()

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
               "prescription/doctor_prescription_add.html",
                doctor=doctor,
                patients=patients,
                appointments=appointments,
                selected_patient_id=patient_id
            )

        # --------------------------------------------------
        # Create Prescription
        # --------------------------------------------------

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

        db.session.add(prescription)

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
            "Prescription created successfully.",
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
        "prescription/doctor_prescription_add.html",
        doctor=doctor,
        patients=patients,
        appointments=appointments,
        selected_patient_id=selected_patient_id
    )