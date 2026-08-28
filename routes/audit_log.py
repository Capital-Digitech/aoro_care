from flask import Blueprint, render_template

from models import AuditLog

audit_log_bp = Blueprint(
    "audit_log",
    __name__,
    url_prefix="/audit-log"
)


# ==========================================================
# Audit Log List
# ==========================================================

@audit_log_bp.route("/")
def audit_log_list():

    logs = AuditLog.query.order_by(
        AuditLog.created_at.desc()
    ).all()

    return render_template(
        "audit_log/audit_log_list.html",
        logs=logs
    )