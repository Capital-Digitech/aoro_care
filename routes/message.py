from datetime import datetime

from flask import (
    Blueprint,
    render_template,
    request,
    session,
    redirect,
    url_for,
    jsonify
)

from sqlalchemy import or_, and_, inspect as sa_inspect

from database import db
from models import (
    User,
    Doctor,
    Patient,
    FamilyMember,
    PatientFamily,
    Notification,
    gen_uuid
)


message_bp = Blueprint(
    "message",
    __name__,
    url_prefix="/message"
)


MAX_MESSAGE_LENGTH = 2000
NOTIFICATION_TITLE_PREFIX = "New message from "


# ============================================================
# MESSAGE MODEL
#
# Kept in this file so the feature is self-contained.
# The table is created automatically on first use
# (see ensure_messages_table) - no manual migration needed.
# ============================================================

class Message(db.Model):

    __tablename__ = "messages"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=gen_uuid
    )

    sender_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    recipient_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    body = db.Column(
        db.Text,
        nullable=False
    )

    is_read = db.Column(
        db.Boolean,
        nullable=False,
        default=False
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        index=True
    )


_table_ready = False


def ensure_messages_table():
    """Create the messages table once per process if it does not exist."""

    global _table_ready

    if _table_ready:
        return

    try:
        Message.__table__.create(bind=db.engine, checkfirst=True)
    except Exception:
        # Another worker may have created it at the same moment.
        db.session.rollback()

        if not sa_inspect(db.engine).has_table("messages"):
            raise

    _table_ready = True


# ============================================================
# HELPERS
# ============================================================

def _display_name(user):

    full = f"{user.first_name or ''} {user.last_name or ''}".strip()

    if not full:
        full = user.email or "User"

    return f"Dr. {full}" if user.role == "doctor" else full


def _initials(user):

    first = (user.first_name or "").strip()[:1]
    last = (user.last_name or "").strip()[:1]

    return (first + last).upper() or (user.email or "U")[:1].upper()


def _iso(value):

    return value.isoformat() + "Z" if value else None


def _parse_iso(value):

    if not value:
        return None

    try:
        return datetime.fromisoformat(value.rstrip("Z"))
    except ValueError:
        return None


def _current_doctor():

    user_id = session.get("user_id")

    if not user_id or session.get("role") != "doctor":
        return None, None

    user = db.session.get(User, user_id)
    doctor = Doctor.query.filter_by(user_id=user_id).first()

    if not user or not doctor:
        return None, None

    return user, doctor


def _people_details(user_ids):
    """Short subtitle per user: specialization (doctor) / patient code."""

    details = {}

    if not user_ids:
        return details

    for doc in Doctor.query.filter(Doctor.user_id.in_(user_ids)).all():
        details[doc.user_id] = doc.specialization or "Doctor"

    for pat in Patient.query.filter(Patient.user_id.in_(user_ids)).all():
        details[pat.user_id] = pat.patient_code or "Patient"

    for fam in FamilyMember.query.filter(FamilyMember.user_id.in_(user_ids)).all():
        details[fam.user_id] = fam.relationship or "Family"

    return details


def _contacts(doctor):
    """People this doctor is allowed to start a conversation with."""

    contacts = []

    colleagues = (
        db.session.query(User)
        .join(Doctor, Doctor.user_id == User.id)
        .filter(
            Doctor.status == "active",
            User.id != doctor.user_id
        )
        .order_by(User.first_name, User.last_name)
        .all()
    )

    patients = (
        db.session.query(User)
        .join(Patient, Patient.user_id == User.id)
        .filter(
            Patient.assigned_doctor_id == doctor.id,
            Patient.status == "active"
        )
        .order_by(User.first_name, User.last_name)
        .all()
    )

    people = patients + colleagues
    details = _people_details([u.id for u in people])

    for u in people:
        contacts.append({
            "user_id": u.id,
            "name": _display_name(u),
            "role": u.role,
            "detail": details.get(u.id, ""),
            "initials": _initials(u)
        })

    return contacts


