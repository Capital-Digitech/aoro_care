
from datetime import datetime, date

from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    jsonify,
    session,
    abort,
)
from sqlalchemy import cast, Date

from database import db
from models import Notification, User, Doctor
from utils import get_hospital_scope


notification_bp = Blueprint(
    "notification",
    __name__,
    url_prefix="/notification",
)

# Keep CSRF protection enabled.
NOTIFICATION_TYPES = ["alert", "appointment", "report", "system"]


def _can_access_notification(scope, notification):
    """Check notification access using the existing HospitalScope methods."""
    if scope.is_super_admin:
        return True

    if scope.unassigned:
        return False

    return (
        scope.filter_notifications(
            Notification.query.filter_by(id=notification.id)
        ).first()
        is not None
    )


def _get_users(scope):
    if scope.is_super_admin:
        return User.query.order_by(User.first_name).all()

    if scope.unassigned:
        return []

    return (
        User.query.filter(User.id.in_(scope.user_ids))
        .order_by(User.first_name)
        .all()
    )


def _user_belongs_to_scope(scope, user_id):
    if scope.is_super_admin:
        return User.query.filter_by(id=user_id).first() is not None

    if scope.unassigned:
        return False

    return (
        User.query.filter(
            User.id == user_id,
            User.id.in_(scope.user_ids),
        ).first()
        is not None
    )


# ==========================================================
# Notification List
# ==========================================================

@notification_bp.route("/")
def notification_list():
    scope = get_hospital_scope()

    scoped_q = scope.filter_notifications(Notification.query)

    notifications = (
        scoped_q.order_by(Notification.created_at.desc()).all()
    )

    total_notifications = scoped_q.count()

    unread_notifications = scoped_q.filter(
        Notification.is_read.is_(False)
    ).count()

    alert_notifications = scoped_q.filter(
        Notification.notification_type == "alert"
    ).count()

    today_notifications = scoped_q.filter(
        cast(Notification.created_at, Date) == date.today()
    ).count()

    return render_template(
        "notification/notification_list.html",
        notifications=notifications,
        total_notifications=total_notifications,
        unread_notifications=unread_notifications,
        alert_notifications=alert_notifications,
        today_notifications=today_notifications,
    )


# ==========================================================
# Add Notification
# ==========================================================

@notification_bp.route("/add", methods=["GET", "POST"])
def notification_add():
    scope = get_hospital_scope()

    if scope.unassigned:
        flash(
            "Access denied. Please contact system administrator "
            "to assign a hospital.",
            "danger",
        )
        return redirect(url_for("notification.notification_list"))

    users = _get_users(scope)

    if request.method == "POST":
        user_id = request.form.get("user_id")
        title = request.form.get("title", "").strip()
        message = request.form.get("message", "").strip()
        notification_type = request.form.get("notification_type")

        errors = []

        if not user_id:
            errors.append("Please select a user.")
        elif not _user_belongs_to_scope(scope, user_id):
            errors.append(
                "Access denied. Selected user does not belong "
                "to your hospital."
            )

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
                form_data=request.form,
            )

        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            is_read=False,
            created_at=datetime.utcnow(),
        )

        try:
            db.session.add(notification)
            db.session.commit()
        except Exception:
            db.session.rollback()
            flash("Unable to add notification. Please try again.", "danger")
            return render_template(
                "notification/notification_add.html",
                users=users,
                form_data=request.form,
            )

        flash("Notification added successfully!", "success")
        return redirect(url_for("notification.notification_list"))

    return render_template(
        "notification/notification_add.html",
        users=users,
        form_data={},
    )


# ==========================================================
# Edit Notification
# ==========================================================

