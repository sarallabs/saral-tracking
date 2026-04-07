import re
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, abort, current_app
from flask_login import login_required, current_user
from app import db
from app.models import (Ticket, TicketStatus, TicketType, TicketPriority, Project, Sprint,
                         Comment, Label, User, UserRole, Attachment, Notification,
                         ticket_labels, ticket_watchers, ActivityLog)
from app.routes import require_role, log_activity, create_notification
from werkzeug.utils import secure_filename
from datetime import datetime, timezone
import os
import mistune

tickets_bp = Blueprint('tickets', __name__)
markdown = mistune.create_markdown()


@tickets_bp.route('/projects/<key>/tickets/new', methods=['GET', 'POST'])
@login_required
@require_role('admin', 'manager', 'developer')
def create_ticket(key):
    project = Project.query.filter_by(key=key).first_or_404()
    if request.method == 'POST':
        title = request.form.get('title', '').strip()
        description = request.form.get('description', '').strip()
        ticket_type = request.form.get('type', TicketType.TASK.value)
        priority = request.form.get('priority', TicketPriority.MEDIUM.value)
        assigned_to = request.form.get('assigned_to') or None
        sprint_id = request.form.get('sprint_id') or None
        parent_id = request.form.get('parent_ticket_id') or None
        story_points = request.form.get('story_points', 0)
        estimated_hours = request.form.get('estimated_hours', 0)
        soft_deadline = request.form.get('soft_deadline') or None
        hard_deadline = request.form.get('hard_deadline') or None
        label_ids = request.form.getlist('labels')

        if not title:
            flash('Title is required.', 'error')
            return redirect(request.url)

        ticket_key = project.next_ticket_key()

        ticket = Ticket(
            title=title, description=description, ticket_key=ticket_key,
            type=ticket_type, priority=priority, project_id=project.id,
            sprint_id=int(sprint_id) if sprint_id else None,
            parent_ticket_id=int(parent_id) if parent_id else None,
            assigned_to=int(assigned_to) if assigned_to else None,
            assigned_by=current_user.id if assigned_to else None,
            created_by=current_user.id,
            story_points=int(story_points) if story_points else 0,
            estimated_hours=float(estimated_hours) if estimated_hours else 0,
        )

        if soft_deadline:
            ticket.soft_deadline = datetime.fromisoformat(soft_deadline)
        if hard_deadline:
            ticket.hard_deadline = datetime.fromisoformat(hard_deadline)

        db.session.add(ticket)
        db.session.flush()

        for lid in label_ids:
            label = Label.query.get(int(lid))
            if label:
                ticket.labels.append(label)

        ticket.watchers.append(current_user)

        log_activity(ticket=ticket, action='ticket_created', new_value=title)

        if assigned_to:
            create_notification(
                int(assigned_to),
                f'You were assigned to {ticket_key}: {title}',
                ticket=ticket, notif_type='assignment',
                link=url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key)
            )

        db.session.commit()
        flash(f'Ticket {ticket_key} created!', 'success')
        return redirect(url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key))

    members = project.members.all()
    sprints = project.sprints.filter(Sprint.status != 'completed').all()
    labels = project.labels.all()
    epics = project.tickets.filter_by(type=TicketType.EPIC.value).all()
    return render_template('tickets/create.html',
        project=project, members=members, sprints=sprints,
        labels=labels, epics=epics)


@tickets_bp.route('/projects/<key>/tickets/<ticket_key>')
@login_required
def ticket_detail(key, ticket_key):
    project = Project.query.filter_by(key=key).first_or_404()
    ticket = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()

    desc_html = markdown(ticket.description) if ticket.description else ''
    comments = ticket.comments.all()
    comments_html = []
    for c in comments:
        comments_html.append({
            'comment': c,
            'html': markdown(c.content) if c.content else ''
        })

    subtasks = ticket.subtasks.all()
    activity = ticket.activity_logs.limit(20).all()
    members = project.members.all()
    sprints = project.sprints.filter(Sprint.status != 'completed').all()
    labels = project.labels.all()
    is_watching = current_user in ticket.watchers

    return render_template('tickets/detail.html',
        project=project, ticket=ticket, desc_html=desc_html,
        comments=comments_html, subtasks=subtasks, activity=activity,
        members=members, sprints=sprints, labels=labels,
        is_watching=is_watching)


