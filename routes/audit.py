"""Admin audit log viewer."""
from datetime import datetime

from flask import Blueprint, render_template, request, abort, jsonify
from flask_login import login_required, current_user

from app import db
from app.models import AuditLog

audit_bp = Blueprint('audit', __name__)


@audit_bp.route('/admin/audit-log')
@login_required
def audit_log():
    if current_user.role not in ('superadmin', 'admin'):
        abort(403)

    page = max(1, int(request.args.get('page', 1)))
    per_page = 50

    q = AuditLog.query

    f_action = request.args.get('action', '').strip()
    f_user = request.args.get('user', '').strip()
    f_entity = request.args.get('entity_type', '').strip()
    f_from = request.args.get('date_from', '').strip()
    f_to = request.args.get('date_to', '').strip()

    if f_action:
        q = q.filter(AuditLog.action.ilike(f'%{f_action}%'))
    if f_user:
        q = q.filter(AuditLog.username.ilike(f'%{f_user}%'))
    if f_entity:
        q = q.filter(AuditLog.entity_type == f_entity)
    if f_from:
        try:
            q = q.filter(AuditLog.created_at >= datetime.fromisoformat(f_from))
        except ValueError:
            pass
    if f_to:
        try:
            q = q.filter(AuditLog.created_at <= datetime.fromisoformat(f_to + 'T23:59:59'))
        except ValueError:
            pass

    total = q.count()
    logs = (q.order_by(AuditLog.created_at.desc())
            .offset((page - 1) * per_page).limit(per_page).all())

    entity_types = [
        r[0] for r in db.session.query(AuditLog.entity_type.distinct())
        .filter(AuditLog.entity_type != '').all()
    ]
    pages = max(1, (total + per_page - 1) // per_page)

    return render_template(
        'admin/audit_log.html',
        logs=logs, page=page, pages=pages, total=total,
        entity_types=sorted(entity_types),
        filters={
            'action': f_action, 'user': f_user,
            'entity_type': f_entity, 'date_from': f_from, 'date_to': f_to,
        },
    )


@audit_bp.route('/admin/audit-log/export.json')
@login_required
def export_audit_json():
    if current_user.role not in ('superadmin', 'admin'):
        abort(403)
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(5000).all()
    return jsonify([{
        'id': l.id, 'username': l.username, 'action': l.action,
        'entity_type': l.entity_type, 'entity_id': l.entity_id,
        'entity_name': l.entity_name, 'ip_address': l.ip_address,
        'created_at': l.created_at.isoformat(),
        'old_values': l.old_values, 'new_values': l.new_values,
    } for l in logs])
