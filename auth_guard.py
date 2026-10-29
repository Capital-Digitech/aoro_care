"""
Authentication and Role-Based Access Control Guard for Aoro Care.
Ensures direct URL access protection and preserves role permissions across all portals.
"""
from flask import request, session, redirect, url_for, flash, jsonify
from database import db
from models import User


# ==========================================================
# ENDPOINT PERMISSION CATEGORIES
# ==========================================================

PUBLIC_ENDPOINTS = {
    "static",
    "pages.index",
    "pages.login",
    "pages.create_account",
    "pages.forgot_password",
    "auth_api.logout",
    "auth_api.login",
    "auth_api.validate_role",
    "auth_api.validate_personal",
    "auth_api.check_email",
    "auth_api.register_submit",
    "auth_api.register_verify_otp",
    "auth_api.register_resend_otp",
    "auth_api.forgot_password_send_otp",
    "auth_api.forgot_password_verify_otp",
    "auth_api.forgot_password_reset",
    "pages.admin_activate",
    "doctor.doctor_activate",
}

SUPER_ADMIN_ONLY = {
    "pages.super_admin_dashboard",
    "pages.admin_management",
    "pages.admin_management_add",
    "pages.admin_management_view",
    "pages.admin_management_edit",
    "pages.admin_management_delete",
    "pages.assign_admin_hospital",
    "audit_log.audit_log_list",
    "login_history.login_history_list",
    "login_history.add_login_history",
    "login_history.edit_login_history",
    "login_history.delete_login_history",
    "ring_sync_log.ring_sync_log_list",
    "ring_sync_log.add_ring_sync_log",
    "ring_sync_log.edit_ring_sync_log",
    "ring_sync_log.delete_ring_sync_log",
    "subscription.subscription_list",
    "subscription.add_subscription",
    "subscription.edit_subscription",
    "subscription.delete_subscription",
    "settings.settings_list",
    "settings.add_setting",
    "settings.edit_setting",
    "settings.delete_setting",
    "hospital.hospital_add",
    "hospital.hospital_delete",
}

ADMIN_OR_SUPER_ADMIN = {
    "pages.admin_dashboard",
    "pages.admin_global_search",
    "pages.admin_my_profile",
    "pages.admin_edit_my_profile",
    "hospital.hospital_list",
    "hospital.hospital_edit",
    "doctor.doctor_list",
    "doctor.doctor_add",
    "doctor.doctor_edit",
    "doctor.doctor_delete",
    "patient.patient_list",
    "patient.patient_add",
    "patient.edit_patient",
    "patient.patient_view",
    "patient.patient_delete",
    "family.family_list",
    "family.family_add",
    "family.family_edit",
    "family.family_delete",
    "health_ring.ring_list",
    "health_ring.ring_add",
    "health_ring.ring_edit",
    "health_ring.ring_delete",
    "health_data.health_data_list",
    "health_data.health_data_add",
    "health_data.health_data_edit",
    "health_data.health_data_delete",
    "appointment.appointment_list",
    "appointment.appointment_add",
    "appointment.appointment_edit",
    "appointment.appointment_view",
    "appointment.appointment_delete",
    "appointment.appointment_export",
    "emergency_alert.emergency_list",
    "emergency_alert.alert_add",
    "emergency_alert.alert_edit",
    "emergency_alert.alert_delete",
    "report.report_list",
    "report.report_add",
    "report.report_edit",
    "report.report_delete",
    "notification.notification_list",
    "notification.notification_add",
    "notification.notification_edit",
    "notification.notification_delete",
    "notification.notification_mark_read",
    "ai_insight.ai_insight_list",
    "ai_insight.edit_ai_insight",
    "ai_insight.delete_ai_insight",
    "ai_insight.view_ai_insight",
    "prescription.prescription_list",
    "prescription.prescription_add",
    "prescription.prescription_edit",
    "prescription.prescription_delete",
    "settings.system_settings",
    "settings.update_system_settings",
    "settings.reset_system_settings",
}

PATIENT_ONLY = {
    "pages.patient_dashboard",
    "patient.dashboard",
    "pages.my_health",
    "pages.download_health_record",
    "pages.health_ring",
    "pages.health_ring_sync",
    "pages.patient_appointments",
    "pages.patient_book_appointment",
    "pages.patient_cancel_appointment",
    "pages.medical_reports",
    "pages.view_medical_report",
    "pages.prescriptions",
    "pages.health_trends",
    "pages.emergency_sos",
    "pages.emergency_sos_trigger",
    "pages.emergency_sos_resolve",
    "pages.ai_health_insights",
    "pages.ai_health_insights_data",
    "pages.notifications",
    "pages.patient_notification_mark_read",
    "pages.patient_notifications_mark_all_read",
    "pages.patient_my_profile",
    "pages.patient_edit_my_profile",
    "pages.settings",
    "pages.patient_update_profile",
    "pages.patient_change_password",
    "pages.patient_update_preferences",
    "pages.patient_global_search",
    "message.patient_messages",
    "message.patient_api_conversations",
    "message.patient_api_thread",
    "message.patient_api_send",
}

FAMILY_ONLY = {
    "pages.family_dashboard",
    "pages.family_trigger_sos",
    "pages.family_global_search",
    "family.family_linked_patients",
    "family.family_live_monitoring",
    "family.family_health_ring",
    "family.family_health_ring_details",
    "family.family_appointments",
    "family.family_appointment_detail",
    "family.family_medical_reports",
    "family.family_emergency_alerts",
    "family.family_emergency_alert_detail",
    "family.family_doctors",
    "family.family_doctor_detail",
    "family.family_ai_health_insights",
    "family.family_ai_health_insights_data",
    "family.family_notifications",
    "family.family_settings",
    "family.family_change_password",
}