@tickets_bp.route('/projects/<key>/tickets/<ticket_key>/edit', methods=['POST'])
@login_required
def edit_ticket(key, ticket_key):
    ticket = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    if not current_user.can_edit_ticket(ticket):
        return jsonify({'error': 'Permission denied'}), 403

    data = request.get_json() if request.is_json else request.form
    field = data.get('field')
    value = data.get('value')

    if field == 'title':
        old = ticket.title
        ticket.title = value
        log_activity(ticket=ticket, action='title_changed', old_value=old, new_value=value)
    elif field == 'description':
        ticket.description = value
        log_activity(ticket=ticket, action='description_changed')
    elif field == 'priority':
        old = ticket.priority
        ticket.priority = value
        log_activity(ticket=ticket, action='priority_changed', old_value=old, new_value=value)
    elif field == 'type':
        old = ticket.type
        ticket.type = value
        log_activity(ticket=ticket, action='type_changed', old_value=old, new_value=value)
    elif field == 'story_points':
        ticket.story_points = int(value) if value else 0
    elif field == 'estimated_hours':
        ticket.estimated_hours = float(value) if value else 0
    elif field == 'soft_deadline':
        if current_user.role in (UserRole.ADMIN.value, UserRole.MANAGER.value, UserRole.DEVELOPER.value):
            old = str(ticket.soft_deadline)
            ticket.soft_deadline = datetime.fromisoformat(value) if value else None
            log_activity(ticket=ticket, action='deadline_updated',
                        old_value=f'soft: {old}', new_value=f'soft: {value}')
    elif field == 'hard_deadline':
        if current_user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
            return jsonify({'error': 'Only managers can change hard deadlines'}), 403
        old = str(ticket.hard_deadline)
        ticket.hard_deadline = datetime.fromisoformat(value) if value else None
        log_activity(ticket=ticket, action='deadline_updated',
                    old_value=f'hard: {old}', new_value=f'hard: {value}')
    elif field == 'sprint_id':
        ticket.sprint_id = int(value) if value else None
        log_activity(ticket=ticket, action='sprint_changed', new_value=value)

    db.session.commit()
    return jsonify({'success': True})


@tickets_bp.route('/projects/<key>/tickets/<ticket_key>/status', methods=['POST'])
@login_required
def change_status(key, ticket_key):
    ticket = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    data = request.get_json() if request.is_json else request.form
    new_status = data.get('status')
    if new_status not in [s.value for s in TicketStatus]:
        return jsonify({'error': 'Invalid status'}), 400

    old_status = ticket.status
    ticket.status = new_status
    if new_status == TicketStatus.DONE.value:
        ticket.resolved_at = datetime.now(timezone.utc)

    log_activity(ticket=ticket, action='status_changed',
                 old_value=old_status, new_value=new_status)

    for watcher in ticket.watchers:
        if watcher.id != current_user.id:
            create_notification(
                watcher.id,
                f'{ticket.ticket_key} status changed: {old_status} → {new_status}',
                ticket=ticket, notif_type='status_change',
                link=url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key)
            )

    db.session.commit()
    if request.is_json:
        return jsonify({'success': True})
    flash('Status updated.', 'success')
    return redirect(url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key))


@tickets_bp.route('/projects/<key>/tickets/<ticket_key>/assign', methods=['POST'])
@login_required
def assign_ticket(key, ticket_key):
    ticket = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    data = request.get_json() if request.is_json else request.form
    user_id = data.get('assigned_to')

    old_assignee = ticket.assigned_to
    ticket.assigned_to = int(user_id) if user_id else None
    ticket.assigned_by = current_user.id

    assignee = User.query.get(int(user_id)) if user_id else None
    log_activity(ticket=ticket, action='assigned',
                 old_value=str(old_assignee), new_value=assignee.username if assignee else 'unassigned')

    if assignee and assignee.id != current_user.id:
        create_notification(
            assignee.id,
            f'You were assigned to {ticket.ticket_key}: {ticket.title}',
            ticket=ticket, notif_type='assignment',
            link=url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key)
        )

    db.session.commit()
    if request.is_json:
        return jsonify({'success': True})
    flash('Ticket assigned.', 'success')
    return redirect(url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key))


@tickets_bp.route('/projects/<key>/tickets/<ticket_key>/comment', methods=['POST'])
@login_required
def add_comment(key, ticket_key):
    ticket = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    data = request.get_json() if request.is_json else request.form
    content = data.get('content', '').strip()
    is_internal = data.get('is_internal', False)

    if not content:
        if request.is_json:
            return jsonify({'error': 'Comment cannot be empty'}), 400
        flash('Comment cannot be empty.', 'error')
        return redirect(url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key))

    comment = Comment(
        ticket_id=ticket.id, author_id=current_user.id,
        content=content, is_internal=bool(is_internal)
    )
    db.session.add(comment)

    log_activity(ticket=ticket, action='comment_added', new_value=content[:100])

    mentions = re.findall(r'@(\w+)', content)
    for username in mentions:
        mentioned_user = User.query.filter_by(username=username).first()
        if mentioned_user and mentioned_user.id != current_user.id:
            create_notification(
                mentioned_user.id,
                f'{current_user.username} mentioned you in {ticket.ticket_key}',
                ticket=ticket, notif_type='mention',
                link=url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key)
            )

    for watcher in ticket.watchers:
        if watcher.id != current_user.id and watcher.username not in mentions:
            create_notification(
                watcher.id,
                f'New comment on {ticket.ticket_key} by {current_user.username}',
                ticket=ticket, notif_type='comment',
                link=url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key)
            )

    db.session.commit()
    if request.is_json:
        return jsonify({
            'success': True,
            'comment': {
                'id': comment.id,
                'content': content,
                'html': markdown(content),
                'author': current_user.full_name,
                'initials': current_user.get_initials(),
                'created_at': comment.created_at.isoformat()
            }
        })
    flash('Comment added.', 'success')
    return redirect(url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key))


