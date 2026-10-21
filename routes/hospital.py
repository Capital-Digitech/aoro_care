
from flask import (
    Blueprint, render_template, request, redirect,
    url_for, flash, session, abort
)

from database import db, csrf
from models import Hospital, User

hospital_bp = Blueprint("hospital", __name__, url_prefix="/hospital")
csrf.exempt(hospital_bp)


def _current_user():
    user_id = session.get("user_id")
    role = session.get("role")

    if not user_id or role not in ("admin", "super_admin"):
        return None

    user = db.session.get(User, user_id)

    if not user or user.role != role:
        return None

    return user


def _hospital_or_404(hospital_id, user):
    query = Hospital.query.filter_by(id=hospital_id)

    if user.role == "admin":
        if not user.hospital_id:
            abort(403)
        query = query.filter_by(id=user.hospital_id)

    return query.first_or_404()


@hospital_bp.route("/")
def hospital_list():
    user = _current_user()

    if not user:
        abort(403)

    query = Hospital.query

    if user.role == "admin":
        if not user.hospital_id:
            hospitals = []
        else:
            hospitals = query.filter_by(id=user.hospital_id).all()
    else:
        hospitals = query.order_by(Hospital.hospital_name).all()

    total_hospitals = len(hospitals)
    active_hospitals = sum(
        1 for hospital in hospitals
        if (hospital.status or "").lower() == "active"
    )

    affiliated_doctors = sum(len(hospital.doctors) for hospital in hospitals)

    return render_template(
        "hospital/hospital_list.html",
        hospitals=hospitals,
        total_hospitals=total_hospitals,
        active_hospitals=active_hospitals,
        affiliated_doctors=affiliated_doctors
    )


@hospital_bp.route("/add", methods=["GET", "POST"])
def hospital_add():
    user = _current_user()

    if not user:
        abort(403)

    if user.role != "super_admin":
        abort(403)

    if request.method == "POST":
        year = request.form.get("established_year")

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
            established_year=int(year) if year and year.strip().isdigit() else None,
            status=request.form.get("status") or "active",
        )

        db.session.add(hospital)
        db.session.commit()

        flash("Hospital added successfully!", "success")
        return redirect(url_for("hospital.hospital_list"))

    return render_template("hospital/add_hospital.html")


@hospital_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def hospital_edit(id):
    user = _current_user()

    if not user:
        abort(403)

    hospital = _hospital_or_404(id, user)

    # Only Super Admin can create, edit, or manage hospital records.
    if user.role != "super_admin":
        abort(403)

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
        hospital.established_year = (
            int(year) if year and year.strip().isdigit() else None
        )
        hospital.status = request.form.get("status") or "active"

        db.session.commit()
        flash("Hospital updated successfully!", "success")
        return redirect(url_for("hospital.hospital_list"))

    return render_template("hospital/edit_hospital.html", hospital=hospital)


@hospital_bp.route("/delete/<string:id>", methods=["POST"])
def hospital_delete(id):
    user = _current_user()

    if not user:
        abort(403)

    if user.role != "super_admin":
        abort(403)

    hospital = _hospital_or_404(id, user)

    db.session.delete(hospital)
    db.session.commit()

    flash("Hospital deleted successfully!", "success")
    return redirect(url_for("hospital.hospital_list"))