def _conversations(user_id):

    rows = (
        Message.query
        .filter(
            or_(
                Message.sender_id == user_id,
                Message.recipient_id == user_id
            )
        )
        .order_by(Message.created_at.desc())
        .limit(1000)
        .all()
    )

    convs = {}

    for m in rows:

        partner_id = (
            m.recipient_id if m.sender_id == user_id else m.sender_id
        )

        conv = convs.get(partner_id)

        if conv is None:
            conv = convs[partner_id] = {
                "user_id": partner_id,
                "last_body": m.body,
                "last_at": _iso(m.created_at),
                "last_mine": m.sender_id == user_id,
                "unread": 0
            }

        if m.recipient_id == user_id and not m.is_read:
            conv["unread"] += 1

    if not convs:
        return []

    users = {
        u.id: u
        for u in User.query.filter(User.id.in_(list(convs.keys()))).all()
    }

    details = _people_details(list(convs.keys()))

    result = []

    for partner_id, conv in convs.items():

        u = users.get(partner_id)

        if not u:
            continue

        conv.update({
            "name": _display_name(u),
            "role": u.role,
            "detail": details.get(partner_id, ""),
            "initials": _initials(u)
        })

        result.append(conv)

    result.sort(key=lambda c: c["last_at"], reverse=True)

    return result


def _unread_total(user_id):

    return Message.query.filter_by(
        recipient_id=user_id,
        is_read=False
    ).count()


def _serialize(m, me_id):

    return {
        "id": m.id,
        "body": m.body,
        "created_at": _iso(m.created_at),
        "mine": m.sender_id == me_id,
        "read": bool(m.is_read)
    }


def _has_history(user_id, other_id):

    return db.session.query(
        Message.query.filter(
            or_(
                and_(
                    Message.sender_id == user_id,
                    Message.recipient_id == other_id
                ),
                and_(
                    Message.sender_id == other_id,
                    Message.recipient_id == user_id
                )
            )
        ).exists()
    ).scalar()


def _may_message(doctor, other_id):
    """True when `other_id` is an allowed contact of this doctor."""

    return any(c["user_id"] == other_id for c in _contacts(doctor))


def _json_error(message, status):

    return jsonify({"ok": False, "error": message}), status


# ============================================================
# TOPBAR / SIDEBAR DATA FOR EVERY DOCTOR PAGE
#
# Gives the doctor templates the unread-message badge, the
# Messages dropdown and the Notifications dropdown.
# Never raises: if anything fails the pages still render.
# ============================================================

@message_bp.app_context_processor
def inject_doctor_header_data():

    defaults = {
        "hr_unread_messages": 0,
        "hr_msg_recent": [],
        "hr_notif_unread": 0,
        "hr_notif_recent": []
    }

    user_id = session.get("user_id")

    if user_id and session.get("role") == "patient":
        return _patient_header_data(user_id, defaults)

    if not user_id or session.get("role") != "doctor":
        return defaults

    try:
        ensure_messages_table()

        unread = (
            Message.query
            .filter_by(recipient_id=user_id, is_read=False)
            .order_by(Message.created_at.desc())
            .all()
        )

        grouped = {}

        for m in unread:
            g = grouped.setdefault(
                m.sender_id,
                {"sender_id": m.sender_id, "preview": m.body, "count": 0}
            )
            g["count"] += 1

        senders = {
            u.id: u
            for u in User.query.filter(
                User.id.in_(list(grouped.keys()))
            ).all()
        } if grouped else {}

        recent = []

        for g in list(grouped.values())[:4]:
            sender = senders.get(g["sender_id"])
            preview = g["preview"].replace("\n", " ")
            recent.append({
                "sender_id": g["sender_id"],
                "name": _display_name(sender) if sender else "User",
                "preview": preview[:60] + ("…" if len(preview) > 60 else ""),
                "count": g["count"]
            })

        notif_query = Notification.query.filter_by(
            user_id=user_id,
            is_read=False
        )

        return {
            "hr_unread_messages": len(unread),
            "hr_msg_recent": recent,
            "hr_notif_unread": notif_query.count(),
            "hr_notif_recent": (
                notif_query
                .order_by(Notification.created_at.desc())
                .limit(4)
                .all()
            )
        }

    except Exception:
        db.session.rollback()
        return defaults


