import os
import secrets


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'replace-this-in-production-with-a-long-random-string')

    _base = os.path.dirname(os.path.abspath(__file__))
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f'sqlite:///{os.path.join(_base, "instance", "saraltrack.db")}'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    UPLOAD_FOLDER = os.path.join(_base, 'static', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

    # Public registration is closed; only superadmins create accounts.
    REGISTRATION_OPEN = False

    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = 3600

    BASE_URL = os.environ.get('BASE_URL', 'http://localhost:5000')

    # Optional SMTP (leave blank to disable email notifications)
    MAIL_SERVER = os.environ.get('MAIL_SERVER', '')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() == 'true'
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@saraltrack.app')


class ProductionConfig(Config):
    """Settings applied when FLASK_ENV=production (GoDaddy deployment)."""
    DEBUG = False
    TESTING = False

    # App is mounted at /saral-tracking — Flask needs to know the prefix so
    # url_for() generates correct absolute paths.
    APPLICATION_ROOT = '/saral-tracking'
    PREFERRED_URL_SCHEME = 'https'
    SERVER_NAME = os.environ.get('SERVER_NAME', 'saralvidhya.com')

    # Harden cookies for HTTPS
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    REMEMBER_COOKIE_SECURE = True

    # Require a real SECRET_KEY in production — no fallback
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
