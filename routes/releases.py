"""Routes for Versions/Releases, Saved Filters, Custom Fields, and Components."""
import json
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, abort
from flask_login import login_required, current_user
from app import db
from app.models import (Project, Version, VersionStatus, Ticket, TicketStatus,
                         SavedFilter, CustomField, TicketCustomFieldValue, User, Sprint,
                         Component)
from app.routes import require_role, log_activity, log_audit

releases_bp = Blueprint('releases', __name__)


# ── Versions / Releases ────────────────────────────────────────────────────────

@releases_bp.route('/projects/<key>/releases', methods=['GET', 'POST'])
@login_required
def project_releases(key):
    project = Project.query.filter_by(key=key).first_or_404()
    if request.method == 'POST':
        if current_user.role not in ('admin', 'manager'):
            abort(403)
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        release_date = request.form.get('release_date') or None

        if not name:
            flash('Version name is required.', 'error')
            return redirect(url_for('releases.project_releases', key=key))

        v = Version(
            project_id=project.id, name=name, description=description,
            created_by=current_user.id
        )
        if release_date:
            from datetime import datetime
            v.release_date = datetime.fromisoformat(release_date)

        db.session.add(v)
        log_activity(project=project, action='version_created', new_value=name)
        db.session.commit()
        flash(f'Version "{name}" created.', 'success')
        return redirect(url_for('releases.project_releases', key=key))

    versions = Version.query.filter_by(project_id=project.id).order_by(
        Version.release_date.asc().nullslast(), Version.created_at.desc()
    ).all()
    version_stats = {}
    for v in versions:
        total = v.tickets.count()
        done = v.tickets.filter(
            Ticket.status.in_([s.value for s in TicketStatus if s.value in ('done',)])
        ).count()
        version_stats[v.id] = {'total': total, 'done': done}

    return render_template('projects/releases.html',
        project=project, versions=versions, version_stats=version_stats)


@releases_bp.route('/projects/<key>/releases/<int:version_id>', methods=['GET'])
@login_required
def version_detail(key, version_id):
    project = Project.query.filter_by(key=key).first_or_404()
    version = Version.query.get_or_404(version_id)
    if version.project_id != project.id:
        abort(404)

    tickets = version.tickets.order_by(Ticket.status.asc(), Ticket.priority.asc()).all()
    members = project.members.all()

    status_groups = {}
    for t in tickets:
        status_groups.setdefault(t.status, []).append(t)

    total = len(tickets)
    done = sum(1 for t in tickets if t.status == TicketStatus.DONE.value)
    progress = int(done / total * 100) if total > 0 else 0
    total_points = sum(t.story_points or 0 for t in tickets)
    done_points = sum(t.story_points or 0 for t in tickets if t.status == TicketStatus.DONE.value)

    return render_template('projects/version_detail.html',
        project=project, version=version, tickets=tickets, status_groups=status_groups,
        total=total, done=done, progress=progress,
        total_points=total_points, done_points=done_points, members=members)


@releases_bp.route('/projects/<key>/releases/<int:version_id>/edit', methods=['POST'])
@login_required
@require_role('admin', 'manager')
def edit_version(key, version_id):
    project = Project.query.filter_by(key=key).first_or_404()
    version = Version.query.get_or_404(version_id)
    if version.project_id != project.id:
        abort(403)

    data = request.get_json() if request.is_json else request.form
    field = data.get('field')
    value = data.get('value')

    if field == 'status':
        if value in [s.value for s in VersionStatus]:
            version.status = value
            db.session.commit()
    elif field == 'name':
        if value:
            version.name = value
            db.session.commit()
    elif field == 'release_date':
        from datetime import datetime
        version.release_date = datetime.fromisoformat(value) if value else None
        db.session.commit()
    elif field == 'description':
        version.description = value or ''
        db.session.commit()

    if request.is_json:
        return jsonify({'success': True})
    flash('Version updated.', 'success')
    return redirect(url_for('releases.version_detail', key=key, version_id=version_id))


