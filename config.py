import os
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

class Config:
    """Base configuration for Health Ring application."""

    # ---------- General ----------
    SECRET_KEY = os.environ.get("SECRET_KEY")
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY environment variable is not set.")

    DEBUG = os.environ.get("FLASK_DEBUG", "False") == "True"

    # ---------- Database ----------
    # Vercel Postgres injects POSTGRES_URL (SQLAlchemy-compatible) and DATABASE_URL.
    # Support both. Normalise legacy postgres:// → postgresql+psycopg2://
    _database_url = (
        os.environ.get("POSTGRES_URL")
        or os.environ.get("DATABASE_URL")
        or ""
    )
    if _database_url:
        if _database_url.startswith("postgres://"):
            _database_url = _database_url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif _database_url.startswith("postgresql://"):
            _database_url = _database_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        SQLALCHEMY_DATABASE_URI = _database_url
    else:
        # Local development fallback (MySQL)
        MYSQL_USER = os.environ.get("MYSQL_USER", "root")
        MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "")
        MYSQL_HOST = os.environ.get("MYSQL_HOST", "localhost")
        MYSQL_PORT = os.environ.get("MYSQL_PORT", "3306")
        MYSQL_DB = os.environ.get("MYSQL_DB", "healthring_db")
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}"
            f"@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
        )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ---------- Flask-Mail (Gmail SMTP) ----------
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = (
        "Health Ring",
        os.environ.get("MAIL_USERNAME", ""),
    )

    # ---------- Session / Security ----------
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "True") == "True"
    SESSION_COOKIE_SAMESITE = "Lax"
    WTF_CSRF_TIME_LIMIT = None

    # ---------- OTP ----------
    OTP_EXPIRY_MINUTES = 5
    OTP_LENGTH = 6
    OTP_RESEND_COOLDOWN_SECONDS = 30