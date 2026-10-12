"""
Checks WHO a patient may message / see, using a throw-away in-memory
SQLite database. It never touches the real (.env) database.

Run from the project root:
    python -m unittest tests.test_patient_messages_rules -v
"""

import os
import unittest

os.environ.setdefault("SECRET_KEY", "test-secret")

from flask import Flask

from database import db
from models import (
    User, Doctor, Patient, FamilyMember, PatientFamily
)
from routes.message import message_bp, Message


def make_user(role, first, email):
    u = User(
        role=role, first_name=first, last_name="T",
        email=email, password_hash="x"
    )
    db.session.add(u)
    db.session.flush()
    return u


class PatientMessageRules(unittest.TestCase):

    def setUp(self):
        app = Flask(__name__)
        app.config.update(
            SECRET_KEY="t",
            SQLALCHEMY_DATABASE_URI="sqlite://",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
        )
        db.init_app(app)
        app.register_blueprint(message_bp)

        self.app = app
        self.ctx = app.app_context()
        self.ctx.push()
        db.create_all()

        # two doctors
        self.du_a = make_user("doctor", "DocA", "da@x.com")
        self.du_b = make_user("doctor", "DocB", "db@x.com")
        self.doc_a = Doctor(user_id=self.du_a.id, status="active")
        self.doc_b = Doctor(user_id=self.du_b.id, status="active")
        db.session.add_all([self.doc_a, self.doc_b])
        db.session.flush()

        # patient 1 -> doctor A, patient 2 -> doctor B
        self.pu1 = make_user("patient", "Pat1", "p1@x.com")
        self.pu2 = make_user("patient", "Pat2", "p2@x.com")
        self.pat1 = Patient(user_id=self.pu1.id, patient_code="P1",
                            assigned_doctor_id=self.doc_a.id, status="active")
        self.pat2 = Patient(user_id=self.pu2.id, patient_code="P2",
                            assigned_doctor_id=self.doc_b.id, status="active")
        db.session.add_all([self.pat1, self.pat2])
        db.session.flush()

        # family: f1 linked to patient 1, f2 linked to patient 2
        self.fu1 = make_user("family", "Fam1", "f1@x.com")
        self.fu2 = make_user("family", "Fam2", "f2@x.com")
        self.fam1 = FamilyMember(user_id=self.fu1.id, relationship="Father")
        self.fam2 = FamilyMember(user_id=self.fu2.id, relationship="Mother")
        db.session.add_all([self.fam1, self.fam2])
        db.session.flush()
        db.session.add_all([
            PatientFamily(patient_id=self.pat1.id, family_member_id=self.fam1.id),
            PatientFamily(patient_id=self.pat2.id, family_member_id=self.fam2.id),
        ])
        db.session.commit()

        self.client = app.test_client()
        with self.client.session_transaction() as s:
            s["user_id"] = self.pu1.id
            s["role"] = "patient"

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def send(self, to, body="hi"):
        return self.client.post(
            "/message/patient/api/send",
            json={"recipient_id": to, "body": body}
        )

    # ---- who the patient can message ----

    def test_can_message_assigned_doctor_and_own_family(self):
        self.assertEqual(self.send(self.du_a.id).status_code, 200)
        self.assertEqual(self.send(self.fu1.id).status_code, 200)

    def test_cannot_message_other_doctor_other_family_other_patient(self):
        self.assertEqual(self.send(self.du_b.id).status_code, 403)
        self.assertEqual(self.send(self.fu2.id).status_code, 403)
        self.assertEqual(self.send(self.pu2.id).status_code, 403)

    def test_unassigned_patient_has_only_family(self):
        self.pat1.assigned_doctor_id = None
        db.session.commit()
        self.assertEqual(self.send(self.du_a.id).status_code, 403)
        self.assertEqual(self.send(self.fu1.id).status_code, 200)

    def test_inactive_doctor_not_messageable(self):
        self.doc_a.status = "inactive"
        db.session.commit()
        self.assertEqual(self.send(self.du_a.id).status_code, 403)

    # ---- what the patient can see ----

    def test_cannot_read_thread_with_stranger(self):
        db.session.add(Message(sender_id=self.du_b.id,
                               recipient_id=self.pu1.id, body="leak?"))
        db.session.commit()
        r = self.client.get(f"/message/patient/api/thread/{self.du_b.id}")
        self.assertEqual(r.status_code, 403)

    def test_conversation_list_hides_strangers(self):
        db.session.add_all([
            Message(sender_id=self.du_a.id, recipient_id=self.pu1.id, body="ok"),
            Message(sender_id=self.du_b.id, recipient_id=self.pu1.id, body="no"),
        ])
        db.session.commit()
        data = self.client.get("/message/patient/api/conversations").get_json()
        ids = {c["user_id"] for c in data["conversations"]}
        self.assertEqual(ids, {self.du_a.id})
        self.assertEqual(data["unread_total"], 1)

    # ---- read / unread ----

    def test_read_status_flow(self):
        sent = self.send(self.du_a.id, "hello").get_json()["message"]
        self.assertFalse(sent["read"])

        # doctor-side read is simulated directly
        Message.query.filter_by(id=sent["id"]).update({"is_read": True})
        db.session.commit()

        r = self.client.get(f"/message/patient/api/thread/{self.du_a.id}").get_json()
        self.assertIn(sent["id"], r["read_ids"])

    def test_opening_thread_marks_incoming_read(self):
        db.session.add(Message(sender_id=self.du_a.id,
                               recipient_id=self.pu1.id, body="ping"))
        db.session.commit()
        self.assertEqual(
            self.client.get("/message/patient/api/conversations").get_json()["unread_total"], 1)
        self.client.get(f"/message/patient/api/thread/{self.du_a.id}")
        self.assertEqual(
            self.client.get("/message/patient/api/conversations").get_json()["unread_total"], 0)

    def test_requires_patient_login(self):
        anon = self.app.test_client()
        self.assertEqual(anon.get("/message/patient/api/conversations").status_code, 401)


if __name__ == "__main__":
    unittest.main()
