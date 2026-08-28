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
from models import User, Patient, FamilyMember, PatientFamily

family_bp = Blueprint(
    "family",
    __name__,
    url_prefix="/family"
)


# ==========================================================
# Family Member List
# ==========================================================

@family_bp.route("/")
def family_list():

    families = FamilyMember.query.order_by(
        FamilyMember.created_at.desc()
    ).all()

    patients = Patient.query.filter_by(
        status="active"
    ).all()

    return render_template(
        "family/family_list.html",
        families=families,
        patients=patients
    )

## ==========================================================
# Add Family Member
# ==========================================================

@family_bp.route("/add", methods=["GET", "POST"])
def family_add():

    patients = Patient.query.filter_by(status="active").all()

    if request.method == "POST":

        # Check duplicate email
        existing_user = User.query.filter_by(
            email=request.form["email"]
        ).first()

        if existing_user:
            flash("Email already exists. Please use another email.", "danger")
            return redirect(url_for("family.family_list"))

        # ---------------- User ----------------
        user = User(
            role="family",
            first_name=request.form["first_name"],
            last_name=request.form["last_name"],
            email=request.form["email"],
            mobile=request.form.get("mobile"),
            gender=request.form.get("gender"),
            address=request.form.get("address"),
            is_verified=True
        )

        user.password_hash = generate_password_hash("Family@123")

        db.session.add(user)
        db.session.flush()

        # ---------------- Family Member ----------------
        family = FamilyMember(
            user_id=user.id,
            relationship=request.form.get("relationship"),
            can_view_reports=True if request.form.get("can_view_reports") else False,
            can_receive_alerts=True if request.form.get("can_receive_alerts") else False
        )

        db.session.add(family)
        db.session.flush()

        # ---------------- Patient ↔ Family ----------------
        link = PatientFamily(
            patient_id=request.form["patient_id"],
            family_member_id=family.id
        )

        db.session.add(link)
        db.session.commit()

        flash("Family member added successfully.", "success")
        return redirect(url_for("family.family_list"))

    return render_template(
        "family/family_add.html",
        patients=patients
    )


# ==========================================================
# Edit Family Member
# ==========================================================

@family_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def family_edit(id):

    family = FamilyMember.query.get_or_404(id)
    user = family.user

    patients = Patient.query.filter_by(status="active").all()

    link = PatientFamily.query.filter_by(
        family_member_id=family.id
    ).first()

    if request.method == "POST":

        # ---------------- User ----------------
        user.first_name = request.form["first_name"]
        user.last_name = request.form["last_name"]
        user.email = request.form["email"]
        user.mobile = request.form.get("mobile")
        user.gender = request.form.get("gender")
        user.address = request.form.get("address")

        # ---------------- Family Member ----------------
        family.relationship = request.form.get("relationship")
        family.can_view_reports = True if request.form.get("can_view_reports") else False
        family.can_receive_alerts = True if request.form.get("can_receive_alerts") else False

        # ---------------- Update Patient Link ----------------
        if link:
            link.patient_id = request.form["patient_id"]

        db.session.commit()

        flash("Family member updated successfully.", "success")
        return redirect(url_for("family.family_list"))

    return render_template(
        "family/family_edit.html",
        family=family,
        patients=patients,
        link=link
    )
# ==========================================================
# Delete Family Member
# ==========================================================

@family_bp.route("/delete/<string:id>", methods=["POST"])
def family_delete(id):

    family = FamilyMember.query.get_or_404(id)

    user = family.user

    db.session.delete(family)
    db.session.delete(user)

    db.session.commit()

    flash("Family member deleted successfully.", "success")

    return redirect(url_for("family.family_list"))