from functools import wraps
from flask import abort, flash, redirect, url_for
from flask_login import current_user


def require_role(*roles):
    """Decorator to restrict access to users with specified roles."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for('auth.login'))
            if current_user.role not in roles:
                abort(403)
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def log_activity(ticket=None, project=None, action='', old_value='', new_value=''):
    """Helper to create an activity log entry."""
    from app import db
    from app.models import ActivityLog
    log = ActivityLog(
        ticket_id=ticket.id if ticket else None,
        project_id=project.id if project else (ticket.project_id if ticket else None),
        user_id=current_user.id,
        action=action,
        old_value=str(old_value),
        new_value=str(new_value)
    )
    db.session.add(log)
    return log


def create_notification(user_id, message, ticket=None, notif_type='status_change', link=''):
    """Helper to create a notification."""
    from app import db
    from app.models import Notification
    notif = Notification(
        user_id=user_id,
        ticket_id=ticket.id if ticket else None,
        type=notif_type,
        message=message,
        link=link
    )
    db.session.add(notif)
    return notif
