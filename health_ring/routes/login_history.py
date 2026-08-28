from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash
)

from database import db
from models import LoginHistory, User

login_history_bp = Blueprint(
    "login_history",
    __name__,
    url_prefix="/login-history"
)


# ==========================================================
# Login History List
# ==========================================================
@login_history_bp.route("/")
def login_history_list():

    histories = LoginHistory.query.order_by(
        LoginHistory.login_time.desc()
    ).all()

    return render_template(
        "login_history/login_history_list.html",
        histories=histories
    )


# ==========================================================
# Add Login History
# ==========================================================
@login_history_bp.route("/add", methods=["GET", "POST"])
def add_login_history():

    users = User.query.all()

    if request.method == "POST":

        history = LoginHistory(
            user_id=request.form["user_id"],
            ip_address=request.form["ip_address"],
            device_name=request.form["device_name"],
            browser=request.form["browser"],
            operating_system=request.form["operating_system"],
            login_status=request.form["login_status"]
        )

        db.session.add(history)
        db.session.commit()

        flash(
            "Login history added successfully!",
            "success"
        )

        return redirect(
            url_for("login_history.login_history_list")
        )

    return render_template(
        "login_history/add_login_history.html",
        users=users
    )


# ==========================================================
# Edit Login History
# ==========================================================
@login_history_bp.route("/edit/<int:id>", methods=["GET", "POST"])
def edit_login_history(id):

    history = LoginHistory.query.get_or_404(id)

    users = User.query.all()

    if request.method == "POST":

        history.user_id = request.form["user_id"]
        history.ip_address = request.form["ip_address"]
        history.device_name = request.form["device_name"]
        history.browser = request.form["browser"]
        history.operating_system = request.form["operating_system"]
        history.login_status = request.form["login_status"]

        db.session.commit()

        flash(
            "Login history updated successfully!",
            "success"
        )

        return redirect(
            url_for("login_history.login_history_list")
        )

    return render_template(
        "login_history/edit_login_history.html",
        history=history,
        users=users
    )


# ==========================================================
# Delete Login History
# ==========================================================
@login_history_bp.route("/delete/<int:id>", methods=["POST"])
def delete_login_history(id):

    history = LoginHistory.query.get_or_404(id)

    db.session.delete(history)
    db.session.commit()

    flash(
        "Login history deleted successfully!",
        "success"
    )

    return redirect(
        url_for("login_history.login_history_list")
    )