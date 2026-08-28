from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash
)

from werkzeug.security import generate_password_hash

from database import db
from models import User, Doctor, Hospital


doctor_bp = Blueprint(
    "doctor",
    __name__,
    url_prefix="/doctor"
)



# ==========================================================
# Doctor List
# ==========================================================

@doctor_bp.route("/")
def doctor_list():

    doctors = Doctor.query.all()

    hospitals = Hospital.query.all()


    total_doctors = len(doctors)

    active_doctors = Doctor.query.filter_by(
        status="active"
    ).count()


    total_specializations = db.session.query(
        Doctor.specialization
    ).distinct().count()


    total_patients_treated = 0


    return render_template(
        "doctor/doctor_list.html",

        doctors=doctors,

        hospitals=hospitals,

        total_doctors=total_doctors,

        active_doctors=active_doctors,

        total_specializations=total_specializations,

        total_patients_treated=total_patients_treated
    )



# ==========================================================
# Add Doctor
# ==========================================================

@doctor_bp.route(
    "/add",
    methods=["GET","POST"]
)
def doctor_add():

    hospitals = Hospital.query.all()


    if request.method == "POST":

        try:


            user = User(

                role="doctor",

                first_name=request.form.get(
                    "first_name"
                ),

                last_name=request.form.get(
                    "last_name"
                ),

                email=request.form.get(
                    "email"
                ),

                mobile=request.form.get(
                    "mobile"
                ),

                gender=request.form.get(
                    "gender"
                ),

                address=request.form.get(
                    "address"
                ),

                is_verified=True

            )


            user.password_hash = generate_password_hash(
                "Doctor@123"
            )


            db.session.add(user)

            db.session.flush()



            doctor = Doctor(

                user_id=user.id,

                hospital_id=request.form.get(
                    "hospital_id"
                ),

                doctor_code=request.form.get(
                    "doctor_code"
                ),

                specialization=request.form.get(
                    "specialization"
                ),

                qualification=request.form.get(
                    "qualification"
                ),

                experience_years=request.form.get(
                    "experience_years"
                ),

                medical_license=request.form.get(
                    "medical_license"
                ),

                consultation_fee=request.form.get(
                    "consultation_fee"
                ),

                about=request.form.get(
                    "about"
                ),

                available_days=request.form.get(
                    "available_days"
                ),

                available_time=request.form.get(
                    "available_time"
                ),

                status=request.form.get(
                    "status"
                )

            )


            db.session.add(doctor)

            db.session.commit()



            flash(
                "Doctor added successfully!",
                "success"
            )


        except Exception as e:


            db.session.rollback()

            flash(
                str(e),
                "danger"
            )


        return redirect(
            url_for(
                "doctor.doctor_list"
            )
        )


    return render_template(
        "doctor/add_doctor.html",
        hospitals=hospitals
    )





# ==========================================================
# Edit Doctor
# ==========================================================

@doctor_bp.route(
    "/edit/<string:id>",
    methods=["GET","POST"]
)
def doctor_edit(id):


    doctor = Doctor.query.get_or_404(id)

    hospitals = Hospital.query.all()



    if request.method == "POST":


        doctor.user.first_name = request.form.get(
            "first_name"
        )

        doctor.user.last_name = request.form.get(
            "last_name"
        )

        doctor.user.email = request.form.get(
            "email"
        )

        doctor.user.mobile = request.form.get(
            "mobile"
        )



        doctor.hospital_id = request.form.get(
            "hospital_id"
        )

        doctor.specialization = request.form.get(
            "specialization"
        )

        doctor.qualification = request.form.get(
            "qualification"
        )

        doctor.experience_years = request.form.get(
            "experience_years"
        )

        doctor.medical_license = request.form.get(
            "medical_license"
        )


        doctor.consultation_fee = request.form.get(
            "consultation_fee"
        )

        doctor.about = request.form.get(
            "about"
        )

        doctor.available_days = request.form.get(
            "available_days"
        )

        doctor.available_time = request.form.get(
            "available_time"
        )

        doctor.status = request.form.get(
            "status"
        )



        db.session.commit()



        flash(
            "Doctor updated successfully!",
            "success"
        )


        return redirect(
            url_for(
                "doctor.doctor_list"
            )
        )



    return render_template(
        "doctor/edit_doctor.html",
        doctor=doctor,
        hospitals=hospitals
    )





# ==========================================================
# Delete Doctor
# ==========================================================

@doctor_bp.route(
    "/delete/<string:id>",
    methods=["POST"]
)
def doctor_delete(id):


    doctor = Doctor.query.get_or_404(id)


    user = doctor.user



    try:

        db.session.delete(doctor)


        if user:

            db.session.delete(user)



        db.session.commit()


        flash(
            "Doctor deleted successfully!",
            "success"
        )


    except Exception as e:


        db.session.rollback()


        flash(
            str(e),
            "danger"
        )



    return redirect(
        url_for(
            "doctor.doctor_list"
        )
    )