@tickets_bp.route('/projects/<key>/tickets/<ticket_key>/log-time', methods=['POST'])
@login_required
def log_time(key, ticket_key):
    ticket = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    data = request.get_json() if request.is_json else request.form
    hours = float(data.get('hours', 0))
    if hours > 0:
        ticket.logged_hours = (ticket.logged_hours or 0) + hours
        log_activity(ticket=ticket, action='time_logged', new_value=f'{hours}h')
        db.session.commit()
    if request.is_json:
        return jsonify({'success': True, 'total_logged': ticket.logged_hours})
    flash(f'{hours}h logged.', 'success')
    return redirect(url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key))


@tickets_bp.route('/projects/<key>/tickets/<ticket_key>/watch', methods=['POST'])
@login_required
def toggle_watch(key, ticket_key):
    ticket = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    if current_user in ticket.watchers:
        ticket.watchers.remove(current_user)
        watching = False
    else:
        ticket.watchers.append(current_user)
        watching = True
    db.session.commit()
    if request.is_json:
        return jsonify({'success': True, 'watching': watching})
    flash('Watch toggled.', 'success')
    return redirect(url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key))


@tickets_bp.route('/projects/<key>/tickets/<ticket_key>/attach', methods=['POST'])
@login_required
def upload_attachment(key, ticket_key):
    ticket = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    file = request.files.get('file')
    if not file or not file.filename:
        flash('No file selected.', 'error')
        return redirect(url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key))

    filename = secure_filename(f"{ticket_key}_{file.filename}")
    path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    file.save(path)

    attachment = Attachment(
        ticket_id=ticket.id, uploaded_by=current_user.id,
        filename=file.filename, file_path=f'/static/uploads/{filename}',
        file_size=os.path.getsize(path), mime_type=file.content_type or ''
    )
    db.session.add(attachment)
    log_activity(ticket=ticket, action='attachment_added', new_value=file.filename)
    db.session.commit()
    flash('File uploaded.', 'success')
    return redirect(url_for('tickets.ticket_detail', key=key, ticket_key=ticket_key))


@tickets_bp.route('/projects/<key>/tickets/<ticket_key>/delete', methods=['POST'])
@login_required
@require_role('admin', 'manager')
def delete_ticket(key, ticket_key):
    ticket = Ticket.query.filter_by(ticket_key=ticket_key).first_or_404()
    db.session.delete(ticket)
    db.session.commit()
    flash(f'Ticket {ticket_key} deleted.', 'success')
    return redirect(url_for('projects.project_backlog', key=key))


@tickets_bp.route('/tickets/search')
@login_required
def search_tickets():
    q = request.args.get('q', '').strip()
    project_key = request.args.get('project')
    status = request.args.get('status')
    assignee = request.args.get('assignee')
    ticket_type = request.args.get('type')

    query = Ticket.query
    if q:
        search_term = f'%{q}%'
        query = query.filter(
            Ticket.title.ilike(search_term) |
            Ticket.description.ilike(search_term) |
            Ticket.ticket_key.ilike(search_term)
        )
    if project_key:
        project = Project.query.filter_by(key=project_key).first()
        if project:
            query = query.filter_by(project_id=project.id)
    if status:
        query = query.filter_by(status=status)
    if assignee:
        query = query.filter_by(assigned_to=int(assignee))
    if ticket_type:
        query = query.filter_by(type=ticket_type)

    tickets = query.order_by(Ticket.updated_at.desc()).limit(50).all()
    projects = Project.query.all()
    users = User.query.filter_by(is_active=True).all()
    return render_template('tickets/search.html',
        tickets=tickets, q=q, projects=projects, users=users)


@tickets_bp.route('/tickets/my')
@login_required
def my_tickets():
    tickets = Ticket.query.filter(
        (Ticket.assigned_to == current_user.id) | (Ticket.created_by == current_user.id)
    ).order_by(Ticket.updated_at.desc()).all()
    return render_template('tickets/my_tickets.html', tickets=tickets)
