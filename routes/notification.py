from sqlalchemy import cast, Date
from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    jsonify,
    session,
    abort
)
from datetime import datetime, date

from database import db
from models import Notification, User, Doctor
from utils import get_hospital_scope


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
    scope = get_hospital_scope()

    if scope.is_scoped:
        if scope.is_unassigned:
            notifications = []
            total_notifications = 0
            unread_notifications = 0
            alert_notifications = 0
            today_notifications = 0
        else:
            scoped_q = Notification.query.filter(Notification.user_id.in_(scope.user_ids))
            notifications = (
                scoped_q
                .order_by(Notification.created_at.desc())
                .all()
            )
            total_notifications = scoped_q.count()
            unread_notifications = scoped_q.filter(Notification.is_read == False).count()
            alert_notifications = scoped_q.filter(Notification.notification_type == "alert").count()
            today_notifications = scoped_q.filter(cast(Notification.created_at, Date) == date.today()).count()
    else:
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
            cast(Notification.created_at, Date) == date.today()
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
    scope = get_hospital_scope()

    if scope.is_unassigned:
        flash("Access denied. Please contact system administrator to assign a hospital.", "danger")
        return redirect(url_for("notification.notification_list"))

    if scope.is_scoped:
        users = User.query.filter(User.id.in_(scope.user_ids)).order_by(User.first_name).all()
    else:
        users = User.query.order_by(User.first_name).all()

    if request.method == "POST":

        user_id = request.form.get("user_id")
        title = request.form.get("title", "").strip()
        message = request.form.get("message", "").strip()
        notification_type = request.form.get("notification_type")

        errors = []

        if not user_id:
            errors.append("Please select a user.")
        elif scope.is_scoped and user_id not in scope.user_ids_set:
            errors.append("Access denied. Selected user does not belong to your hospital.")
        if not title:
            errors.append("Title is required.")
        if not message:
            errors.append("Message is required.")
        if notification_type not in NOTIFICATION_TYPES:
            errors.append("Please select a valid notification type.")

        if errors:
            for error in errors:
                flash(error, "danger")

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
    scope = get_hospital_scope()
    notification = Notification.query.get_or_404(id)

    if not scope.can_access_notification(notification):
        flash("Access denied. You do not have permission to access this notification.", "danger")
        return redirect(url_for("notification.notification_list"))

    if scope.is_scoped:
        users = User.query.filter(User.id.in_(scope.user_ids)).order_by(User.first_name).all()
    else:
        users = User.query.order_by(User.first_name).all()

    if request.method == "POST":

        user_id = request.form.get("user_id")
        title = request.form.get("title", "").strip()
        message = request.form.get("message", "").strip()
        notification_type = request.form.get("notification_type")

        errors = []

        if not user_id:
            errors.append("Please select a user.")
        elif scope.is_scoped and user_id not in scope.user_ids_set:
            errors.append("Access denied. Selected user does not belong to your hospital.")
        if not title:
            errors.append("Title is required.")
        if not message:
            errors.append("Message is required.")
        if notification_type not in NOTIFICATION_TYPES:
            errors.append("Please select a valid notification type.")

        if errors:
            for error in errors:
                flash(error, "danger")

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
    scope = get_hospital_scope()
    notification = Notification.query.get_or_404(id)

    if not scope.can_access_notification(notification):
        flash("Access denied. You do not have permission to delete this notification.", "danger")
        return redirect(url_for("notification.notification_list"))

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

    if "user" in session:
        user_role = session["user"].get("role")
        if user_role == "super_admin":
            notification = Notification.query.get_or_404(id)
        elif user_role == "admin":
            scope = get_hospital_scope()
            notification = Notification.query.get_or_404(id)
            if not scope.can_access_notification(notification):
                abort(403)
        else:
            notification = Notification.query.filter_by(
                id=id,
                user_id=session["user"]["id"]
            ).first_or_404()
    else:
        notification = Notification.query.get_or_404(id)

    notification.is_read = True
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Notification marked as read.",
        "id": notification.id
    })


# ==========================================================
# Doctor Notification List
# ==========================================================

@notification_bp.route("/doctor")
def doctor_notification_list():

    if "user" not in session:
        return redirect(url_for("pages.login"))

    if session["user"]["role"] != "doctor":
        abort(403)

    doctor = Doctor.query.filter_by(
        user_id=session["user"]["id"]
    ).first_or_404()

    notifications = (
        Notification.query
        .filter_by(user_id=session["user"]["id"])
        .order_by(Notification.created_at.desc())
        .all()
    )

    total_notifications = len(notifications)

    unread_notifications = (
        Notification.query
        .filter_by(
            user_id=session["user"]["id"],
            is_read=False
        )
        .count()
    )

    alert_notifications = (
        Notification.query
        .filter_by(
            user_id=session["user"]["id"],
            notification_type="alert"
        )
        .count()
    )

    today_notifications = (
        Notification.query
        .filter(
            Notification.user_id == session["user"]["id"],
            cast(Notification.created_at, Date) == date.today()
        )
        .count()
    )

    return render_template(
        "doctor/doctor_notification_list.html",
        doctor=doctor,
        notifications=notifications,
        total_notifications=total_notifications,
        unread_notifications=unread_notifications,
        alert_notifications=alert_notifications,
        today_notifications=today_notifications
    )