# ============================================================
# PAGE
# ============================================================

@message_bp.route("/doctor")
def doctor_messages():

    user, doctor = _current_doctor()

    if not user:
        return redirect(url_for("pages.login"))

    ensure_messages_table()

    contacts = _contacts(doctor)
    conversations = _conversations(user.id)

    known = {c["user_id"] for c in contacts} | {
        c["user_id"] for c in conversations
    }

    open_with = request.args.get("chat")

    if open_with not in known:
        open_with = None

    chat_data = {
        "me": user.id,
        "contacts": contacts,
        "conversations": conversations,
        "open_with": open_with,
        "max_length": MAX_MESSAGE_LENGTH,
        "urls": {
            "conversations": url_for("message.api_conversations"),
            "thread": url_for("message.api_thread", other_id="__ID__"),
            "send": url_for("message.api_send"),
            "page": url_for("message.doctor_messages")
        }
    }

    return render_template(
        "doctor/doctor_messages.html",
        doctor=doctor,
        chat_data=chat_data
    )


# ============================================================
# API
# ============================================================

@message_bp.route("/api/conversations")
def api_conversations():

    user, doctor = _current_doctor()

    if not user:
        return _json_error("Please sign in again.", 401)

    ensure_messages_table()

    return jsonify({
        "ok": True,
        "conversations": _conversations(user.id),
        "unread_total": _unread_total(user.id)
    })


@message_bp.route("/api/thread/<string:other_id>")
def api_thread(other_id):

    user, doctor = _current_doctor()

    if not user:
        return _json_error("Please sign in again.", 401)

    ensure_messages_table()

    other = db.session.get(User, other_id)

    if not other or other.id == user.id:
        return _json_error("Conversation not found.", 404)

    if not _has_history(user.id, other.id) and not _may_message(doctor, other.id):
        return _json_error("You cannot message this user.", 403)

    pair = or_(
        and_(
            Message.sender_id == user.id,
            Message.recipient_id == other.id
        ),
        and_(
            Message.sender_id == other.id,
            Message.recipient_id == user.id
        )
    )

    after = _parse_iso(request.args.get("after"))

    if after:
        messages = (
            Message.query
            .filter(pair, Message.created_at >= after)
            .order_by(Message.created_at.asc())
            .limit(200)
            .all()
        )
    else:
        messages = list(reversed(
            Message.query
            .filter(pair)
            .order_by(Message.created_at.desc())
            .limit(200)
            .all()
        ))

    # Opening the conversation marks incoming messages as read,
    # together with the "New message from ..." notification.
    Message.query.filter_by(
        sender_id=other.id,
        recipient_id=user.id,
        is_read=False
    ).update({"is_read": True})

    Notification.query.filter_by(
        user_id=user.id,
        title=(NOTIFICATION_TITLE_PREFIX + _display_name(other))[:150],
        is_read=False
    ).update({"is_read": True})

    db.session.commit()

    details = _people_details([other.id])

    return jsonify({
        "ok": True,
        "partner": {
            "user_id": other.id,
            "name": _display_name(other),
            "role": other.role,
            "detail": details.get(other.id, ""),
            "initials": _initials(other)
        },
        "messages": [_serialize(m, user.id) for m in messages],
        "unread_total": _unread_total(user.id)
    })


