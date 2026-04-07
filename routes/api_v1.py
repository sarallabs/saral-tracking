"""REST API v1 — programmatic access via API key or session auth."""
import hashlib
import secrets
import json
from datetime import datetime, timezone
from functools import wraps

from flask import Blueprint, request, jsonify
from flask_login import current_user

from app import db
from app.models import (
    User, Project, Ticket, Sprint, Comment, Label, Version, Component,
    TicketStatus, TicketPriority, TicketType, SprintStatus,
    APIKey, AuditLog, project_members,
)

api_v1_bp = Blueprint('api_v1', __name__, url_prefix='/api/v1')


# ── Authentication helpers ────────────────────────────────────────────────────

def _resolve_api_user():
    """Return the User from a Bearer token or the active session."""
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        raw_key = auth[7:].strip()
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        ak = APIKey.query.filter_by(key_hash=key_hash, is_active=True).first()
        if ak:
            ak.last_used_at = datetime.now(timezone.utc)
            db.session.commit()
            return ak.owner
    if current_user.is_authenticated:
        return current_user
    return None


def api_auth(write=False):
    """Decorator that resolves the API user and rejects unauthenticated requests."""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            user = _resolve_api_user()
            if not user:
                return jsonify({'error': 'Authentication required.', 'code': 401}), 401
            request._api_user = user
            return f(*args, **kwargs)
        return wrapped
    return decorator


# ── Serialisers ───────────────────────────────────────────────────────────────

def _user_dict(u):
    return {
        'id': u.id, 'username': u.username, 'full_name': u.full_name,
        'email': u.email, 'role': u.role, 'avatar_url': u.avatar_url or '',
    }


def _project_dict(p):
    return {
        'id': p.id, 'key': p.key, 'name': p.name,
        'description': p.description, 'status': p.status,
        'color': p.color,
        'created_at': p.created_at.isoformat() if p.created_at else None,
    }


def _ticket_dict(t, full=False):
    d = {
        'id': t.id, 'key': t.ticket_key, 'title': t.title,
        'type': t.type, 'status': t.status, 'priority': t.priority,
        'project_key': t.project.key,
        'sprint_id': t.sprint_id,
        'component_id': t.component_id,
        'fix_version_id': t.fix_version_id,
        'story_points': t.story_points,
        'estimated_hours': t.estimated_hours,
        'logged_hours': t.logged_hours,
        'assignee': _user_dict(t.assignee) if t.assignee else None,
        'creator': _user_dict(t.creator) if t.creator else None,
        'soft_deadline': t.soft_deadline.isoformat() if t.soft_deadline else None,
        'hard_deadline': t.hard_deadline.isoformat() if t.hard_deadline else None,
        'created_at': t.created_at.isoformat() if t.created_at else None,
        'updated_at': t.updated_at.isoformat() if t.updated_at else None,
        'labels': [{'id': l.id, 'name': l.name, 'color': l.color} for l in t.labels],
    }
    if full:
        d['description'] = t.description
    return d


def _sprint_dict(s):
    return {
        'id': s.id, 'name': s.name, 'goal': s.goal,
        'status': s.status, 'project_key': s.project.key,
        'start_date': s.start_date.isoformat() if s.start_date else None,
        'end_date': s.end_date.isoformat() if s.end_date else None,
        'created_at': s.created_at.isoformat() if s.created_at else None,
    }


def _write_audit(user, action, entity_type='', entity_id=None, entity_name='',
                 old_values=None, new_values=None):
    try:
        al = AuditLog(
            user_id=user.id if user else None,
            username=user.username if user else 'api',
            action=action, entity_type=entity_type,
            entity_id=entity_id, entity_name=str(entity_name or ''),
            ip_address=request.remote_addr or '',
            user_agent=request.headers.get('User-Agent', '')[:500],
            old_values=json.dumps(old_values or {}),
            new_values=json.dumps(new_values or {}),
        )
        db.session.add(al)
        db.session.flush()
    except Exception:
        pass


# ── /me ───────────────────────────────────────────────────────────────────────

@api_v1_bp.route('/me')
@api_auth()
def me():
    """Return the currently authenticated user."""
    return jsonify(_user_dict(request._api_user))


# ── Projects ──────────────────────────────────────────────────────────────────

@api_v1_bp.route('/projects')
@api_auth()
def list_projects():
    """List projects visible to the authenticated user."""
    user = request._api_user
    projects = Project.query.all() if user.role == 'admin' else user.projects
    return jsonify([_project_dict(p) for p in projects])


@api_v1_bp.route('/projects/<key>')
@api_auth()
def get_project(key):
    """Get a single project by its key."""
    p = Project.query.filter_by(key=key).first_or_404()
    return jsonify(_project_dict(p))


