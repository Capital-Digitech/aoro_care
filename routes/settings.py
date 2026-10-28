from functools import wraps
import re
import uuid

from flask import (
    Blueprint, render_template, request, redirect,
    url_for, flash, session, g
)
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from database import db
from models import LoginHistory, Setting, SystemSettings, User


# ==========================================================
# Blueprint
# ==========================================================

settings_bp = Blueprint(
    "settings",
    __name__,
    url_prefix="/settings"
)


# ==========================================================
# Option lists (same values the Patient / Doctor portals use)
# ==========================================================

LANGUAGES = ["English", "Tamil", "Hindi", "Malayalam", "Telugu", "Kannada"]

TIMEZONES = [
    ("Asia/Kolkata", "India Standard Time (Asia/Kolkata)"),
    ("Asia/Dubai", "Gulf Standard Time (Asia/Dubai)"),
    ("Asia/Singapore", "Singapore Time (Asia/Singapore)"),
    ("Europe/London", "UK Time (Europe/London)"),
    ("America/New_York", "US Eastern (America/New_York)"),
    ("America/Los_Angeles", "US Pacific (America/Los_Angeles)"),
    ("Australia/Sydney", "Australia Eastern (Australia/Sydney)"),
    ("UTC", "Coordinated Universal Time (UTC)"),
]

SYNC_INTERVALS = [5, 15, 30, 60]
BATTERY_MIN = 5
BATTERY_MAX = 50
PER_PAGE = 10

# (field, title, description)
NOTIFICATION_ITEMS = [
    ("emergency_notifications", "Emergency alerts",
     "Critical alerts raised by patients' health rings."),
    ("appointment_notifications", "Appointment notifications",
     "New bookings, cancellations and reminders."),
    ("report_notifications", "Report notifications",
     "When a medical report becomes available."),
    ("ai_notifications", "AI health insight notifications",
     "When new AI insights are available."),
    ("email_notifications", "Email notifications",
     "Receive notifications at the account email address."),
    ("sms_notifications", "SMS notifications",
     "Receive notifications on the registered mobile number."),
]

# Per-user form (Super Admin) also manages the ring battery alert.
USER_NOTIFICATION_ITEMS = NOTIFICATION_ITEMS + [
    ("battery_notifications", "Battery alerts",
     "Health ring low-battery notifications."),
]

NOTIFICATION_FIELDS = tuple(f for f, _, _ in NOTIFICATION_ITEMS)
USER_NOTIFICATION_FIELDS = tuple(f for f, _, _ in USER_NOTIFICATION_ITEMS)

# Same defaults the Reset buttons in every portal use.
NOTIFICATION_RESET_VALUES = {
    "email_notifications": True,
    "sms_notifications": False,
    "emergency_notifications": True,
    "appointment_notifications": True,
    "report_notifications": True,
    "ai_notifications": True,
}

SYSTEM_NOTIFICATION_ITEMS = [
    ("email_notifications_enabled", "Email notifications",
     "Allow email notifications across the platform."),
    ("sms_notifications_enabled", "SMS notifications",
     "Allow SMS notifications across the platform."),
    ("emergency_notifications_enabled", "Emergency notifications",
     "Allow emergency alert notifications."),
    ("appointment_notifications_enabled", "Appointment notifications",
     "Allow appointment-related notifications."),
    ("report_notifications_enabled", "Report notifications",
     "Allow medical report notifications."),
    ("ai_notifications_enabled", "AI notifications",
     "Allow AI health insight notifications."),
]

SYSTEM_DEFAULTS = {
    "default_language": "English",
    "default_timezone": "Asia/Kolkata",
    "email_notifications_enabled": True,
    "sms_notifications_enabled": True,
    "emergency_notifications_enabled": True,
    "appointment_notifications_enabled": True,
    "report_notifications_enabled": True,
    "ai_notifications_enabled": True,
    "ring_auto_sync": True,
    "ring_sync_interval": 15,
    "battery_alert_percentage": 20,
}

