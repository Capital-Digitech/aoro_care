import os
from datetime import timedelta


class Config:
    """Base configuration for Health Ring application."""

    # ---------- General ----------
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-secret-key-in-production")
    DEBUG = os.environ.get("FLASK_DEBUG", "True") == "True"

    # ---------- Database (MySQL) ----------
    MYSQL_USER = os.environ.get("MYSQL_USER", "root")
    MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "123456")
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
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "mahalekshmi2108@gmail.com")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "opcx tcow wvim exnq")
    MAIL_DEFAULT_SENDER = (
        "Health Ring",
        os.environ.get("MAIL_USERNAME", "mahalekshmi2108@gmail.com"),
    )

    # ---------- Session / Security ----------
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    WTF_CSRF_TIME_LIMIT = None

    # ---------- OTP ----------
    OTP_EXPIRY_MINUTES = 5
    OTP_LENGTH = 6
    OTP_RESEND_COOLDOWN_SECONDS = 30
