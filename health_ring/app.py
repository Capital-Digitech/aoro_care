from flask import Flask, request
from flask_wtf.csrf import CSRFError

from config import Config
from database import init_db
from routes.pages import pages_bp
from routes.auth import auth_api
from routes.hospital import hospital_bp
from routes.doctor import doctor_bp
from routes.patient import patient_bp
from routes.family import family_bp
from routes.health_ring import health_ring_bp
from routes.health_data import health_data_bp
from routes.appointment import appointment_bp
from routes.emergency_alert import emergency_alert_bp
from routes.report import report_bp
from routes.notification import notification_bp
from routes.ai_insight import ai_insight_bp
from routes.login_history import login_history_bp
from routes.audit_log import audit_log_bp
from routes.subscription import subscription_bp
from routes.settings import settings_bp
from routes.ring_sync_log import ring_sync_log_bp
from routes.prescription import prescription_bp




def create_app():

    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize extensions (db, mail, csrf)
    init_db(app)

    # Register Blueprints
    app.register_blueprint(pages_bp)
    app.register_blueprint(auth_api)
    app.register_blueprint(hospital_bp)
    app.register_blueprint(doctor_bp)
    app.register_blueprint(patient_bp)
    app.register_blueprint(family_bp)
    app.register_blueprint(health_ring_bp)
    app.register_blueprint(health_data_bp)
    app.register_blueprint(appointment_bp)
    app.register_blueprint(emergency_alert_bp)
    app.register_blueprint(report_bp)
    app.register_blueprint(notification_bp)
    app.register_blueprint(ai_insight_bp)
    app.register_blueprint(login_history_bp)
    app.register_blueprint(audit_log_bp)
    app.register_blueprint(subscription_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(ring_sync_log_bp)
    app.register_blueprint(prescription_bp)
    

    @app.before_request
    def debug_request():
        if request.method == "POST":
            print("\n========== POST DATA ==========")
            print(request.form)
            print("===============================\n")

    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        print("\n========== CSRF ERROR ==========")
        print("Reason :", e.description)
        print("Form   :", request.form)
        print("Headers:", request.headers)
        print("Cookies:", request.cookies)
        print("================================\n")

        return e.description, 400

    return app


app = create_app()

print("\n========== URL MAP ==========")
print(app.url_map)
print("=============================\n")


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=app.config["DEBUG"])