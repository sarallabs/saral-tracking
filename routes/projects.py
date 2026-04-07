from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, abort
from flask_login import login_required, current_user
from app import db
from app.models import (Project, ProjectStatus, Ticket, TicketStatus, Sprint, SprintStatus,
                         Label, User, UserRole, ActivityLog, project_members)
from app.routes import require_role, log_activity

projects_bp = Blueprint('projects', __name__)


@projects_bp.route('/projects')
@login_required
def list_projects():
    if current_user.role == UserRole.ADMIN.value:
        projects = Project.query.order_by(Project.created_at.desc()).all()
    else:
        projects = current_user.projects
    return render_template('projects/list.html', projects=projects)


@projects_bp.route('/projects/new', methods=['GET', 'POST'])
@login_required
@require_role('admin', 'manager')
def create_project():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        key = request.form.get('key', '').strip().upper()
        description = request.form.get('description', '').strip()
        color = request.form.get('color', '#2D8CFF')

        errors = []
        if not name:
            errors.append('Project name is required.')
        if not key or len(key) < 2 or len(key) > 10:
            errors.append('Project key must be 2-10 characters.')
        if not key.isalpha():
            errors.append('Project key must contain only letters.')
        if Project.query.filter_by(key=key).first():
            errors.append('Project key already exists.')

        if errors:
            for e in errors:
                flash(e, 'error')
            return render_template('projects/create.html')

        project = Project(
            name=name, key=key, description=description,
            color=color, created_by=current_user.id
        )
        db.session.add(project)
        db.session.flush()

        stmt = project_members.insert().values(
            project_id=project.id, user_id=current_user.id, role_in_project='owner'
        )
        db.session.execute(stmt)

        log_activity(project=project, action='project_created', new_value=name)
        db.session.commit()
        flash(f'Project {name} created!', 'success')
        return redirect(url_for('projects.project_overview', key=key))

    return render_template('projects/create.html')


@projects_bp.route('/projects/<key>')
@login_required
def project_overview(key):
    project = Project.query.filter_by(key=key).first_or_404()
    recent_tickets = project.tickets.limit(10).all()
    active_sprint = Sprint.query.filter_by(
        project_id=project.id, status=SprintStatus.ACTIVE.value
    ).first()

    ticket_stats = {}
    for s in TicketStatus:
        ticket_stats[s.value] = project.tickets.filter_by(status=s.value).count()
    total_tickets = sum(ticket_stats.values())

    recent_activity = ActivityLog.query.filter_by(
        project_id=project.id
    ).order_by(ActivityLog.created_at.desc()).limit(10).all()

    return render_template('projects/overview.html',
        project=project, recent_tickets=recent_tickets,
        active_sprint=active_sprint, ticket_stats=ticket_stats,
        total_tickets=total_tickets, recent_activity=recent_activity)


@projects_bp.route('/projects/<key>/edit', methods=['GET', 'POST'])
@login_required
@require_role('admin', 'manager')
def edit_project(key):
    project = Project.query.filter_by(key=key).first_or_404()
    if request.method == 'POST':
        project.name = request.form.get('name', '').strip() or project.name
        project.description = request.form.get('description', '').strip()
        project.color = request.form.get('color', project.color)
        new_status = request.form.get('status')
        if new_status and new_status in [s.value for s in ProjectStatus]:
            project.status = new_status
        db.session.commit()
        flash('Project updated.', 'success')
        return redirect(url_for('projects.project_overview', key=key))
    return render_template('projects/edit.html', project=project)


@projects_bp.route('/projects/<key>/board')
@login_required
def project_board(key):
    project = Project.query.filter_by(key=key).first_or_404()
    statuses = [s.value for s in TicketStatus if s != TicketStatus.CANCELLED]
    columns = {}
    for s in statuses:
        q = project.tickets.filter_by(status=s)
        assignee = request.args.get('assignee')
        priority = request.args.get('priority')
        ticket_type = request.args.get('type')
        sprint_id = request.args.get('sprint')
        if assignee:
            q = q.filter_by(assigned_to=int(assignee))
        if priority:
            q = q.filter_by(priority=priority)
        if ticket_type:
            q = q.filter_by(type=ticket_type)
        if sprint_id:
            q = q.filter_by(sprint_id=int(sprint_id))
        columns[s] = q.all()

    members = project.members.all()
    sprints = project.sprints.all()
    return render_template('projects/board.html',
        project=project, columns=columns, statuses=statuses,
        members=members, sprints=sprints)


@projects_bp.route('/projects/<key>/backlog')
@login_required
def project_backlog(key):
    project = Project.query.filter_by(key=key).first_or_404()
    q = project.tickets

    status = request.args.get('status')
    priority = request.args.get('priority')
    assignee = request.args.get('assignee')
    ticket_type = request.args.get('type')
    search = request.args.get('search', '').strip()

    if status:
        q = q.filter_by(status=status)
    if priority:
        q = q.filter_by(priority=priority)
    if assignee:
        q = q.filter_by(assigned_to=int(assignee))
    if ticket_type:
        q = q.filter_by(type=ticket_type)
    if search:
        q = q.filter(Ticket.title.ilike(f'%{search}%') | Ticket.ticket_key.ilike(f'%{search}%'))

    tickets = q.order_by(Ticket.created_at.desc()).all()
    members = project.members.all()
    return render_template('projects/backlog.html',
        project=project, tickets=tickets, members=members)


