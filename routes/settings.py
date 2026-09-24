from flask import Blueprint, render_template, request, redirect, url_for, flash, session

from database import db
from models import Setting, SystemSettings, User
import uuid


# ==========================================================
# Blueprint
# ==========================================================

settings_bp = Blueprint(
    "settings",
    __name__,
    url_prefix="/settings"
)

# ==========================================================
# System Settings
# ==========================================================

@settings_bp.route("/system")
def system_settings():

    system_setting = SystemSettings.query.first()

    # Create default system settings if none exists
    if not system_setting:
        system_setting = SystemSettings(
            id=str(uuid.uuid4())
        )

        db.session.add(system_setting)
        db.session.commit()

    return render_template(
        "settings/system_settings.html",
        system_setting=system_setting
    )

# ==========================================================
# Settings List
# ==========================================================

@settings_bp.route("/")
def settings_list():

    # Admin should use System Settings
    role = session.get("role")

    if role == "admin":
        return redirect(
            url_for("settings.system_settings")
        )

    settings = Setting.query.order_by(
        Setting.updated_at.desc()
    ).all()

    return render_template(
        "settings/settings_list.html",
        settings=settings
    )


# ==========================================================
# Add Settings
# ==========================================================

@settings_bp.route("/add", methods=["GET", "POST"])
def add_setting():

    users = User.query.order_by(
        User.first_name.asc(),
        User.last_name.asc()
    ).all()

    if request.method == "POST":

        user_id = request.form.get("user_id")

        if not user_id:
            flash("Please select a user.", "danger")
            return render_template(
                "settings/add_setting.html",
                users=users
            )

        # One settings record per user
        existing_setting = Setting.query.filter_by(
            user_id=user_id
        ).first()

        if existing_setting:
            flash(
                "Settings already exist for this user. Please edit the existing settings.",
                "warning"
            )
            return redirect(
                url_for(
                    "settings.edit_setting",
                    id=existing_setting.id
                )
            )

        setting = Setting(
            id=str(uuid.uuid4()),
            user_id=user_id,

            theme=request.form.get("theme") or "light",

            language=request.form.get("language") or "English",

            email_notifications=(
                request.form.get("email_notifications") == "on"
            ),

            sms_notifications=(
                request.form.get("sms_notifications") == "on"
            ),

            emergency_notifications=(
                request.form.get("emergency_notifications") == "on"
            ),

            appointment_notifications=(
                request.form.get("appointment_notifications") == "on"
            ),

            report_notifications=(
                request.form.get("report_notifications") == "on"
            ),

            ai_notifications=(
                request.form.get("ai_notifications") == "on"
            ),

            battery_notifications=(
                request.form.get("battery_notifications") == "on"
            ),

            auto_sync=(
                request.form.get("auto_sync") == "on"
            ),

            sync_interval=int(
                request.form.get("sync_interval") or 15
            ),

            battery_alert_percentage=int(
                request.form.get("battery_alert_percentage") or 20
            ),

            two_factor_auth=(
                request.form.get("two_factor_auth") == "on"
            ),

            login_alerts=(
                request.form.get("login_alerts") == "on"
            ),

            share_with_doctor=(
                request.form.get("share_with_doctor") == "on"
            ),

            share_with_family=(
                request.form.get("share_with_family") == "on"
            ),

            timezone=request.form.get("timezone") or "Asia/Kolkata"
        )

        db.session.add(setting)
        db.session.commit()

        flash(
            "Settings added successfully.",
            "success"
        )

        return redirect(
            url_for("settings.settings_list")
        )

    return render_template(
        "settings/add_setting.html",
        users=users
    )


# ==========================================================
# Edit Settings
# ==========================================================