TIMEZONE_VALUES = {value for value, _ in TIMEZONES}


# ==========================================================
# Helpers
# ==========================================================

def get_system_settings():
    """Return the single platform settings row, creating it if missing."""
    system_setting = SystemSettings.query.first()

    if not system_setting:
        system_setting = SystemSettings(id=str(uuid.uuid4()))
        db.session.add(system_setting)
        db.session.commit()

    return system_setting


def get_or_create_user_setting(user_id):
    """Return a user's Setting row; new rows start from the platform defaults."""
    setting = Setting.query.filter_by(user_id=user_id).first()

    if setting:
        return setting

    system = get_system_settings()

    setting = Setting(
        id=str(uuid.uuid4()),
        user_id=user_id,
        language=system.default_language or "English",
        timezone=system.default_timezone or "Asia/Kolkata",
        auto_sync=(
            True if system.ring_auto_sync is None
            else bool(system.ring_auto_sync)
        ),
        sync_interval=system.ring_sync_interval or 15,
        battery_alert_percentage=system.battery_alert_percentage or 20,
    )

    db.session.add(setting)

    try:
        db.session.commit()
    except IntegrityError:
        # Another request created the row first (user_id is unique).
        db.session.rollback()
        setting = Setting.query.filter_by(user_id=user_id).first()

    return setting


def _current_user():
    user_id = session.get("user_id")
    role = session.get("role")

    if not user_id or role not in ("admin", "super_admin"):
        return None

    user = db.session.get(User, user_id)

    if not user or user.role != role:
        return None

    return user


def admin_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        user = _current_user()

        if not user:
            flash("Please sign in with an administrator account.", "warning")
            return redirect(url_for("pages.login"))

        g.settings_user = user
        return view(*args, **kwargs)

    return wrapper


def super_admin_required(view):
    @wraps(view)
    @admin_required
    def wrapper(*args, **kwargs):
        if g.settings_user.role != "super_admin":
            flash(
                "Only a Super Administrator can access that page.",
                "warning"
            )
            return redirect(url_for("settings.settings_list"))

        return view(*args, **kwargs)

    return wrapper


def _render(template, active_tab, **context):
    user = g.settings_user
    is_super = user.role == "super_admin"

    own = Setting.query.filter_by(user_id=user.id).first()

    return render_template(
        template,
        active_tab=active_tab,
        current_user=user,
        is_super_admin=is_super,
        theme_key="hr-theme" if is_super else "hr-admin-theme",
        saved_theme=(own.theme if own and own.theme else "light"),
        languages=LANGUAGES,
        timezones=TIMEZONES,
        sync_intervals=SYNC_INTERVALS,
        battery_min=BATTERY_MIN,
        battery_max=BATTERY_MAX,
        **context
    )


def _validate_new_password(password):
    """Same strength rules as account registration."""
    if len(password) < 8:
        return "New password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return "New password must include an uppercase letter."
    if not re.search(r"[a-z]", password):
        return "New password must include a lowercase letter."
    if not re.search(r"\d", password):
        return "New password must include a number."
    return None


def _parse_int(value, default):
    if value is None or str(value).strip() == "":
        return default

    return int(str(value).strip())