@notification_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def notification_edit(id):
    scope = get_hospital_scope()
    notification = Notification.query.get_or_404(id)

    if not _can_access_notification(scope, notification):
        flash(
            "Access denied. You do not have permission "
            "to access this notification.",
            "danger",
        )
        return redirect(url_for("notification.notification_list"))

    if scope.unassigned:
        flash(
            "Access denied. Please contact system administrator "
            "to assign a hospital.",
            "danger",
        )
        return redirect(url_for("notification.notification_list"))

    users = _get_users(scope)

    if request.method == "POST":
        user_id = request.form.get("user_id")
        title = request.form.get("title", "").strip()
        message = request.form.get("message", "").strip()
        notification_type = request.form.get("notification_type")

        errors = []

        if not user_id:
            errors.append("Please select a user.")
        elif not _user_belongs_to_scope(scope, user_id):
            errors.append(
                "Access denied. Selected user does not belong "
                "to your hospital."
            )

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
                users=users,
            )

        notification.user_id = user_id
        notification.title = title
        notification.message = message
        notification.notification_type = notification_type

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            flash("Unable to update notification. Please try again.", "danger")
            return render_template(
                "notification/notification_edit.html",
                notification=notification,
                users=users,
            )

        flash("Notification updated successfully!", "success")
        return redirect(url_for("notification.notification_list"))

    return render_template(
        "notification/notification_edit.html",
        notification=notification,
        users=users,
    )


# ==========================================================
# Delete Notification
# ==========================================================

@notification_bp.route("/delete/<string:id>", methods=["POST"])
def notification_delete(id):
    scope = get_hospital_scope()
    notification = Notification.query.get_or_404(id)

    if not _can_access_notification(scope, notification):
        flash(
            "Access denied. You do not have permission "
            "to delete this notification.",
            "danger",
        )
        return redirect(url_for("notification.notification_list"))

    try:
        db.session.delete(notification)
        db.session.commit()
    except Exception:
        db.session.rollback()
        flash("Unable to delete notification. Please try again.", "danger")
        return redirect(url_for("notification.notification_list"))

    flash("Notification deleted successfully!", "success")
    return redirect(url_for("notification.notification_list"))


# ==========================================================
# Mark Notification As Read (AJAX)
# ==========================================================

@notification_bp.route("/mark-read/<string:id>", methods=["POST"])
def notification_mark_read(id):
    if "user" not in session:
        abort(401)

    session_user = session.get("user") or {}
    user_role = session_user.get("role")

    if user_role == "super_admin":
        notification = Notification.query.get_or_404(id)

    elif user_role == "admin":
        scope = get_hospital_scope()
        notification = Notification.query.get_or_404(id)

        if not _can_access_notification(scope, notification):
            abort(403)

    else:
        notification = Notification.query.filter_by(
            id=id,
            user_id=session_user.get("id"),
        ).first_or_404()

    notification.is_read = True

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "Unable to mark notification as read.",
        }), 500

    return jsonify({
        "success": True,
        "message": "Notification marked as read.",
        "id": notification.id,
    })


# ==========================================================
# Doctor Notification List
# ==========================================================

@notification_bp.route("/doctor")
def doctor_notification_list():
    if "user" not in session:
        return redirect(url_for("pages.login"))

    session_user = session.get("user") or {}

    if session_user.get("role") != "doctor":
        abort(403)

    doctor = Doctor.query.filter_by(
        user_id=session_user.get("id")
    ).first_or_404()

    notifications = (
        Notification.query
        .filter_by(user_id=session_user.get("id"))
        .order_by(Notification.created_at.desc())
        .all()
    )

    total_notifications = len(notifications)

    unread_notifications = (
        Notification.query.filter_by(
            user_id=session_user.get("id"),
            is_read=False,
        ).count()
    )

    alert_notifications = (
        Notification.query.filter_by(
            user_id=session_user.get("id"),
            notification_type="alert",
        ).count()
    )

    today_notifications = (
        Notification.query.filter(
            Notification.user_id == session_user.get("id"),
            cast(Notification.created_at, Date) == date.today(),
        ).count()
    )

    return render_template(
        "doctor/doctor_notification_list.html",
        doctor=doctor,
        notifications=notifications,
        total_notifications=total_notifications,
        unread_notifications=unread_notifications,
        alert_notifications=alert_notifications,
        today_notifications=today_notifications,
    )