@settings_bp.route("/edit/<string:id>", methods=["GET", "POST"])
def edit_setting(id):

    setting = Setting.query.get_or_404(id)

    users = User.query.order_by(
        User.first_name.asc(),
        User.last_name.asc()
    ).all()

    if request.method == "POST":

        user_id = request.form.get("user_id")

        if not user_id:
            flash("Please select a user.", "danger")

            return render_template(
                "settings/edit_setting.html",
                setting=setting,
                users=users
            )

        # Prevent another setting record from using same user
        duplicate_setting = Setting.query.filter(
            Setting.user_id == user_id,
            Setting.id != setting.id
        ).first()

        if duplicate_setting:
            flash(
                "Another settings profile already exists for this user.",
                "warning"
            )

            return render_template(
                "settings/edit_setting.html",
                setting=setting,
                users=users
            )

        setting.user_id = user_id

        setting.theme = (
            request.form.get("theme") or "light"
        )

        setting.language = (
            request.form.get("language") or "English"
        )

        setting.email_notifications = (
            request.form.get("email_notifications") == "on"
        )

        setting.sms_notifications = (
            request.form.get("sms_notifications") == "on"
        )

        setting.emergency_notifications = (
            request.form.get("emergency_notifications") == "on"
        )

        setting.appointment_notifications = (
            request.form.get("appointment_notifications") == "on"
        )

        setting.report_notifications = (
            request.form.get("report_notifications") == "on"
        )

        setting.ai_notifications = (
            request.form.get("ai_notifications") == "on"
        )

        setting.battery_notifications = (
            request.form.get("battery_notifications") == "on"
        )

        setting.auto_sync = (
            request.form.get("auto_sync") == "on"
        )

        setting.sync_interval = int(
            request.form.get("sync_interval") or 15
        )

        setting.battery_alert_percentage = int(
            request.form.get("battery_alert_percentage") or 20
        )

        setting.two_factor_auth = (
            request.form.get("two_factor_auth") == "on"
        )

        setting.login_alerts = (
            request.form.get("login_alerts") == "on"
        )

        setting.share_with_doctor = (
            request.form.get("share_with_doctor") == "on"
        )

        setting.share_with_family = (
            request.form.get("share_with_family") == "on"
        )

        setting.timezone = (
            request.form.get("timezone") or "Asia/Kolkata"
        )

        db.session.commit()

        flash(
            "Settings updated successfully.",
            "success"
        )

        return redirect(
            url_for("settings.settings_list")
        )

    return render_template(
        "settings/edit_setting.html",
        setting=setting,
        users=users
    )

# ==========================================================
# Update System Settings
# ==========================================================

@settings_bp.route("/system/update", methods=["POST"])
def update_system_settings():

    system_setting = SystemSettings.query.first()

    if not system_setting:
        system_setting = SystemSettings(
            id=str(uuid.uuid4())
        )

        db.session.add(system_setting)

    # ==========================
    # System Defaults
    # ==========================

    system_setting.default_language = (
        request.form.get("default_language") or "English"
    )

    system_setting.default_timezone = (
        request.form.get("default_timezone") or "Asia/Kolkata"
    )

    # ==========================
    # Notification Policies
    # ==========================

    system_setting.email_notifications_enabled = (
        request.form.get("email_notifications_enabled") == "on"
    )

    system_setting.sms_notifications_enabled = (
        request.form.get("sms_notifications_enabled") == "on"
    )

    system_setting.emergency_notifications_enabled = (
        request.form.get("emergency_notifications_enabled") == "on"
    )

    system_setting.appointment_notifications_enabled = (
        request.form.get("appointment_notifications_enabled") == "on"
    )

    system_setting.report_notifications_enabled = (
        request.form.get("report_notifications_enabled") == "on"
    )

    system_setting.ai_notifications_enabled = (
        request.form.get("ai_notifications_enabled") == "on"
    )

    # ==========================
    # HealthRing Policy
    # ==========================

    system_setting.ring_auto_sync = (
        request.form.get("ring_auto_sync") == "on"
    )

    system_setting.ring_sync_interval = int(
        request.form.get("ring_sync_interval") or 15
    )

    system_setting.battery_alert_percentage = int(
        request.form.get("battery_alert_percentage") or 20
    )

    db.session.commit()

    flash(
        "System settings updated successfully.",
        "success"
    )

    return redirect(
        url_for("settings.system_settings")
    )

# ==========================================================
# Delete Settings
# ==========================================================

@settings_bp.route("/delete/<string:id>", methods=["POST"])
def delete_setting(id):

    setting = Setting.query.get_or_404(id)

    db.session.delete(setting)
    db.session.commit()

    flash(
        "Settings deleted successfully.",
        "success"
    )

    return redirect(
        url_for("settings.settings_list")
    )