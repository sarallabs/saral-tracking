import json as _json
from functools import wraps
from flask import abort, flash, redirect, url_for, current_app, request as _request
from flask_login import current_user


def require_role(*roles):
    """Decorator to restrict access to users with specified roles.
    Superadmins always pass regardless of the required roles.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for('auth.login'))
            if current_user.role == 'superadmin':
                return f(*args, **kwargs)
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
    """Helper to create a notification and optionally send an email."""
    from app import db
    from app.models import Notification, User
    notif = Notification(
        user_id=user_id,
        ticket_id=ticket.id if ticket else None,
        type=notif_type,
        message=message,
        link=link
    )
    db.session.add(notif)

    # Send email if configured and user has enabled email notifications
    _try_send_email(user_id, message, link, notif_type)

    return notif


def log_audit(action, entity_type='', entity_id=None, entity_name='',
              old_values=None, new_values=None):
    """Write a system-wide AuditLog entry. Never raises."""
    try:
        from app import db
        from app.models import AuditLog
        al = AuditLog(
            user_id=current_user.id if current_user.is_authenticated else None,
            username=current_user.username if current_user.is_authenticated else 'anonymous',
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=str(entity_name or ''),
            ip_address=_request.remote_addr or '',
            user_agent=_request.headers.get('User-Agent', '')[:500],
            old_values=_json.dumps(old_values or {}),
            new_values=_json.dumps(new_values or {}),
        )
        db.session.add(al)
    except Exception:
        pass


def get_user_project_role(user, project):
    """Return the user's role_in_project string, or None if not a member."""
    from app import db
    from app.models import project_members
    result = db.session.execute(
        db.select(project_members.c.role_in_project)
        .where(project_members.c.project_id == project.id)
        .where(project_members.c.user_id == user.id)
    ).first()
    return result[0] if result else None


def check_project_perm(project, perm_key):
    """Return True if the current user has *perm_key* in *project*."""
    if not current_user.is_authenticated:
        return False
    if current_user.role in ('superadmin', 'admin'):
        return True

    role = get_user_project_role(current_user, project)
    if not role:
        return False
    if role == 'owner':
        return True

    from app.models import ProjectPermission, DEFAULT_PERMISSIONS
    pp = ProjectPermission.query.filter_by(
        project_id=project.id, role=role
    ).first()
    if pp:
        perms = pp.get_permissions()
        return bool(perms.get(perm_key, False))

    return bool(DEFAULT_PERMISSIONS.get(role, {}).get(perm_key, False))


def _try_send_email(user_id, message, link, notif_type):
    """Fire an email notification if Flask-Mail is available and user opted in."""
    try:
        from app import mail, _mail_available
        if not _mail_available or mail is None:
            return
        if not current_app.config.get('MAIL_SERVER'):
            return

        from app.models import User
        user = User.query.get(user_id)
        if not user or not user.email_notifications:
            return

        from flask_mail import Message as MailMessage
        subject = f'[SaralTrack] {notif_type.replace("_", " ").title()}'
        body = f'{message}\n\nView: {current_app.config.get("BASE_URL", "")}{link}'
        html = f'''<p>{message}</p>
<p><a href="{current_app.config.get("BASE_URL", "")}{link}" style="color:#2D8CFF">View in SaralTrack →</a></p>
<hr><p style="color:#888;font-size:12px">You are receiving this because you have email notifications enabled.
Manage preferences in your <a href="{current_app.config.get("BASE_URL", "")}/profile">profile</a>.</p>'''

        msg = MailMessage(
            subject=subject,
            recipients=[user.email],
            body=body,
            html=html,
            sender=current_app.config.get('MAIL_DEFAULT_SENDER', 'noreply@saraltrack.app')
        )
        mail.send(msg)
    except Exception:
        pass  # Email is best-effort; never block the main flow