@releases_bp.route('/projects/<key>/releases/<int:version_id>/delete', methods=['POST'])
@login_required
@require_role('admin', 'manager')
def delete_version(key, version_id):
    project = Project.query.filter_by(key=key).first_or_404()
    version = Version.query.get_or_404(version_id)
    if version.project_id != project.id:
        abort(403)

    ticket_count = version.tickets.count()
    if ticket_count > 0:
        flash(f'Cannot delete: {ticket_count} ticket(s) reference this version. Unset the Fix Version first.', 'error')
        return redirect(url_for('releases.project_releases', key=key))

    db.session.delete(version)
    db.session.commit()
    flash(f'Version "{version.name}" deleted.', 'success')
    return redirect(url_for('releases.project_releases', key=key))


# ── Saved Filters ──────────────────────────────────────────────────────────────

@releases_bp.route('/projects/<key>/filters', methods=['POST'])
@login_required
def save_filter(key):
    project = Project.query.filter_by(key=key).first_or_404()
    name = request.form.get('name', '').strip()
    filter_data = {k: v for k, v in request.form.items()
                   if k not in ('csrf_token', 'name', 'is_shared')}
    is_shared = bool(request.form.get('is_shared'))

    if not name:
        flash('Filter name required.', 'error')
        return redirect(url_for('projects.project_backlog', key=key))

    existing = SavedFilter.query.filter_by(
        user_id=current_user.id, project_id=project.id, name=name
    ).first()
    if existing:
        existing.filter_json = json.dumps(filter_data)
        existing.is_shared = is_shared
    else:
        sf = SavedFilter(
            user_id=current_user.id, project_id=project.id,
            name=name, filter_json=json.dumps(filter_data),
            is_shared=is_shared
        )
        db.session.add(sf)

    db.session.commit()
    flash(f'Filter "{name}" saved.', 'success')
    return redirect(url_for('projects.project_backlog', key=key))


@releases_bp.route('/projects/<key>/filters/<int:filter_id>/delete', methods=['POST'])
@login_required
def delete_filter(key, filter_id):
    sf = SavedFilter.query.get_or_404(filter_id)
    if sf.user_id != current_user.id and current_user.role not in ('admin', 'manager'):
        abort(403)
    db.session.delete(sf)
    db.session.commit()
    return jsonify({'success': True})


@releases_bp.route('/api/projects/<key>/filters')
@login_required
def list_filters(key):
    project = Project.query.filter_by(key=key).first_or_404()
    filters = SavedFilter.query.filter(
        SavedFilter.project_id == project.id,
        db.or_(
            SavedFilter.user_id == current_user.id,
            SavedFilter.is_shared == True
        )
    ).order_by(SavedFilter.created_at.desc()).all()
    return jsonify([{
        'id': f.id,
        'name': f.name,
        'filter_json': json.loads(f.filter_json or '{}'),
        'is_shared': f.is_shared,
        'owner': f.owner.full_name if f.owner else '',
        'is_mine': f.user_id == current_user.id,
    } for f in filters])


# ── Custom Fields ──────────────────────────────────────────────────────────────

@releases_bp.route('/projects/<key>/custom-fields', methods=['GET', 'POST'])
@login_required
@require_role('admin', 'manager')
def project_custom_fields(key):
    project = Project.query.filter_by(key=key).first_or_404()
    if request.method == 'POST':
        action = request.form.get('action')

        if action == 'add':
            name = request.form.get('name', '').strip()
            field_type = request.form.get('field_type', 'text')
            required = bool(request.form.get('required'))
            options_raw = request.form.get('options', '').strip()

            if not name:
                flash('Field name required.', 'error')
                return redirect(url_for('releases.project_custom_fields', key=key))

            options = [o.strip() for o in options_raw.split('\n') if o.strip()]
            max_order = db.session.query(
                db.func.max(CustomField.order)
            ).filter_by(project_id=project.id).scalar() or -1

            cf = CustomField(
                project_id=project.id, name=name, field_type=field_type,
                options_json=json.dumps(options), required=required,
                order=max_order + 1
            )
            db.session.add(cf)
            db.session.commit()
            flash(f'Custom field "{name}" added.', 'success')

        return redirect(url_for('releases.project_custom_fields', key=key))

    fields = CustomField.query.filter_by(project_id=project.id).order_by(CustomField.order).all()
    return render_template('projects/custom_fields.html', project=project, fields=fields)