DOCTOR_ONLY = {
    "pages.doctor_dashboard",
    "pages.doctor_my_patients",
    "pages.doctor_ai_health_insights",
    "pages.doctor_ai_health_insights_data",
    "pages.doctor_global_search",
    "doctor.doctor_my_profile",
    "doctor.doctor_edit_my_profile",
    "doctor.doctor_settings",
    "doctor.doctor_change_password",
    "health_data.doctor_live_monitoring",
    "health_ring.doctor_health_ring_list",
    "appointment.doctor_appointment_list",
    "appointment.doctor_appointment_detail",
    "appointment.doctor_appointment_edit",
    "appointment.doctor_appointment_confirm",
    "appointment.doctor_appointment_reject",
    "appointment.doctor_appointment_delete",
    "emergency_alert.doctor_emergency_alert_list",
    "report.doctor_report_list",
    "prescription.doctor_prescription_list",
    "prescription.doctor_prescription_add",
    "prescription.doctor_prescription_edit",
    "prescription.doctor_prescription_history",
    "notification.doctor_notification_list",
    "message.doctor_messages",
    "message.api_conversations",
    "message.api_thread",
    "message.api_send",
}

ANY_AUTH = {
    "pages.dashboard",
    "pages.global_search",
    "settings.my_settings",
    "settings.change_password",
}


# ==========================================================
# HELPERS
# ==========================================================

def _is_api_request():
    """Detect if the current request is an API, AJAX, or JSON request."""
    if request.path.startswith("/api/"):
        return True
    if request.path.endswith("/data") or request.path.endswith("-search"):
        return True
    if request.is_json:
        return True
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        return True
    accept = request.headers.get("Accept", "")
    if "application/json" in accept and "text/html" not in accept:
        return True
    return False


def _dashboard_for_role(role):
    """Return the primary dashboard URL for a given role."""
    mapping = {
        "super_admin": "pages.super_admin_dashboard",
        "admin": "pages.admin_dashboard",
        "patient": "pages.patient_dashboard",
        "family": "pages.family_dashboard",
        "doctor": "pages.doctor_dashboard",
    }
    endpoint = mapping.get(role, "pages.dashboard")
    return url_for(endpoint)


# ==========================================================
# MAIN ACCESS CONTROL HOOK
# ==========================================================

def enforce_access_control():
    """
    Runs before every request.
    Verifies authentication and enforces role permissions for all portals:
    Super Admin, Admin, Patient, Family, Doctor.
    """
    endpoint = request.endpoint

    # 1. If no endpoint matched (e.g. 404), allow Flask to handle it.
    if not endpoint:
        return None

    # 2. Public endpoints & static files are always accessible.
    if endpoint in PUBLIC_ENDPOINTS or endpoint.startswith("static"):
        return None

    # 3. Check for active login session
    session_user = session.get("user")
    role = session.get("role")
    if not role and isinstance(session_user, dict):
        role = session_user.get("role")

    user_id = session.get("user_id")
    if not user_id and isinstance(session_user, dict):
        user_id = session_user.get("id")

    # If unauthenticated: block direct URL access and redirect to login
    if not user_id or not session_user:
        if _is_api_request():
            return jsonify({
                "success": False,
                "error": "Unauthorized",
                "message": "Please log in to continue."
            }), 401
        flash("Please log in to continue.", "warning")
        return redirect(url_for("pages.login"))

    # 4. Verify user exists in database
    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        if _is_api_request():
            return jsonify({
                "success": False,
                "error": "Unauthorized",
                "message": "User account no longer exists."
            }), 401
        flash("Your account could not be found. Please log in again.", "warning")
        return redirect(url_for("pages.login"))

    user_role = (user.role or role or "").lower()

    # 5. Role-based permission checks

    # Super Admin Only
    if endpoint in SUPER_ADMIN_ONLY:
        if user_role != "super_admin":
            if _is_api_request():
                return jsonify({
                    "success": False,
                    "error": "Forbidden",
                    "message": "Super Administrator access required."
                }), 403
            flash("Access restricted. Super Administrator role required.", "warning")
            return redirect(_dashboard_for_role(user_role))

    # Admin or Super Admin
    elif endpoint in ADMIN_OR_SUPER_ADMIN:
        if user_role not in ("admin", "super_admin"):
            if _is_api_request():
                return jsonify({
                    "success": False,
                    "error": "Forbidden",
                    "message": "Administrator access required."
                }), 403
            flash("Access restricted. Administrator role required.", "warning")
            return redirect(_dashboard_for_role(user_role))

    # Patient Only
    elif endpoint in PATIENT_ONLY:
        if user_role != "patient":
            if _is_api_request():
                return jsonify({
                    "success": False,
                    "error": "Forbidden",
                    "message": "Patient access required."
                }), 403
            flash("Access restricted. Patient access required.", "warning")
            return redirect(_dashboard_for_role(user_role))

    # Family Only
    elif endpoint in FAMILY_ONLY:
        if user_role != "family":
            if _is_api_request():
                return jsonify({
                    "success": False,
                    "error": "Forbidden",
                    "message": "Family member access required."
                }), 403
            flash("Access restricted. Family access required.", "warning")
            return redirect(_dashboard_for_role(user_role))

    # Doctor Only
    elif endpoint in DOCTOR_ONLY:
        if user_role != "doctor":
            if _is_api_request():
                return jsonify({
                    "success": False,
                    "error": "Forbidden",
                    "message": "Doctor access required."
                }), 403
            flash("Access restricted. Doctor access required.", "warning")
            return redirect(_dashboard_for_role(user_role))

    # Any Authenticated
    elif endpoint in ANY_AUTH:
        return None

    # Defense in depth: any other unknown route requires authentication (already verified above)
    return None
