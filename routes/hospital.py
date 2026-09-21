from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash
)

from database import db
from models import Hospital
from database import csrf


hospital_bp = Blueprint(
    "hospital",
    __name__,
    url_prefix="/hospital"
)
csrf.exempt(hospital_bp)

# ==========================================================
# Hospital List
# ==========================================================

@hospital_bp.route("/")
def hospital_list():

    hospitals = Hospital.query.all()

    return render_template(
        "hospital/hospital_list.html",
        hospitals=hospitals
    )


# ==========================================================
# Add Hospital
# ==========================================================

@hospital_bp.route("/add", methods=["GET", "POST"])
def hospital_add():

    if request.method == "POST":

        hospital = Hospital(

            
            hospital_name=request.form.get("hospital_name"),
hospital_code=request.form.get("hospital_code"),
email=request.form.get("email"),
phone=request.form.get("phone"),
address=request.form.get("address"),
city=request.form.get("city"),
state=request.form.get("state"),
country=request.form.get("country"),
pincode=request.form.get("pincode"),
website=request.form.get("website"),
license_number=request.form.get("license_number"),
established_year=request.form.get("established_year"),
status=request.form.get("status"),
        )

        db.session.add(hospital)
        db.session.commit()

        flash(
            "Hospital added successfully!",
            "success"
        )

        return redirect(
            url_for("hospital.hospital_list")
        )

    return render_template(
        "hospital/add_hospital.html"
    )


# ==========================================================
# Edit Hospital
# ==========================================================

@hospital_bp.route(
    "/edit/<string:id>",
    methods=["GET", "POST"]
)
def hospital_edit(id):
    hospital = Hospital.query.get_or_404(id)

    if request.method == "POST":
        hospital.hospital_name = request.form.get("hospital_name")
        hospital.hospital_code = request.form.get("hospital_code")
        hospital.email = request.form.get("email")
        hospital.phone = request.form.get("phone")
        hospital.address = request.form.get("address")
        hospital.city = request.form.get("city")
        hospital.state = request.form.get("state")
        hospital.country = request.form.get("country")
        hospital.pincode = request.form.get("pincode")
        hospital.website = request.form.get("website")
        hospital.license_number = request.form.get("license_number")
        year = request.form.get("established_year")
        hospital.established_year = int(year) if year and str(year).strip().isdigit() else None
        hospital.status = request.form.get("status", "active")

        db.session.commit()

        flash(
            "Hospital updated successfully!",
            "success"
        )

        return redirect(
            url_for("hospital.hospital_list")
        )

    return render_template(
        "hospital/edit_hospital.html",
        hospital=hospital
    )


# ==========================================================
# Delete Hospital
# ==========================================================

@hospital_bp.route(
    "/delete/<string:id>",
    methods=["POST"]
)
def hospital_delete(id):

    hospital = Hospital.query.get_or_404(id)

    db.session.delete(hospital)
    db.session.commit()

    flash(
        "Hospital deleted successfully!",
        "success"
    )

    return redirect(
        url_for("hospital.hospital_list")
    )