@releases_bp.route('/projects/<key>/custom-fields/<int:field_id>/delete', methods=['POST'])
@login_required
@require_role('admin', 'manager')
def delete_custom_field(key, field_id):
    cf = CustomField.query.get_or_404(field_id)
    project = Project.query.filter_by(key=key).first_or_404()
    if cf.project_id != project.id:
        abort(403)
    db.session.delete(cf)
    db.session.commit()
    flash('Custom field deleted.', 'success')
    return redirect(url_for('releases.project_custom_fields', key=key))


@releases_bp.route('/projects/<key>/tickets/<ticket_key>/custom-fields', methods=['POST'])
@login_required
def save_custom_field_values(key, ticket_key):
    ticket = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    project = Project.query.filter_by(key=key).first_or_404()
    fields = CustomField.query.filter_by(project_id=project.id).all()

    for cf in fields:
        value = request.form.get(f'cf_{cf.id}', '')
        existing = TicketCustomFieldValue.query.filter_by(
            ticket_id=ticket.id, custom_field_id=cf.id
        ).first()
        if existing:
            existing.value_text = value
        else:
            cfv = TicketCustomFieldValue(
                ticket_id=ticket.id, custom_field_id=cf.id, value_text=value
            )
            db.session.add(cfv)

    log_activity(ticket=ticket, action='custom_fields_updated')
    db.session.commit()

    if request.is_json:
        return jsonify({'success': True})
    flash('Custom fields saved.', 'success')
    return redirect(url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key))


# ── Components ─────────────────────────────────────────────────────────────────

@releases_bp.route('/projects/<key>/components', methods=['GET', 'POST'])
@login_required
def project_components(key):
    project = Project.query.filter_by(key=key).first_or_404()

    if request.method == 'POST':
        if current_user.role not in ('admin', 'manager'):
            abort(403)
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        color = request.form.get('color', '#6B7280').strip()
        lead_id = request.form.get('lead_user_id') or None

        if not name:
            flash('Component name is required.', 'error')
            return redirect(url_for('releases.project_components', key=key))

        comp = Component(
            project_id=project.id, name=name, description=description,
            color=color,
            lead_user_id=int(lead_id) if lead_id else None,
        )
        db.session.add(comp)
        log_activity(project=project, action='component_created', new_value=name)
        log_audit('component.create', 'component', entity_name=name,
                  new_values={'project': key, 'name': name})
        db.session.commit()
        flash(f'Component "{name}" created.', 'success')
        return redirect(url_for('releases.project_components', key=key))

    components = Component.query.filter_by(project_id=project.id).order_by(Component.name).all()
    members = project.members.all()
    component_stats = {
        c.id: c.tickets.count() for c in components
    }
    return render_template('projects/components.html',
                           project=project, components=components,
                           members=members, component_stats=component_stats)


@releases_bp.route('/projects/<key>/components/<int:comp_id>/edit', methods=['POST'])
@login_required
@require_role('admin', 'manager')
def edit_component(key, comp_id):
    project = Project.query.filter_by(key=key).first_or_404()
    comp = Component.query.get_or_404(comp_id)
    if comp.project_id != project.id:
        abort(403)

    comp.name = request.form.get('name', comp.name).strip() or comp.name
    comp.description = request.form.get('description', comp.description).strip()
    comp.color = request.form.get('color', comp.color).strip()
    lead_id = request.form.get('lead_user_id') or None
    comp.lead_user_id = int(lead_id) if lead_id else None

    db.session.commit()
    flash('Component updated.', 'success')
    return redirect(url_for('releases.project_components', key=key))


@releases_bp.route('/projects/<key>/components/<int:comp_id>/delete', methods=['POST'])
@login_required
@require_role('admin', 'manager')
def delete_component(key, comp_id):
    project = Project.query.filter_by(key=key).first_or_404()
    comp = Component.query.get_or_404(comp_id)
    if comp.project_id != project.id:
        abort(403)

    ticket_count = comp.tickets.count()
    if ticket_count:
        # Unlink tickets instead of blocking deletion
        comp.tickets.update({'component_id': None}, synchronize_session=False)

    log_audit('component.delete', 'component', comp.id, comp.name)
    db.session.delete(comp)
    db.session.commit()
    flash('Component deleted.', 'success')
    return redirect(url_for('releases.project_components', key=key))
