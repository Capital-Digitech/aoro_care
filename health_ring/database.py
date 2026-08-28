from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail
from flask_wtf import CSRFProtect

# Shared extensions
db = SQLAlchemy()
mail = Mail()
csrf = CSRFProtect()


def init_db(app):
    """Initialize database extensions."""
    db.init_app(app)
    mail.init_app(app)
    csrf.init_app(app)

    # Import all models so SQLAlchemy knows about them
    with app.app_context():
        import models