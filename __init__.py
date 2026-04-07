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

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(tickets_bp)
    app.register_blueprint(sprints_bp)
    app.register_blueprint(team_bp)
    app.register_blueprint(notifications_bp)

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

    with app.app_context():
        db.create_all()

    return app
