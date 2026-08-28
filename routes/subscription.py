from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash
)

from database import db
from models import Subscription, Patient

subscription_bp = Blueprint(
    "subscription",
    __name__,
    url_prefix="/subscription"
)


# ==========================================================
# Subscription List
# ==========================================================
@subscription_bp.route("/")
def subscription_list():

    subscriptions = Subscription.query.order_by(
        Subscription.created_at.desc()
    ).all()

    return render_template(
        "subscription/subscription_list.html",
        subscriptions=subscriptions
    )


# ==========================================================
# Add Subscription
# ==========================================================
@subscription_bp.route("/add", methods=["GET", "POST"])
def add_subscription():

    patients = Patient.query.all()

    if request.method == "POST":

        subscription = Subscription(
            patient_id=request.form["patient_id"],
            plan_name=request.form["plan_name"],
            price=request.form["price"],
            billing_cycle=request.form["billing_cycle"],
            start_date=request.form["start_date"],
            end_date=request.form["end_date"],
            payment_status=request.form["payment_status"],
            auto_renew=True if request.form.get("auto_renew") else False
        )

        db.session.add(subscription)
        db.session.commit()

        flash(
            "Subscription added successfully!",
            "success"
        )

        return redirect(
            url_for("subscription.subscription_list")
        )

    return render_template(
        "subscription/add_subscription.html",
        patients=patients
    )


# ==========================================================
# Edit Subscription
# ==========================================================
@subscription_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def edit_subscription(id):

    subscription = Subscription.query.get_or_404(id)
    patients = Patient.query.all()

    if request.method == "POST":

        subscription.patient_id = request.form["patient_id"]
        subscription.plan_name = request.form["plan_name"]
        subscription.price = request.form["price"]
        subscription.billing_cycle = request.form["billing_cycle"]
        subscription.start_date = request.form["start_date"]
        subscription.end_date = request.form["end_date"]
        subscription.payment_status = request.form["payment_status"]
        subscription.auto_renew = True if request.form.get("auto_renew") else False

        db.session.commit()

        flash(
            "Subscription updated successfully!",
            "success"
        )

        return redirect(
            url_for("subscription.subscription_list")
        )

    return render_template(
        "subscription/edit_subscription.html",
        subscription=subscription,
        patients=patients
    )


# ==========================================================
# Delete Subscription
# ==========================================================
@subscription_bp.route("/delete/<string:id>", methods=["POST"])
def delete_subscription(id):

    subscription = Subscription.query.get_or_404(id)

    db.session.delete(subscription)
    db.session.commit()

    flash(
        "Subscription deleted successfully!",
        "success"
    )

    return redirect(
        url_for("subscription.subscription_list")
    )