def _read_user_preferences(form, current=None):
    """Validate the per-user preference fields.

    Returns (values, error). Values already stored on the record are
    accepted even if they are no longer in the option lists.
    """
    theme = form.get("theme") or "light"
    language = form.get("language") or "English"
    timezone = form.get("timezone") or "Asia/Kolkata"

    valid_languages = set(LANGUAGES)
    valid_timezones = set(TIMEZONE_VALUES)
    valid_intervals = set(SYNC_INTERVALS)

    if current is not None:
        if current.language:
            valid_languages.add(current.language)
        if current.timezone:
            valid_timezones.add(current.timezone)
        if current.sync_interval:
            valid_intervals.add(current.sync_interval)

    try:
        interval = _parse_int(form.get("sync_interval"), 15)
        battery = _parse_int(form.get("battery_alert_percentage"), 20)
    except ValueError:
        return None, "Sync interval and battery threshold must be numbers."

    if theme not in ("light", "dark"):
        return None, "Please choose a valid theme."

    if language not in valid_languages:
        return None, "Please choose a valid language."

    if timezone not in valid_timezones:
        return None, "Please choose a valid time zone."

    if interval not in valid_intervals:
        return None, "Please choose a valid sync interval."

    if not BATTERY_MIN <= battery <= BATTERY_MAX:
        return None, (
            f"Battery alert threshold must be between "
            f"{BATTERY_MIN}% and {BATTERY_MAX}%."
        )

    values = {
        "theme": theme,
        "language": language,
        "timezone": timezone,
        "sync_interval": interval,
        "battery_alert_percentage": battery,
        "auto_sync": "auto_sync" in form,
        "two_factor_auth": "two_factor_auth" in form,
        "login_alerts": "login_alerts" in form,
        "share_with_doctor": "share_with_doctor" in form,
        "share_with_family": "share_with_family" in form,
    }

    for field in USER_NOTIFICATION_FIELDS:
        values[field] = field in form

    return values, None


# ==========================================================
# Landing page
#   Super Admin -> per-user preference records
#   Admin       -> own preferences
# ==========================================================

@settings_bp.route("/")
@admin_required
def settings_list():

    if g.settings_user.role != "super_admin":
        return redirect(url_for("settings.my_settings"))

    q = (request.args.get("q") or "").strip()
    two_fa = request.args.get("two_fa") or ""
    page = request.args.get("page", 1, type=int)

    query = Setting.query.join(User, Setting.user_id == User.id)

    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            User.first_name.ilike(like),
            User.last_name.ilike(like),
            User.email.ilike(like),
        ))

    if two_fa == "off":
        query = query.filter(Setting.two_factor_auth.is_(False))
    elif two_fa == "on":
        query = query.filter(Setting.two_factor_auth.is_(True))

    pagination = query.order_by(
        Setting.updated_at.desc()
    ).paginate(page=page, per_page=PER_PAGE, error_out=False)

    return _render(
        "settings/settings_list.html",
        "users",
        settings=pagination.items,
        pagination=pagination,
        total_records=Setting.query.count(),
        q=q,
        two_fa=two_fa,
    )


# ==========================================================
# My Preferences (Admin and Super Admin, own account)
# ==========================================================

@settings_bp.route("/me", methods=["GET", "POST"])
@admin_required
def my_settings():

    user = g.settings_user
    setting = get_or_create_user_setting(user.id)

    if request.method == "POST":

        section = request.form.get("section", "")
        back = url_for("settings.my_settings")

        if section == "preferences":
            theme = request.form.get("theme", "light")
            language = request.form.get("language", "English")
            timezone = request.form.get("timezone", "Asia/Kolkata")

            valid_languages = set(LANGUAGES) | {setting.language}
            valid_timezones = set(TIMEZONE_VALUES) | {setting.timezone}

            if (
                theme not in ("light", "dark")
                or language not in valid_languages
                or timezone not in valid_timezones
            ):
                flash("Please choose valid preference options.", "danger")
                return redirect(back + "#preferences")

            setting.theme = theme
            setting.language = language
            setting.timezone = timezone
            db.session.commit()

            flash("Preferences saved successfully.", "success")
            return redirect(back + "#preferences")

        if section == "notifications":
            for field in NOTIFICATION_FIELDS:
                setattr(setting, field, field in request.form)

            db.session.commit()

            flash("Notification preferences saved successfully.", "success")
            return redirect(back + "#notifications")

        if section == "security":
            setting.login_alerts = "login_alerts" in request.form
            db.session.commit()

            flash("Security preferences saved successfully.", "success")
            return redirect(back + "#security")

        if section == "reset_preferences":
            system = get_system_settings()
            setting.theme = "light"
            setting.language = system.default_language or "English"
            setting.timezone = system.default_timezone or "Asia/Kolkata"
            db.session.commit()

            flash("Preferences reset to platform defaults.", "success")
            return redirect(back + "#preferences")

        if section == "reset_notifications":
            for field, value in NOTIFICATION_RESET_VALUES.items():
                setattr(setting, field, value)

            db.session.commit()

            flash("Notification preferences reset to defaults.", "success")
            return redirect(back + "#notifications")

        flash("Invalid request.", "danger")
        return redirect(back)

    recent_logins = (
        LoginHistory.query
        .filter_by(user_id=user.id)
        .order_by(LoginHistory.login_time.desc())
        .limit(5)
        .all()
    )

    return _render(
        "settings/my_settings.html",
        "me",
        setting=setting,
        notification_items=NOTIFICATION_ITEMS,
        recent_logins=recent_logins,
    )


