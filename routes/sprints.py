from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Sprint, SprintStatus, Project, Ticket, TicketStatus
from app.routes import require_role, log_activity
from datetime import datetime

sprints_bp = Blueprint('sprints', __name__)


@sprints_bp.route('/projects/<key>/sprints/new', methods=['GET', 'POST'])
@login_required
@require_role('admin', 'manager')
def create_sprint(key):
    project = Project.query.filter_by(key=key).first_or_404()
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        goal = request.form.get('goal', '').strip()
        start_date = request.form.get('start_date')
        end_date = request.form.get('end_date')

        if not name:
            flash('Sprint name is required.', 'error')
            return redirect(request.url)

        sprint = Sprint(
            name=name, goal=goal, project_id=project.id,
            created_by=current_user.id
        )
        if start_date:
            sprint.start_date = datetime.fromisoformat(start_date)
        if end_date:
            sprint.end_date = datetime.fromisoformat(end_date)

        db.session.add(sprint)
        log_activity(project=project, action='sprint_created', new_value=name)
        db.session.commit()
        flash(f'Sprint "{name}" created!', 'success')
        return redirect(url_for('sprints.sprint_detail', key=key, sprint_id=sprint.id))

    return render_template('sprints/create.html', project=project)


@sprints_bp.route('/projects/<key>/sprints/<int:sprint_id>')
@login_required
def sprint_detail(key, sprint_id):
    project = Project.query.filter_by(key=key).first_or_404()
    sprint = Sprint.query.get_or_404(sprint_id)
    statuses = [s.value for s in TicketStatus if s != TicketStatus.CANCELLED]
    columns = {}
    for s in statuses:
        columns[s] = sprint.tickets.filter_by(status=s).all()

    backlog_tickets = project.tickets.filter(
        Ticket.sprint_id == None,
        Ticket.status != TicketStatus.DONE.value,
        Ticket.status != TicketStatus.CANCELLED.value
    ).all()

    total = sprint.tickets.count()
    done = sprint.tickets.filter_by(status=TicketStatus.DONE.value).count()
    progress = int((done / total * 100)) if total > 0 else 0

    return render_template('sprints/detail.html',
        project=project, sprint=sprint, columns=columns,
        statuses=statuses, backlog_tickets=backlog_tickets,
        total=total, done=done, progress=progress)


@sprints_bp.route('/projects/<key>/sprints/<int:sprint_id>/start', methods=['POST'])
@login_required
@require_role('admin', 'manager')
def start_sprint(key, sprint_id):
    project = Project.query.filter_by(key=key).first_or_404()
    active = Sprint.query.filter_by(
        project_id=project.id, status=SprintStatus.ACTIVE.value
    ).first()
    if active:
        flash('Complete the active sprint first.', 'error')
        return redirect(url_for('sprints.sprint_detail', key=key, sprint_id=sprint_id))

    sprint = Sprint.query.get_or_404(sprint_id)
    sprint.status = SprintStatus.ACTIVE.value
    if not sprint.start_date:
        from datetime import timezone
        sprint.start_date = datetime.now(timezone.utc)
    log_activity(project=project, action='sprint_started', new_value=sprint.name)
    db.session.commit()
    flash(f'Sprint "{sprint.name}" started!', 'success')
    return redirect(url_for('sprints.sprint_detail', key=key, sprint_id=sprint_id))


@sprints_bp.route('/projects/<key>/sprints/<int:sprint_id>/complete', methods=['POST'])
@login_required
@require_role('admin', 'manager')
def complete_sprint(key, sprint_id):
    project = Project.query.filter_by(key=key).first_or_404()
    sprint = Sprint.query.get_or_404(sprint_id)
    action = request.form.get('incomplete_action', 'backlog')

    incomplete = sprint.tickets.filter(
        Ticket.status != TicketStatus.DONE.value,
        Ticket.status != TicketStatus.CANCELLED.value
    ).all()

    if action == 'backlog':
        for t in incomplete:
            t.sprint_id = None
    elif action == 'next':
        next_sprint = Sprint.query.filter(
            Sprint.project_id == project.id,
            Sprint.id != sprint.id,
            Sprint.status != SprintStatus.COMPLETED.value
        ).first()
        if next_sprint:
            for t in incomplete:
                t.sprint_id = next_sprint.id

    sprint.status = SprintStatus.COMPLETED.value
    log_activity(project=project, action='sprint_completed', new_value=sprint.name)
    db.session.commit()
    flash(f'Sprint "{sprint.name}" completed! {len(incomplete)} incomplete tickets moved.', 'success')
    return redirect(url_for('projects.project_overview', key=key))


@sprints_bp.route('/projects/<key>/sprints/<int:sprint_id>/add-ticket', methods=['POST'])
@login_required
def add_ticket_to_sprint(key, sprint_id):
    data = request.get_json() if request.is_json else request.form
    ticket_id = data.get('ticket_id')
    ticket = Ticket.query.get_or_404(int(ticket_id))
    ticket.sprint_id = sprint_id
    log_activity(ticket=ticket, action='sprint_changed', new_value=str(sprint_id))
    db.session.commit()
    if request.is_json:
        return jsonify({'success': True})
    flash('Ticket added to sprint.', 'success')
    return redirect(url_for('sprints.sprint_detail', key=key, sprint_id=sprint_id))


@sprints_bp.route('/projects/<key>/sprints/<int:sprint_id>/remove-ticket', methods=['POST'])
@login_required
def remove_ticket_from_sprint(key, sprint_id):
    data = request.get_json() if request.is_json else request.form
    ticket_id = data.get('ticket_id')
    ticket = Ticket.query.get_or_404(int(ticket_id))
    ticket.sprint_id = None
    db.session.commit()
    if request.is_json:
        return jsonify({'success': True})
    flash('Ticket removed from sprint.', 'success')
    return redirect(url_for('sprints.sprint_detail', key=key, sprint_id=sprint_id))
