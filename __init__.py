from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect
from config import Config
import os

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
csrf = CSRFProtect()

try:
    from flask_mail import Mail
    mail = Mail()
    _mail_available = True
except ImportError:
    mail = None
    _mail_available = False

login_manager.login_view = 'auth.login'
login_manager.login_message_category = 'info'


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(os.path.join(app.instance_path), exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)
    if _mail_available and mail is not None:
        mail.init_app(app)

    from app.models import User

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    from app.routes.auth import auth_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.projects import projects_bp
    from app.routes.tickets import tickets_bp
    from app.routes.sprints import sprints_bp
    from app.routes.team import team_bp
    from app.routes.notifications import notifications_bp
    from app.routes.releases import releases_bp
    from app.routes.api_v1 import api_v1_bp
    from app.routes.audit import audit_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(tickets_bp)
    app.register_blueprint(sprints_bp)
    app.register_blueprint(team_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(releases_bp)
    app.register_blueprint(api_v1_bp)
    app.register_blueprint(audit_bp)
    csrf.exempt(api_v1_bp)

    @app.before_request
    def enforce_password_change():
        """Redirect users with a temporary password to the change-password page."""
        from flask_login import current_user as cu
        from flask import request as req
        if cu.is_authenticated and getattr(cu, 'must_change_password', False):
            allowed = {'auth.change_password', 'auth.logout', 'static'}
            if req.endpoint not in allowed:
                from flask import flash as _flash
                _flash('Please set a new password to continue.', 'warning')
                from flask import redirect as _redirect, url_for as _url_for
                return _redirect(_url_for('auth.change_password'))

    @app.route('/health')
    def health():
        return {'status': 'ok'}, 200

    @app.context_processor
    def inject_globals():
        if hasattr(app, '_got_first_request_flag'):
            pass
        from flask_login import current_user
        unread_count = 0
        if current_user.is_authenticated:
            from app.models import Notification
            unread_count = Notification.query.filter_by(
                user_id=current_user.id, is_read=False
            ).count()
        return dict(unread_notification_count=unread_count)

    import json as _json

    @app.template_filter('from_json')
    def from_json_filter(value):
        try:
            return _json.loads(value or '[]')
        except Exception:
            return []

    with app.app_context():
        db.create_all()

    return app