@message_bp.route("/api/send", methods=["POST"])
def api_send():

    user, doctor = _current_doctor()

    if not user:
        return _json_error("Please sign in again.", 401)

    ensure_messages_table()

    payload = request.get_json(silent=True) or {}

    recipient_id = str(payload.get("recipient_id") or "").strip()
    body = str(payload.get("body") or "").strip()

    if not recipient_id or not body:
        return _json_error("Please type a message.", 400)

    if len(body) > MAX_MESSAGE_LENGTH:
        return _json_error(
            f"Message is too long (max {MAX_MESSAGE_LENGTH} characters).",
            400
        )

    recipient = db.session.get(User, recipient_id)

    if not recipient or recipient.id == user.id:
        return _json_error("Recipient not found.", 404)

    if not _may_message(doctor, recipient.id) and not _has_history(
        user.id, recipient.id
    ):
        return _json_error("You cannot message this user.", 403)

    message = Message(
        sender_id=user.id,
        recipient_id=recipient.id,
        body=body,
        is_read=False
    )

    db.session.add(message)

    # Show the message in the recipient's notifications.
    # Several unread messages from the same sender share one
    # notification so the list does not fill up.
    title = (NOTIFICATION_TITLE_PREFIX + _display_name(user))[:150]
    preview = body if len(body) <= 140 else body[:137] + "…"

    notification = Notification.query.filter_by(
        user_id=recipient.id,
        title=title,
        is_read=False
    ).first()

    if notification:
        notification.message = preview
        notification.created_at = datetime.utcnow()
    else:
        db.session.add(Notification(
            user_id=recipient.id,
            title=title,
            message=preview,
            notification_type="system",
            is_read=False
        ))

    db.session.commit()

    return jsonify({
        "ok": True,
        "message": _serialize(message, user.id)
    })


# ============================================================
# PATIENT PORTAL MESSAGING
#
# WHO CAN CHAT WITH WHOM (single source of truth)
#
#   patient -> ONLY their assigned doctor  (Patient.assigned_doctor_id,
#              the same field the doctor portal uses for "My Patients")
#              and the family members linked to them (PatientFamily).
#   family  -> ONLY the linked patient(s) and those patients' doctors.
#   doctor  -> ONLY assigned patients and those patients' family members
#              (applied to the doctor portal in the next step).
#
# Every patient endpoint below checks this list on the server;
# hiding someone in the UI is never relied on.
# ============================================================

def _active_doctor_user_id(doctor_id):
    """User id of an active doctor, or None."""

    if not doctor_id:
        return None

    doctor = db.session.get(Doctor, doctor_id)

    if not doctor or doctor.status != "active":
        return None

    return doctor.user_id


def _allowed_for_patient(patient):
    """User ids a patient may chat with: assigned doctor + linked family."""

    allowed = set()

    doctor_user_id = _active_doctor_user_id(patient.assigned_doctor_id)

    if doctor_user_id:
        allowed.add(doctor_user_id)

    rows = (
        db.session.query(FamilyMember.user_id)
        .join(
            PatientFamily,
            PatientFamily.family_member_id == FamilyMember.id
        )
        .filter(PatientFamily.patient_id == patient.id)
        .all()
    )

    allowed.update(r[0] for r in rows)
    allowed.discard(patient.user_id)

    return allowed


def _allowed_for_family(family_user_id):
    """User ids a family member may chat with: linked patients + their doctors."""

    allowed = set()

    patients = (
        db.session.query(Patient)
        .join(PatientFamily, PatientFamily.patient_id == Patient.id)
        .join(
            FamilyMember,
            FamilyMember.id == PatientFamily.family_member_id
        )
        .filter(FamilyMember.user_id == family_user_id)
        .all()
    )

    for patient in patients:
        allowed.add(patient.user_id)

        doctor_user_id = _active_doctor_user_id(patient.assigned_doctor_id)

        if doctor_user_id:
            allowed.add(doctor_user_id)

    allowed.discard(family_user_id)

    return allowed


def _current_patient():

    user_id = session.get("user_id")

    if not user_id or session.get("role") != "patient":
        return None, None

    user = db.session.get(User, user_id)
    patient = Patient.query.filter_by(user_id=user_id).first()

    if not user or not patient:
        return None, None

    return user, patient