# ── Tickets ───────────────────────────────────────────────────────────────────

@api_v1_bp.route('/projects/<key>/tickets')
@api_auth()
def list_tickets(key):
    """
    List tickets in a project with optional filters.

    Query params: status, priority, type, assignee_id, sprint_id,
                  component_id, page (1-based), per_page (max 100).
    """
    project = Project.query.filter_by(key=key).first_or_404()
    q = Ticket.query.filter_by(project_id=project.id)

    for field, col in [
        ('status', Ticket.status), ('priority', Ticket.priority),
        ('type', Ticket.type),
    ]:
        val = request.args.get(field)
        if val:
            q = q.filter(col == val)

    for field, col in [
        ('assignee_id', Ticket.assigned_to), ('sprint_id', Ticket.sprint_id),
        ('component_id', Ticket.component_id),
    ]:
        val = request.args.get(field)
        if val and val.isdigit():
            q = q.filter(col == int(val))

    page = max(1, int(request.args.get('page', 1)))
    per_page = min(max(1, int(request.args.get('per_page', 50))), 100)
    total = q.count()
    tickets = (q.order_by(Ticket.created_at.desc())
               .offset((page - 1) * per_page).limit(per_page).all())

    return jsonify({
        'data': [_ticket_dict(t) for t in tickets],
        'meta': {
            'total': total, 'page': page, 'per_page': per_page,
            'pages': max(1, (total + per_page - 1) // per_page),
        },
    })


@api_v1_bp.route('/projects/<key>/tickets/<ticket_key>')
@api_auth()
def get_ticket(key, ticket_key):
    """Get a single ticket (includes description)."""
    t = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    return jsonify(_ticket_dict(t, full=True))


@api_v1_bp.route('/projects/<key>/tickets', methods=['POST'])
@api_auth(write=True)
def create_ticket_api(key):
    """
    Create a ticket. Requires write scope.

    JSON body: title* (str), description (str), type, status, priority,
               story_points, estimated_hours, assigned_to (user id),
               sprint_id, component_id, fix_version_id.
    """
    project = Project.query.filter_by(key=key).first_or_404()
    user = request._api_user
    data = request.get_json(silent=True) or {}

    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400

    ticket_key = project.next_ticket_key()
    t = Ticket(
        title=title,
        description=data.get('description', ''),
        ticket_key=ticket_key,
        type=data.get('type', TicketType.TASK.value),
        status=data.get('status', TicketStatus.BACKLOG.value),
        priority=data.get('priority', TicketPriority.MEDIUM.value),
        project_id=project.id,
        created_by=user.id,
        story_points=int(data.get('story_points', 0) or 0),
        estimated_hours=float(data.get('estimated_hours', 0) or 0),
    )

    for opt_field in ('assigned_to', 'sprint_id', 'component_id', 'fix_version_id'):
        val = data.get(opt_field)
        if val:
            setattr(t, opt_field, int(val))
    if t.assigned_to:
        t.assigned_by = user.id

    db.session.add(t)
    db.session.flush()
    _write_audit(user, 'ticket.create', 'ticket', t.id, t.ticket_key,
                 new_values={'title': title})
    db.session.commit()
    return jsonify(_ticket_dict(t, full=True)), 201


@api_v1_bp.route('/projects/<key>/tickets/<ticket_key>', methods=['PATCH'])
@api_auth(write=True)
def update_ticket_api(key, ticket_key):
    """
    Update ticket fields. Send only the fields you want to change.

    JSON body: title, description, status, priority, type, story_points,
               estimated_hours, logged_hours, assigned_to, sprint_id,
               component_id, fix_version_id.
    """
    t = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    user = request._api_user
    data = request.get_json(silent=True) or {}

    changed = {}
    for field in ('title', 'description', 'status', 'priority', 'type',
                  'story_points', 'estimated_hours', 'logged_hours'):
        if field in data:
            old = getattr(t, field)
            setattr(t, field, data[field])
            changed[field] = {'old': old, 'new': data[field]}

    for opt_field in ('assigned_to', 'sprint_id', 'component_id', 'fix_version_id'):
        if opt_field in data:
            setattr(t, opt_field, int(data[opt_field]) if data[opt_field] else None)

    _write_audit(user, 'ticket.update', 'ticket', t.id, t.ticket_key,
                 old_values=changed)
    db.session.commit()
    return jsonify(_ticket_dict(t, full=True))


@api_v1_bp.route('/projects/<key>/tickets/<ticket_key>', methods=['DELETE'])
@api_auth(write=True)
def delete_ticket_api(key, ticket_key):
    """Delete a ticket (admin/manager only)."""
    t = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    user = request._api_user
    if user.role not in ('admin', 'manager'):
        return jsonify({'error': 'Insufficient permissions'}), 403

    _write_audit(user, 'ticket.delete', 'ticket', t.id, t.ticket_key)
    db.session.delete(t)
    db.session.commit()
    return '', 204


# ── Comments ──────────────────────────────────────────────────────────────────

@api_v1_bp.route('/projects/<key>/tickets/<ticket_key>/comments')
@api_auth()
def list_comments(key, ticket_key):
    """List comments on a ticket."""
    t = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    return jsonify([{
        'id': c.id, 'content': c.content, 'is_internal': c.is_internal,
        'author': _user_dict(c.author),
        'created_at': c.created_at.isoformat(),
        'edited': c.edited,
    } for c in t.comments.all()])


@api_v1_bp.route('/projects/<key>/tickets/<ticket_key>/comments', methods=['POST'])
@api_auth(write=True)
def create_comment(key, ticket_key):
    """Add a comment to a ticket. JSON body: content* (str), is_internal (bool)."""
    t = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    user = request._api_user
    data = request.get_json(silent=True) or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({'error': 'content is required'}), 400

    from app.models import Comment as _Comment
    c = _Comment(
        ticket_id=t.id, author_id=user.id, content=content,
        is_internal=bool(data.get('is_internal', False)),
    )
    db.session.add(c)
    db.session.commit()
    return jsonify({
        'id': c.id, 'content': c.content, 'is_internal': c.is_internal,
        'author': _user_dict(c.author), 'created_at': c.created_at.isoformat(),
    }), 201


# ── Sprints ───────────────────────────────────────────────────────────────────

@api_v1_bp.route('/projects/<key>/sprints')
@api_auth()
def list_sprints(key):
    """List sprints in a project."""
    project = Project.query.filter_by(key=key).first_or_404()
    sprints = Sprint.query.filter_by(project_id=project.id).all()
    return jsonify([_sprint_dict(s) for s in sprints])


@api_v1_bp.route('/projects/<key>/sprints/<int:sprint_id>')
@api_auth()
def get_sprint(key, sprint_id):
    """Get a sprint with its tickets."""
    s = Sprint.query.get_or_404(sprint_id)
    data = _sprint_dict(s)
    data['tickets'] = [_ticket_dict(t) for t in s.tickets.all()]
    return jsonify(data)


# ── Components ────────────────────────────────────────────────────────────────

@api_v1_bp.route('/projects/<key>/components')
@api_auth()
def list_components(key):
    """List components defined in a project."""
    project = Project.query.filter_by(key=key).first_or_404()
    comps = Component.query.filter_by(project_id=project.id).all()
    return jsonify([{
        'id': c.id, 'name': c.name, 'description': c.description,
        'color': c.color,
        'lead': _user_dict(c.lead) if c.lead else None,
        'ticket_count': c.tickets.count(),
    } for c in comps])


# ── Members ───────────────────────────────────────────────────────────────────

@api_v1_bp.route('/projects/<key>/members')
@api_auth()
def list_members(key):
    """List project members with their project roles."""
    project = Project.query.filter_by(key=key).first_or_404()
    rows = db.session.execute(
        db.select(User, project_members.c.role_in_project)
        .join(project_members, User.id == project_members.c.user_id)
        .where(project_members.c.project_id == project.id)
    ).all()
    return jsonify([{**_user_dict(u), 'role_in_project': role} for u, role in rows])


# ── Versions ──────────────────────────────────────────────────────────────────

@api_v1_bp.route('/projects/<key>/versions')
@api_auth()
def list_versions(key):
    """List versions / releases in a project."""
    project = Project.query.filter_by(key=key).first_or_404()
    versions = Version.query.filter_by(project_id=project.id).order_by(
        Version.release_date.asc().nullslast()
    ).all()
    return jsonify([{
        'id': v.id, 'name': v.name, 'description': v.description,
        'status': v.status,
        'release_date': v.release_date.isoformat() if v.release_date else None,
        'ticket_count': v.tickets.count(),
    } for v in versions])


# ── API Key self-management ───────────────────────────────────────────────────

@api_v1_bp.route('/keys')
@api_auth()
def list_api_keys():
    """List the authenticated user's API keys (hashes never returned)."""
    user = request._api_user
    keys = APIKey.query.filter_by(user_id=user.id).all()
    return jsonify([{
        'id': k.id, 'name': k.name, 'prefix': k.prefix, 'scopes': k.scopes,
        'is_active': k.is_active,
        'created_at': k.created_at.isoformat(),
        'last_used_at': k.last_used_at.isoformat() if k.last_used_at else None,
    } for k in keys])
