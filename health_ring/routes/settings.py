from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash
)

from database import db
from models import Setting, User


# ==========================================================
# Blueprint
# ==========================================================

settings_bp = Blueprint(
    "settings",
    __name__,
    url_prefix="/settings"
)


# ==========================================================
# Settings List
# ==========================================================

@settings_bp.route("/")
def settings_list():

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

    users = User.query.all()

    if request.method == "POST":

        setting = Setting(

            user_id=request.form["user_id"],

            theme=request.form["theme"],

            language=request.form["language"],

            email_notifications=bool(request.form.get("email_notifications")),

            sms_notifications=bool(request.form.get("sms_notifications")),

            emergency_notifications=bool(request.form.get("emergency_notifications")),

            appointment_notifications=bool(request.form.get("appointment_notifications")),

            report_notifications=bool(request.form.get("report_notifications")),

            ai_notifications=bool(request.form.get("ai_notifications")),

            battery_notifications=bool(request.form.get("battery_notifications")),

            auto_sync=bool(request.form.get("auto_sync")),

            sync_interval=request.form["sync_interval"],

            battery_alert_percentage=request.form["battery_alert_percentage"],

            two_factor_auth=bool(request.form.get("two_factor_auth")),

            login_alerts=bool(request.form.get("login_alerts")),

            share_with_doctor=bool(request.form.get("share_with_doctor")),

            share_with_family=bool(request.form.get("share_with_family")),

            timezone=request.form["timezone"]

        )

        db.session.add(setting)
        db.session.commit()

        flash("Settings added successfully.", "success")

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

    users = User.query.all()

    if request.method == "POST":

        setting.user_id = request.form["user_id"]

        setting.theme = request.form["theme"]

        setting.language = request.form["language"]

        setting.email_notifications = bool(request.form.get("email_notifications"))

        setting.sms_notifications = bool(request.form.get("sms_notifications"))

        setting.emergency_notifications = bool(request.form.get("emergency_notifications"))

        setting.appointment_notifications = bool(request.form.get("appointment_notifications"))

        setting.report_notifications = bool(request.form.get("report_notifications"))

        setting.ai_notifications = bool(request.form.get("ai_notifications"))

        setting.battery_notifications = bool(request.form.get("battery_notifications"))

        setting.auto_sync = bool(request.form.get("auto_sync"))

        setting.sync_interval = request.form["sync_interval"]

        setting.battery_alert_percentage = request.form["battery_alert_percentage"]

        setting.two_factor_auth = bool(request.form.get("two_factor_auth"))

        setting.login_alerts = bool(request.form.get("login_alerts"))

        setting.share_with_doctor = bool(request.form.get("share_with_doctor"))

        setting.share_with_family = bool(request.form.get("share_with_family"))

        setting.timezone = request.form["timezone"]

        db.session.commit()

        flash("Settings updated successfully.", "success")

        return redirect(
            url_for("settings.settings_list")
        )

    return render_template(
        "settings/edit_setting.html",
        setting=setting,
        users=users
    )


# ==========================================================
# Delete Settings
# ==========================================================

@settings_bp.route("/delete/<string:id>", methods=["POST"])
def delete_setting(id):

    setting = Setting.query.get_or_404(id)

    db.session.delete(setting)

    db.session.commit()

    flash("Settings deleted successfully.", "success")

    return redirect(
        url_for("settings.settings_list")
    )