from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash
)

from database import db
from models import RingSyncLog, HealthRing, Patient


# ==========================================================
# Blueprint
# ==========================================================

ring_sync_log_bp = Blueprint(
    "ring_sync_log",
    __name__,
    url_prefix="/ring-sync-log"
)


# ==========================================================
# Ring Sync Log List
# ==========================================================

@ring_sync_log_bp.route("/")
def ring_sync_log_list():

    logs = RingSyncLog.query.order_by(
        RingSyncLog.created_at.desc()
    ).all()

    return render_template(
        "ring_sync_log/ring_sync_log_list.html",
        logs=logs
    )


# ==========================================================
# Add Ring Sync Log
# ==========================================================

@ring_sync_log_bp.route("/add", methods=["GET", "POST"])
def add_ring_sync_log():

    rings = HealthRing.query.all()
    patients = Patient.query.all()

    if request.method == "POST":

        log = RingSyncLog(

            ring_id=request.form["ring_id"],

            patient_id=request.form["patient_id"],

            sync_start=request.form["sync_start"],

            sync_end=request.form["sync_end"],

            records_uploaded=request.form["records_uploaded"],

            battery_level=request.form["battery_level"],

            sync_status=request.form["sync_status"],

            error_message=request.form["error_message"]

        )

        db.session.add(log)
        db.session.commit()

        flash(
            "Ring Sync Log added successfully.",
            "success"
        )

        return redirect(
            url_for("ring_sync_log.ring_sync_log_list")
        )

    return render_template(
        "ring_sync_log/add_ring_sync_log.html",
        rings=rings,
        patients=patients
    )


# ==========================================================
# Edit Ring Sync Log
# ==========================================================

@ring_sync_log_bp.route("/edit/<int:id>", methods=["GET", "POST"])
def edit_ring_sync_log(id):

    log = RingSyncLog.query.get_or_404(id)

    rings = HealthRing.query.all()
    patients = Patient.query.all()

    if request.method == "POST":

        log.ring_id = request.form["ring_id"]

        log.patient_id = request.form["patient_id"]

        log.sync_start = request.form["sync_start"]

        log.sync_end = request.form["sync_end"]

        log.records_uploaded = request.form["records_uploaded"]

        log.battery_level = request.form["battery_level"]

        log.sync_status = request.form["sync_status"]

        log.error_message = request.form["error_message"]

        db.session.commit()

        flash(
            "Ring Sync Log updated successfully.",
            "success"
        )

        return redirect(
            url_for("ring_sync_log.ring_sync_log_list")
        )

    return render_template(
        "ring_sync_log/edit_ring_sync_log.html",
        log=log,
        rings=rings,
        patients=patients
    )


# ==========================================================
# Delete Ring Sync Log
# ==========================================================

@ring_sync_log_bp.route("/delete/<int:id>", methods=["POST"])
def delete_ring_sync_log(id):

    log = RingSyncLog.query.get_or_404(id)

    db.session.delete(log)
    db.session.commit()

    flash(
        "Ring Sync Log deleted successfully.",
        "success"
    )

    return redirect(
        url_for("ring_sync_log.ring_sync_log_list")
    )