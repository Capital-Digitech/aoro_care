from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash
)

from database import db
from models import AIInsight, Patient, HealthData

print("AI INSIGHT ROUTE LOADED")

# ==========================================================
# Blueprint
# ==========================================================

ai_insight_bp = Blueprint(
    "ai_insight",
    __name__,
    url_prefix="/ai-insight"
)


#

# ==========================================================
# AI Insight List + Add
# ==========================================================

@ai_insight_bp.route("/", methods=["GET", "POST"])
def ai_insight_list():

    patients = Patient.query.all()

    if request.method == "POST":

        insight = AIInsight(
            patient_id=request.form["patient_id"],
            insight_type=request.form["insight_type"],
            risk_level=request.form["risk_level"],
            title=request.form["title"],
            description=request.form["description"],
            recommendation=request.form["recommendation"],
            confidence_score=request.form["confidence_score"]
        )

        db.session.add(insight)
        db.session.commit()

        flash("AI Insight added successfully!", "success")

        return redirect(
            url_for("ai_insight.ai_insight_list")
        )

    insights = AIInsight.query.order_by(
        AIInsight.created_at.desc()
    ).all()

    return render_template(
        "ai_insight/ai_insight_list.html",
        insights=insights,
        patients=patients
    )
# ==========================================================
# Edit AI Insight
# ==========================================================

@ai_insight_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def edit_ai_insight(id):

    insight = AIInsight.query.get_or_404(id)
    patients = Patient.query.all()

    if request.method == "POST":

        insight.patient_id = request.form["patient_id"]
        insight.insight_type = request.form["insight_type"]
        insight.risk_level = request.form["risk_level"]
        insight.title = request.form["title"]
        insight.description = request.form["description"]
        insight.recommendation = request.form["recommendation"]
        insight.confidence_score = request.form["confidence_score"]

        db.session.commit()

        flash("AI Insight updated successfully!", "success")

        return redirect(
            url_for("ai_insight.ai_insight_list")
        )

    return render_template(
        "ai_insight/edit_ai_insight.html",
        insight=insight,
        patients=patients
    )


# ==========================================================
# Delete AI Insight
# ==========================================================

@ai_insight_bp.route("/delete/<string:id>", methods=["POST"])
def delete_ai_insight(id):

    insight = AIInsight.query.get_or_404(id)

    db.session.delete(insight)
    db.session.commit()

    flash("AI Insight deleted successfully!", "success")

    return redirect(
        url_for("ai_insight.ai_insight_list")
    )

# ==========================================================
# View AI Insight
# ==========================================================

@ai_insight_bp.route("/view/<string:id>")
def view_ai_insight(id):

    insight = AIInsight.query.get_or_404(id)

    # Fetch actual health data belonging to this patient
    health_records = HealthData.query.filter_by(
        patient_id=insight.patient_id
    ).order_by(
        HealthData.recorded_at.asc()
    ).all()

    return render_template(
        "ai_insight/view_ai_insight.html",
        insight=insight,
        health_records=health_records
    )