# Health Ring — Authentication System

A production-ready Flask authentication module for the Health Ring healthcare
platform: Login, Create Account (4-step wizard), Email OTP Verification,
Forgot Password, and MySQL integration. No dashboards, AI modules, or
analytics are included by design.

## 1. Prerequisites

- Python 3.10+
- MySQL Server 8.x running locally or remotely
- A Gmail account with an **App Password** (2FA must be enabled on the Gmail
  account; generate the app password at https://myaccount.google.com/apppasswords)

## 2. Setup

```bash
cd health_ring
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create your MySQL database:

```sql
CREATE DATABASE health_ring CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Copy `.env.example` to `.env` and fill in your real credentials:

```bash
cp .env.example .env
```

Then load the `.env` file (either via `python-dotenv` in your shell, a
process manager, or by exporting the variables manually) before running the
app — `config.py` reads these via `os.environ`.

## 3. Run

```bash
python app.py
```

The app starts at `http://127.0.0.1:5000`. Tables (`users`, `otps`) are
created automatically on first run.

## 4. Pages

| Route              | Description                          |
|---------------------|---------------------------------------|
| `/login`            | Sign in (Patient/Doctor/Family/Admin) |
| `/create-account`   | 4-step registration wizard            |
| `/forgot-password`  | Email → OTP → reset password flow     |
| `/dashboard`         | Minimal post-login placeholder        |

## 5. API Endpoints

- `POST /api/register/validate-role`
- `POST /api/register/validate-personal`
- `POST /api/register/check-email`
- `POST /api/register/submit` — sends OTP, does **not** create the user yet
- `POST /api/register/verify-otp` — creates the user only on success
- `POST /api/register/resend-otp`
- `POST /api/login`
- `POST /api/logout`
- `POST /api/forgot-password/send-otp`
- `POST /api/forgot-password/verify-otp`
- `POST /api/forgot-password/reset`

## 6. Security Notes

- Passwords are hashed with Werkzeug's `generate_password_hash` (PBKDF2).
- CSRF protection is enabled globally via `Flask-WTF`'s `CSRFProtect`.
- All SQL access goes through SQLAlchemy's ORM (parameterized queries — no
  raw string interpolation), preventing SQL injection.
- OTPs expire after 5 minutes and are single-use; previous unused OTPs are
  invalidated whenever a new one is generated.
- The pending registration (role, personal info, email/password) is held in
  the **server-side session** until OTP verification succeeds — the user row
  is only written to MySQL after the code is confirmed.