def _person_card(user, details):

    return {
        "user_id": user.id,
        "name": _display_name(user),
        "role": user.role,
        "detail": details.get(user.id, ""),
        "initials": _initials(user)
    }


def _patient_contacts(allowed):
    """Assigned doctor first, then linked family members."""

    if not allowed:
        return []

    users = User.query.filter(User.id.in_(list(allowed))).all()
    users.sort(key=lambda u: (u.role != "doctor", (u.first_name or "").lower()))

    details = _people_details([u.id for u in users])

    return [_person_card(u, details) for u in users]


def _unread_from(user_id, allowed):

    if not allowed:
        return 0

    return Message.query.filter(
        Message.recipient_id == user_id,
        Message.is_read.is_(False),
        Message.sender_id.in_(list(allowed))
    ).count()


def _notify_recipient(sender, recipient, body):
    """Same notification behaviour as the doctor portal."""

    title = (NOTIFICATION_TITLE_PREFIX + _display_name(sender))[:150]
    preview = body if len(body) <= 140 else body[:137] + "…"

    notification = Notification.query.filter_by(
        user_id=recipient.id,
        title=title,
        is_read=False
    ).first()

    if notification:
        notification.message = preview
        notification.created_at = datetime.utcnow()
    else:
        db.session.add(Notification(
            user_id=recipient.id,
            title=title,
            message=preview,
            notification_type="system",
            is_read=False
        ))


def _patient_header_data(user_id, defaults):
    """Topbar badge + dropdown data for patient pages. Never raises."""

    try:
        ensure_messages_table()

        patient = Patient.query.filter_by(user_id=user_id).first()

        if not patient:
            return defaults

        allowed = _allowed_for_patient(patient)

        if not allowed:
            return defaults

        unread = (
            Message.query
            .filter(
                Message.recipient_id == user_id,
                Message.is_read.is_(False),
                Message.sender_id.in_(list(allowed))
            )
            .order_by(Message.created_at.desc())
            .all()
        )

        grouped = {}

        for m in unread:
            g = grouped.setdefault(
                m.sender_id,
                {"sender_id": m.sender_id, "preview": m.body, "count": 0}
            )
            g["count"] += 1

        senders = {
            u.id: u
            for u in User.query.filter(
                User.id.in_(list(grouped.keys()))
            ).all()
        } if grouped else {}

        recent = []

        for g in list(grouped.values())[:4]:
            sender = senders.get(g["sender_id"])
            preview = g["preview"].replace("\n", " ")
            recent.append({
                "sender_id": g["sender_id"],
                "name": _display_name(sender) if sender else "User",
                "preview": preview[:60] + ("…" if len(preview) > 60 else ""),
                "count": g["count"]
            })

        data = dict(defaults)
        data["hr_unread_messages"] = len(unread)
        data["hr_msg_recent"] = recent

        return data

    except Exception:
        db.session.rollback()
        return defaults


# ---------------- page ----------------

@message_bp.route("/patient")
def patient_messages():

    user, patient = _current_patient()

    if not user:
        return redirect(url_for("pages.login"))

    ensure_messages_table()

    allowed = _allowed_for_patient(patient)

    contacts = _patient_contacts(allowed)

    conversations = [
        c for c in _conversations(user.id) if c["user_id"] in allowed
    ]

    open_with = request.args.get("chat")

    if open_with not in allowed:
        open_with = None

    chat_data = {
        "me": user.id,
        "contacts": contacts,
        "conversations": conversations,
        "open_with": open_with,
        "max_length": MAX_MESSAGE_LENGTH,
        "urls": {
            "conversations": url_for("message.patient_api_conversations"),
            "thread": url_for("message.patient_api_thread", other_id="__ID__"),
            "send": url_for("message.patient_api_send"),
            "page": url_for("message.patient_messages")
        }
    }

    return render_template(
        "patient_portal/messages.html",
        user=user,
        patient=patient,
        chat_data=chat_data,
        active_page="messages"
    )


