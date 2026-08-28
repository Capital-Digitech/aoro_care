from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    jsonify
)
from datetime import datetime, date

from database import db
from models import Notification, User


notification_bp = Blueprint(
    "notification",
    __name__,
    url_prefix="/notification"
)

# NOTE: This blueprint is intentionally NOT csrf-exempted.
# All POST/PUT/PATCH/DELETE requests (including fetch() calls from
# notification.js) must send a valid CSRF token — see notification_list.html
# <meta name="csrf-token"> and notification.js getCsrfToken().

NOTIFICATION_TYPES = ["alert", "appointment", "report", "system"]


# ==========================================================
# Notification List
# ==========================================================

@notification_bp.route("/")
def notification_list():

    notifications = (
        Notification.query
        .order_by(Notification.created_at.desc())
        .all()
    )

    total_notifications = Notification.query.count()

    unread_notifications = Notification.query.filter_by(
        is_read=False
    ).count()

    alert_notifications = Notification.query.filter_by(
        notification_type="alert"
    ).count()

    today_notifications = Notification.query.filter(
        db.func.date(Notification.created_at) == date.today()
    ).count()

    return render_template(
        "notification/notification_list.html",
        notifications=notifications,
        total_notifications=total_notifications,
        unread_notifications=unread_notifications,
        alert_notifications=alert_notifications,
        today_notifications=today_notifications
    )


# ==========================================================
# Add Notification
# ==========================================================

@notification_bp.route("/add", methods=["GET", "POST"])
def notification_add():

    if request.method == "POST":

        user_id = request.form.get("user_id")
        title = request.form.get("title", "").strip()
        message = request.form.get("message", "").strip()
        notification_type = request.form.get("notification_type")

        errors = []

        if not user_id:
            errors.append("Please select a user.")
        if not title:
            errors.append("Title is required.")
        if not message:
            errors.append("Message is required.")
        if notification_type not in NOTIFICATION_TYPES:
            errors.append("Please select a valid notification type.")

        if errors:
            for error in errors:
                flash(error, "danger")

            users = User.query.order_by(User.first_name).all()

            return render_template(
                "notification/notification_add.html",
                users=users,
                form_data=request.form
            )

        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            is_read=False,
            created_at=datetime.utcnow()
        )

        db.session.add(notification)
        db.session.commit()

        flash("Notification added successfully!", "success")

        return redirect(
            url_for("notification.notification_list")
        )

    users = User.query.order_by(User.first_name).all()

    return render_template(
        "notification/notification_add.html",
        users=users,
        form_data={}
    )


# ==========================================================
# Edit Notification
# ==========================================================

@notification_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def notification_edit(id):

    notification = Notification.query.get_or_404(id)

    if request.method == "POST":

        user_id = request.form.get("user_id")
        title = request.form.get("title", "").strip()
        message = request.form.get("message", "").strip()
        notification_type = request.form.get("notification_type")

        errors = []

        if not user_id:
            errors.append("Please select a user.")
        if not title:
            errors.append("Title is required.")
        if not message:
            errors.append("Message is required.")
        if notification_type not in NOTIFICATION_TYPES:
            errors.append("Please select a valid notification type.")

        if errors:
            for error in errors:
                flash(error, "danger")

            users = User.query.order_by(User.first_name).all()

            return render_template(
                "notification/notification_edit.html",
                notification=notification,
                users=users
            )

        notification.user_id = user_id
        notification.title = title
        notification.message = message
        notification.notification_type = notification_type

        db.session.commit()

        flash("Notification updated successfully!", "success")

        return redirect(
            url_for("notification.notification_list")
        )

    users = User.query.order_by(User.first_name).all()

    return render_template(
        "notification/notification_edit.html",
        notification=notification,
        users=users
    )


# ==========================================================
# Delete Notification
# ==========================================================

@notification_bp.route("/delete/<string:id>", methods=["POST"])
def notification_delete(id):

    notification = Notification.query.get_or_404(id)

    db.session.delete(notification)
    db.session.commit()

    flash("Notification deleted successfully!", "success")

    return redirect(
        url_for("notification.notification_list")
    )


# ==========================================================
# Mark Notification As Read (AJAX — called from view modal)
# ==========================================================

@notification_bp.route("/mark-read/<string:id>", methods=["POST"])
def notification_mark_read(id):

    notification = Notification.query.get_or_404(id)

    notification.is_read = True
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Notification marked as read.",
        "id": notification.id
    })