@settings_bp.route("/me/password", methods=["POST"])
@admin_required
def change_password():

    user = g.settings_user
    back = url_for("settings.my_settings") + "#password"

    current_pwd = request.form.get("current_password", "")
    new_pwd = request.form.get("new_password", "")
    confirm_pwd = request.form.get("confirm_password", "")

    if not check_password_hash(user.password_hash, current_pwd):
        flash("Current password is incorrect.", "danger")
        return redirect(back)

    problem = _validate_new_password(new_pwd)

    if problem:
        flash(problem, "warning")
        return redirect(back)

    if new_pwd != confirm_pwd:
        flash("New passwords do not match.", "warning")
        return redirect(back)

    if check_password_hash(user.password_hash, new_pwd):
        flash(
            "New password must be different from the current password.",
            "warning"
        )
        return redirect(back)

    user.password_hash = generate_password_hash(new_pwd)
    db.session.commit()

    flash("Password changed successfully.", "success")
    return redirect(back)


# ==========================================================
# System Settings (Super Admin edits, Admin read-only)
# ==========================================================

@settings_bp.route("/system")
@admin_required
def system_settings():

    return _render(
        "settings/system_settings.html",
        "system",
        system_setting=get_system_settings(),
        notification_items=SYSTEM_NOTIFICATION_ITEMS,
        can_edit=(g.settings_user.role == "super_admin"),
    )


@settings_bp.route("/system/update", methods=["POST"])
@super_admin_required
def update_system_settings():

    system_setting = get_system_settings()
    back = url_for("settings.system_settings")

    language = request.form.get("default_language") or "English"
    timezone = request.form.get("default_timezone") or "Asia/Kolkata"

    valid_languages = set(LANGUAGES) | {system_setting.default_language}
    valid_timezones = set(TIMEZONE_VALUES) | {system_setting.default_timezone}
    valid_intervals = set(SYNC_INTERVALS) | {system_setting.ring_sync_interval}

    try:
        interval = _parse_int(request.form.get("ring_sync_interval"), 15)
        battery = _parse_int(
            request.form.get("battery_alert_percentage"), 20
        )
    except ValueError:
        flash("Sync interval and battery threshold must be numbers.", "danger")
        return redirect(back)

    if language not in valid_languages:
        flash("Please choose a valid default language.", "danger")
        return redirect(back)

    if timezone not in valid_timezones:
        flash("Please choose a valid default time zone.", "danger")
        return redirect(back)

    if interval not in valid_intervals:
        flash("Please choose a valid sync interval.", "danger")
        return redirect(back)

    if not BATTERY_MIN <= battery <= BATTERY_MAX:
        flash(
            f"Battery alert threshold must be between "
            f"{BATTERY_MIN}% and {BATTERY_MAX}%.",
            "danger"
        )
        return redirect(back)

    system_setting.default_language = language
    system_setting.default_timezone = timezone

    for field, _, _ in SYSTEM_NOTIFICATION_ITEMS:
        setattr(system_setting, field, field in request.form)

    system_setting.ring_auto_sync = "ring_auto_sync" in request.form
    system_setting.ring_sync_interval = interval
    system_setting.battery_alert_percentage = battery

    db.session.commit()

    flash("System settings updated successfully.", "success")
    return redirect(back)


