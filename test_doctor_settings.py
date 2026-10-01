from app import app
from models import Doctor, Setting
app.config["TESTING"] = True
app.config["WTF_CSRF_ENABLED"] = False
with app.app_context():
    doctor = Doctor.query.first()
    client = app.test_client()
    with client.session_transaction() as session:
        session["user_id"] = doctor.user_id
        session["role"] = "doctor"
    response = client.get("/doctor/settings")
    print("Status:", response.status_code)
    print("Content-Type:", response.content_type)
    print(
        "Settings created:",
        Setting.query.filter_by(user_id=doctor.user_id).count()
    )
