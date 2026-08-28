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
    session
)

from database import db
from models import Patient, Doctor, Appointment


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

    if "user" not in session:
        abort(
            401,
            description="Login required."
        )

    if session["user"]["role"] != "doctor":
        abort(
            403,
            description="Doctor access required."
        )

    user_id = session["user"]["id"]

    doctor = Doctor.query.filter_by(
        user_id=user_id
    ).first()

    if doctor is None:
        abort(
            403,
            description="Doctor profile not found."
        )

    return doctor

def _current_doctor():

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

    doctor = _current_doctor()

    appointment = Appointment.query.filter_by(
        id=appointment_id,
        doctor_id=doctor.id
    ).first()

    if appointment is None:
        abort(404, description="Appointment not found.")

    return appointment

# ==========================================================
# ADMIN APPOINTMENT LIST
# ==========================================================

@appointment_bp.route("/")
def appointment_list():

    appointments = Appointment.query.order_by(
        Appointment.created_at.desc()
    ).all()


    patients = Patient.query.filter_by(
        status="active"
    ).all()


    doctors = Doctor.query.filter_by(
        status="active"
    ).all()


    return render_template(
        "appointment/appointment_list.html",
        appointments=appointments,
        patients=patients,
        doctors=doctors
    )



# ==========================================================
# ADMIN ADD APPOINTMENT
# ==========================================================

@appointment_bp.route(
    "/add",
    methods=["GET", "POST"]
)
def appointment_add():


    patients = Patient.query.filter_by(
        status="active"
    ).all()


    doctors = Doctor.query.filter_by(
        status="active"
    ).all()



    if request.method == "POST":


        appointment = Appointment(

            patient_id=request.form.get(
                "patient_id"
            ),

            doctor_id=request.form.get(
                "doctor_id"
            ),

            appointment_date=_parse_date(
                request.form.get(
                    "appointment_date"
                )
            ),

            appointment_time=_parse_time(
                request.form.get(
                    "appointment_time"
                )
            ),

            appointment_type=request.form.get(
                "appointment_type"
            ),

            reason=request.form.get(
                "reason"
            ),

            meeting_link=request.form.get(
                "meeting_link"
            ),

            status=request.form.get(
                "status",
                "scheduled"
            )
        )


        db.session.add(
            appointment
        )

        db.session.commit()


        flash(
            "Appointment added successfully.",
            "success"
        )


        return redirect(
            url_for(
                "appointment.appointment_list"
            )
        )



    return render_template(
    "appointment/add_appointment.html",
    patients=patients,
    doctors=doctors
)



# ==========================================================
# ADMIN EDIT APPOINTMENT
# ==========================================================

@appointment_bp.route(
    "/edit/<string:id>",
    methods=["GET", "POST"]
)
def appointment_edit(id):


    appointment = Appointment.query.get_or_404(
        id
    )


    patients = Patient.query.filter_by(
        status="active"
    ).all()


    doctors = Doctor.query.filter_by(
        status="active"
    ).all()



    if request.method == "POST":


        appointment.patient_id = request.form.get(
            "patient_id"
        )


        appointment.doctor_id = request.form.get(
            "doctor_id"
        )


        appointment.appointment_date = _parse_date(
            request.form.get(
                "appointment_date"
            )
        )


        appointment.appointment_time = _parse_time(
            request.form.get(
                "appointment_time"
            )
        )


        appointment.appointment_type = request.form.get(
            "appointment_type"
        )


        appointment.reason = request.form.get(
            "reason"
        )


        appointment.meeting_link = request.form.get(
            "meeting_link"
        )


        appointment.status = request.form.get(
            "status"
        )


        db.session.commit()



        flash(
            "Appointment updated successfully.",
            "success"
        )


        return redirect(
            url_for(
                "appointment.appointment_list"
            )
        )



    return render_template(
        "appointment/appointment_edit.html",
        appointment=appointment,
        patients=patients,
        doctors=doctors
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
# DOCTOR CONFIRM APPOINTMENT
# ==========================================================

@appointment_bp.route(
    "/doctor/<string:appointment_id>/confirm",
    methods=["POST"]
)
def doctor_appointment_confirm(
    appointment_id
):


    appointment = _get_doctor_appointment(
        appointment_id
    )


    appointment.status = "confirmed"


    db.session.commit()


    return jsonify(
        success=True,
        message="Appointment confirmed successfully.",
        status=appointment.status
    )



# ==========================================================
# DOCTOR COMPLETE APPOINTMENT
# ==========================================================

@appointment_bp.route(
    "/doctor/<string:appointment_id>/complete",
    methods=["POST"]
)
def doctor_appointment_complete(
    appointment_id
):


    appointment = _get_doctor_appointment(
        appointment_id
    )


    appointment.status = "completed"


    db.session.commit()


    return jsonify(
        success=True,
        message="Appointment completed successfully.",
        status=appointment.status
    )



# ==========================================================
# DOCTOR CANCEL APPOINTMENT
# ==========================================================

@appointment_bp.route(
    "/doctor/<string:appointment_id>/cancel",
    methods=["POST"]
)
def doctor_appointment_cancel(
    appointment_id
):


    appointment = _get_doctor_appointment(
        appointment_id
    )


    appointment.status = "cancelled"


    db.session.commit()


    return jsonify(
        success=True,
        message="Appointment cancelled successfully.",
        status=appointment.status
    )



# ==========================================================
# DOCTOR RESCHEDULE APPOINTMENT
# ==========================================================

@appointment_bp.route(
    "/doctor/<string:appointment_id>/reschedule",
    methods=["POST"]
)
def doctor_appointment_reschedule(
    appointment_id
):


    appointment = _get_doctor_appointment(
        appointment_id
    )


    new_date = _parse_date(
        request.form.get(
            "appointment_date"
        )
    )


    new_time = _parse_time(
        request.form.get(
            "appointment_time"
        )
    )


    if not new_date or not new_time:

        abort(
            400,
            description="Valid date and time required."
        )


    appointment.appointment_date = new_date

    appointment.appointment_time = new_time


    db.session.commit()



    return jsonify(
        success=True,
        message="Appointment rescheduled successfully."
    )



# ==========================================================
# DOCTOR NOTES
# ==========================================================

@appointment_bp.route(
    "/doctor/<string:appointment_id>/notes",
    methods=["POST"]
)
def doctor_appointment_notes(
    appointment_id
):


    appointment = _get_doctor_appointment(
        appointment_id
    )


    notes = request.form.get(
        "notes"
    )


    appointment.doctor_notes = notes


    db.session.commit()



    return jsonify(
        success=True,
        message="Doctor notes saved successfully."
    )



# ==========================================================
# DOCTOR PRESCRIPTION
# ==========================================================

@appointment_bp.route(
    "/doctor/<string:appointment_id>/prescription",
    methods=["POST"]
)
def doctor_appointment_prescription(
    appointment_id
):


    appointment = _get_doctor_appointment(
        appointment_id
    )


    prescription = request.form.get(
        "prescription"
    )


    appointment.prescription = prescription


    db.session.commit()



    return jsonify(
        success=True,
        message="Prescription saved successfully."
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