@settings_bp.route("/system/reset", methods=["POST"])
@super_admin_required
def reset_system_settings():

    system_setting = get_system_settings()

    for field, value in SYSTEM_DEFAULTS.items():
        setattr(system_setting, field, value)

    db.session.commit()

    flash("System settings reset to defaults.", "success")
    return redirect(url_for("settings.system_settings"))


# ==========================================================
# Per-user preference records (Super Admin)
# ==========================================================

def _users_without_settings():
    return User.query.outerjoin(
        Setting, Setting.user_id == User.id
    ).filter(
        Setting.id.is_(None)
    ).order_by(
        User.first_name.asc(),
        User.last_name.asc()
    ).all()


@settings_bp.route("/add", methods=["GET", "POST"])
@super_admin_required
def add_setting():

    users = _users_without_settings()
    system = get_system_settings()

    if request.method == "POST":

        user_id = request.form.get("user_id")
        user = db.session.get(User, user_id) if user_id else None

        if not user:
            flash("Please select a user.", "danger")
            return _render(
                "settings/add_setting.html", "users",
                users=users, system_setting=system,
                notification_items=USER_NOTIFICATION_ITEMS,
                form=request.form,
            )

        # One settings record per user
        existing = Setting.query.filter_by(user_id=user.id).first()

        if existing:
            flash(
                "Settings already exist for this user. "
                "Please edit the existing record.",
                "warning"
            )
            return redirect(
                url_for("settings.edit_setting", id=existing.id)
            )

        values, error = _read_user_preferences(request.form)

        if error:
            flash(error, "danger")
            return _render(
                "settings/add_setting.html", "users",
                users=users, system_setting=system,
                notification_items=USER_NOTIFICATION_ITEMS,
                form=request.form,
            )

        setting = Setting(id=str(uuid.uuid4()), user_id=user.id, **values)
        db.session.add(setting)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            flash("Settings already exist for this user.", "warning")
            return redirect(url_for("settings.settings_list"))

        flash("Settings added successfully.", "success")
        return redirect(url_for("settings.settings_list"))

    return _render(
        "settings/add_setting.html", "users",
        users=users, system_setting=system,
        notification_items=USER_NOTIFICATION_ITEMS,
        form=None,
    )


@settings_bp.route("/edit/<string:id>", methods=["GET", "POST"])
@super_admin_required
def edit_setting(id):

    setting = Setting.query.get_or_404(id)

    if request.method == "POST":

        values, error = _read_user_preferences(request.form, current=setting)

        if error:
            flash(error, "danger")
            return _render(
                "settings/edit_setting.html", "users",
                setting=setting,
                notification_items=USER_NOTIFICATION_ITEMS,
                form=request.form,
            )

        for field, value in values.items():
            setattr(setting, field, value)

        db.session.commit()

        flash("Settings updated successfully.", "success")
        return redirect(url_for("settings.settings_list"))

    return _render(
        "settings/edit_setting.html", "users",
        setting=setting,
        notification_items=USER_NOTIFICATION_ITEMS,
        form=None,
    )


@settings_bp.route("/delete/<string:id>", methods=["POST"])
@super_admin_required
def delete_setting(id):

    setting = Setting.query.get_or_404(id)

    db.session.delete(setting)
    db.session.commit()

    flash(
        "Settings record removed. Platform defaults apply to this user again.",
        "success"
    )

    return redirect(url_for("settings.settings_list"))