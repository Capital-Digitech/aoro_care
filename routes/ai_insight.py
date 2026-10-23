
from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
)

from database import db
from models import AIInsight, Patient, HealthData
from utils import get_hospital_scope


ai_insight_bp = Blueprint(
    "ai_insight",
    __name__,
    url_prefix="/ai-insight",
)


def _can_access_insight(scope, insight):
    if scope.is_super_admin:
        return True

    if scope.unassigned:
        return False

    patient = Patient.query.filter_by(id=insight.patient_id).first()

    return patient is not None and scope.can_access_patient(patient)


def _get_patients(scope):
    return scope.filter_patients(Patient.query).all()


def _get_insights(scope):
    return (
        scope.filter_insights(AIInsight.query)
        .order_by(AIInsight.created_at.desc())
        .all()
    )


# ==========================================================
# AI Insight List + Add
# ==========================================================

@ai_insight_bp.route("/", methods=["GET", "POST"])
def ai_insight_list():
    scope = get_hospital_scope()

    if request.method == "POST":
        if scope.unassigned:
            flash(
                "Access denied. Please contact system administrator "
                "to assign a hospital.",
                "danger",
            )
            return redirect(url_for("ai_insight.ai_insight_list"))

        patient_id = request.form.get("patient_id")
        patient = Patient.query.filter_by(id=patient_id).first()

        if not patient or not scope.can_access_patient(patient):
            flash(
                "Access denied. Invalid patient selected for your hospital.",
                "danger",
            )
            return redirect(url_for("ai_insight.ai_insight_list"))

        try:
            confidence_score = float(
                request.form.get("confidence_score", "")
            )
        except (TypeError, ValueError):
            flash("Please enter a valid confidence score.", "danger")
            return redirect(url_for("ai_insight.ai_insight_list"))

        insight = AIInsight(
            patient_id=patient.id,
            insight_type=request.form.get("insight_type", "").strip(),
            risk_level=request.form.get("risk_level", "").strip(),
            title=request.form.get("title", "").strip(),
            description=request.form.get("description", "").strip(),
            recommendation=request.form.get("recommendation", "").strip(),
            confidence_score=confidence_score,
        )

        try:
            db.session.add(insight)
            db.session.commit()
        except Exception:
            db.session.rollback()
            flash("Unable to add AI Insight. Please try again.", "danger")
            return redirect(url_for("ai_insight.ai_insight_list"))

        flash("AI Insight added successfully!", "success")
        return redirect(url_for("ai_insight.ai_insight_list"))

    patients = _get_patients(scope)
    insights = _get_insights(scope)

    return render_template(
        "ai_insight/ai_insight_list.html",
        insights=insights,
        patients=patients,
    )


# ==========================================================
# Edit AI Insight
# ==========================================================

@ai_insight_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def edit_ai_insight(id):
    scope = get_hospital_scope()
    insight = AIInsight.query.get_or_404(id)

    if not _can_access_insight(scope, insight):
        flash(
            "Access denied. You do not have permission to access this AI insight.",
            "danger",
        )
        return redirect(url_for("ai_insight.ai_insight_list"))

    patients = _get_patients(scope)

    if request.method == "POST":
        patient_id = request.form.get("patient_id")
        patient = Patient.query.filter_by(id=patient_id).first()

        if not patient or not scope.can_access_patient(patient):
            flash(
                "Access denied. Invalid patient selected for your hospital.",
                "danger",
            )
            return redirect(
                url_for("ai_insight.edit_ai_insight", id=id)
            )

        try:
            confidence_score = float(
                request.form.get("confidence_score", "")
            )
        except (TypeError, ValueError):
            flash("Please enter a valid confidence score.", "danger")
            return redirect(
                url_for("ai_insight.edit_ai_insight", id=id)
            )

        insight.patient_id = patient.id
        insight.insight_type = request.form.get("insight_type", "").strip()
        insight.risk_level = request.form.get("risk_level", "").strip()
        insight.title = request.form.get("title", "").strip()
        insight.description = request.form.get("description", "").strip()
        insight.recommendation = request.form.get(
            "recommendation", ""
        ).strip()
        insight.confidence_score = confidence_score

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            flash("Unable to update AI Insight. Please try again.", "danger")
            return redirect(
                url_for("ai_insight.edit_ai_insight", id=id)
            )

        flash("AI Insight updated successfully!", "success")
        return redirect(url_for("ai_insight.ai_insight_list"))

    return render_template(
        "ai_insight/edit_ai_insight.html",
        insight=insight,
        patients=patients,
    )


# ==========================================================
# Delete AI Insight
# ==========================================================

@ai_insight_bp.route("/delete/<string:id>", methods=["POST"])
def delete_ai_insight(id):
    scope = get_hospital_scope()
    insight = AIInsight.query.get_or_404(id)

    if not _can_access_insight(scope, insight):
        flash(
            "Access denied. You do not have permission to delete this AI insight.",
            "danger",
        )
        return redirect(url_for("ai_insight.ai_insight_list"))

    try:
        db.session.delete(insight)
        db.session.commit()
    except Exception:
        db.session.rollback()
        flash("Unable to delete AI Insight. Please try again.", "danger")
        return redirect(url_for("ai_insight.ai_insight_list"))

    flash("AI Insight deleted successfully!", "success")
    return redirect(url_for("ai_insight.ai_insight_list"))


# ==========================================================
# View AI Insight
# ==========================================================

@ai_insight_bp.route("/view/<string:id>")
def view_ai_insight(id):
    scope = get_hospital_scope()
    insight = AIInsight.query.get_or_404(id)

    if not _can_access_insight(scope, insight):
        flash(
            "Access denied. You do not have permission to view this AI insight.",
            "danger",
        )
        return redirect(url_for("ai_insight.ai_insight_list"))

    health_records = (
        HealthData.query.filter_by(patient_id=insight.patient_id)
        .order_by(HealthData.recorded_at.asc())
        .all()
    )

    return render_template(
        "ai_insight/view_ai_insight.html",
        insight=insight,
        health_records=health_records,
    )