# ---------------- API ----------------

@message_bp.route("/patient/api/conversations")
def patient_api_conversations():

    user, patient = _current_patient()

    if not user:
        return _json_error("Please sign in again.", 401)

    ensure_messages_table()

    allowed = _allowed_for_patient(patient)

    return jsonify({
        "ok": True,
        "conversations": [
            c for c in _conversations(user.id) if c["user_id"] in allowed
        ],
        "unread_total": _unread_from(user.id, allowed)
    })


@message_bp.route("/patient/api/thread/<string:other_id>")
def patient_api_thread(other_id):

    user, patient = _current_patient()

    if not user:
        return _json_error("Please sign in again.", 401)

    ensure_messages_table()

    allowed = _allowed_for_patient(patient)

    if other_id not in allowed:
        return _json_error("You cannot message this user.", 403)

    other = db.session.get(User, other_id)

    if not other:
        return _json_error("Conversation not found.", 404)

    pair = or_(
        and_(
            Message.sender_id == user.id,
            Message.recipient_id == other.id
        ),
        and_(
            Message.sender_id == other.id,
            Message.recipient_id == user.id
        )
    )

    after = _parse_iso(request.args.get("after"))

    if after:
        messages = (
            Message.query
            .filter(pair, Message.created_at >= after)
            .order_by(Message.created_at.asc())
            .limit(200)
            .all()
        )
    else:
        messages = list(reversed(
            Message.query
            .filter(pair)
            .order_by(Message.created_at.desc())
            .limit(200)
            .all()
        ))

    # Opening the chat marks the other person's messages as read
    # (and the matching "New message from ..." notification).
    Message.query.filter_by(
        sender_id=other.id,
        recipient_id=user.id,
        is_read=False
    ).update({"is_read": True})

    Notification.query.filter_by(
        user_id=user.id,
        title=(NOTIFICATION_TITLE_PREFIX + _display_name(other))[:150],
        is_read=False
    ).update({"is_read": True})

    db.session.commit()

    # Which of MY messages the other person has already read,
    # so the ticks update without reloading the whole thread.
    read_rows = (
        db.session.query(Message.id)
        .filter(
            Message.sender_id == user.id,
            Message.recipient_id == other.id,
            Message.is_read.is_(True)
        )
        .order_by(Message.created_at.desc())
        .limit(200)
        .all()
    )

    details = _people_details([other.id])

    return jsonify({
        "ok": True,
        "partner": _person_card(other, details),
        "messages": [_serialize(m, user.id) for m in messages],
        "read_ids": [r[0] for r in read_rows],
        "unread_total": _unread_from(user.id, allowed)
    })


@message_bp.route("/patient/api/send", methods=["POST"])
def patient_api_send():

    user, patient = _current_patient()

    if not user:
        return _json_error("Please sign in again.", 401)

    ensure_messages_table()

    payload = request.get_json(silent=True) or {}

    recipient_id = str(payload.get("recipient_id") or "").strip()
    body = str(payload.get("body") or "").strip()

    if not recipient_id or not body:
        return _json_error("Please type a message.", 400)

    if len(body) > MAX_MESSAGE_LENGTH:
        return _json_error(
            f"Message is too long (max {MAX_MESSAGE_LENGTH} characters).",
            400
        )

    if recipient_id not in _allowed_for_patient(patient):
        return _json_error(
            "You can only message your assigned doctor and linked family members.",
            403
        )

    recipient = db.session.get(User, recipient_id)

    if not recipient:
        return _json_error("Recipient not found.", 404)

    message = Message(
        sender_id=user.id,
        recipient_id=recipient.id,
        body=body,
        is_read=False
    )

    db.session.add(message)
    _notify_recipient(user, recipient, body)
    db.session.commit()

    return jsonify({
        "ok": True,
        "message": _serialize(message, user.id)
    })