@projects_bp.route('/projects/<key>/roadmap')
@login_required
def project_roadmap(key):
    project = Project.query.filter_by(key=key).first_or_404()
    tickets = project.tickets.filter(
        (Ticket.soft_deadline != None) | (Ticket.hard_deadline != None)
    ).order_by(Ticket.soft_deadline.asc().nullslast()).all()
    return render_template('projects/roadmap.html', project=project, tickets=tickets)


@projects_bp.route('/projects/<key>/members', methods=['GET', 'POST'])
@login_required
def project_members_page(key):
    project = Project.query.filter_by(key=key).first_or_404()
    if request.method == 'POST':
        if current_user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
            abort(403)
        username = request.form.get('username', '').strip()
        role = request.form.get('role', 'developer')
        user = User.query.filter_by(username=username).first()
        if not user:
            flash('User not found.', 'error')
        elif user in project.members.all():
            flash('User already a member.', 'info')
        else:
            stmt = project_members.insert().values(
                project_id=project.id, user_id=user.id, role_in_project=role
            )
            db.session.execute(stmt)
            db.session.commit()
            flash(f'{user.full_name} added to project.', 'success')
        return redirect(url_for('projects.project_members_page', key=key))

    members = db.session.query(User, project_members.c.role_in_project).join(
        project_members, User.id == project_members.c.user_id
    ).filter(project_members.c.project_id == project.id).all()
    all_users = User.query.filter_by(is_active=True).all()
    return render_template('projects/members.html',
        project=project, members=members, all_users=all_users)


@projects_bp.route('/projects/<key>/members/<int:user_id>/remove', methods=['POST'])
@login_required
@require_role('admin', 'manager')
def remove_member(key, user_id):
    project = Project.query.filter_by(key=key).first_or_404()
    stmt = project_members.delete().where(
        (project_members.c.project_id == project.id) &
        (project_members.c.user_id == user_id)
    )
    db.session.execute(stmt)
    db.session.commit()
    flash('Member removed.', 'success')
    return redirect(url_for('projects.project_members_page', key=key))


@projects_bp.route('/projects/<key>/labels', methods=['GET', 'POST'])
@login_required
def project_labels(key):
    project = Project.query.filter_by(key=key).first_or_404()
    if request.method == 'POST':
        if current_user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
            abort(403)
        name = request.form.get('name', '').strip()
        color = request.form.get('color', '#2D8CFF')
        if name:
            label = Label(name=name, color=color, project_id=project.id)
            db.session.add(label)
            db.session.commit()
            flash(f'Label "{name}" created.', 'success')
        return redirect(url_for('projects.project_labels', key=key))

    labels = project.labels.all()
    return render_template('projects/labels.html', project=project, labels=labels)


@projects_bp.route('/projects/<key>/labels/<int:label_id>/delete', methods=['POST'])
@login_required
@require_role('admin', 'manager')
def delete_label(key, label_id):
    label = Label.query.get_or_404(label_id)
    db.session.delete(label)
    db.session.commit()
    flash('Label deleted.', 'success')
    return redirect(url_for('projects.project_labels', key=key))


@projects_bp.route('/projects/<key>/settings', methods=['GET', 'POST'])
@login_required
@require_role('admin', 'manager')
def project_settings(key):
    project = Project.query.filter_by(key=key).first_or_404()
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'archive':
            project.status = ProjectStatus.ARCHIVED.value
            db.session.commit()
            flash('Project archived.', 'success')
            return redirect(url_for('projects.list_projects'))
        elif action == 'delete' and current_user.role == UserRole.ADMIN.value:
            db.session.delete(project)
            db.session.commit()
            flash('Project deleted.', 'success')
            return redirect(url_for('projects.list_projects'))
    return render_template('projects/settings.html', project=project)


@projects_bp.route('/api/projects/<key>/board/move', methods=['POST'])
@login_required
def board_move_ticket(key):
    """AJAX endpoint for drag-and-drop on kanban board."""
    project = Project.query.filter_by(key=key).first_or_404()
    data = request.get_json()
    ticket_id = data.get('ticket_id')
    new_status = data.get('status')

    ticket = Ticket.query.get_or_404(ticket_id)
    if ticket.project_id != project.id:
        return jsonify({'error': 'Ticket not in this project'}), 400

    valid_statuses = [s.value for s in TicketStatus]
    if new_status not in valid_statuses:
        return jsonify({'error': 'Invalid status'}), 400

    old_status = ticket.status
    ticket.status = new_status
    if new_status == TicketStatus.DONE.value:
        from datetime import datetime, timezone
        ticket.resolved_at = datetime.now(timezone.utc)

    log_activity(ticket=ticket, action='status_changed',
                 old_value=old_status, new_value=new_status)
    db.session.commit()
    return jsonify({'success': True, 'old_status': old_status, 'new_status': new_status})
