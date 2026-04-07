from flask import Blueprint, render_template
from flask_login import login_required, current_user
from app.models import User, Ticket, TicketStatus, ActivityLog, Project
from sqlalchemy import func

team_bp = Blueprint('team', __name__)


@team_bp.route('/team')
@login_required
def team_directory():
    users = User.query.filter_by(is_active=True).order_by(User.full_name).all()
    user_stats = []
    for u in users:
        open_count = Ticket.query.filter(
            Ticket.assigned_to == u.id,
            Ticket.status.notin_([TicketStatus.DONE.value, TicketStatus.CANCELLED.value])
        ).count()
        done_count = Ticket.query.filter(
            Ticket.assigned_to == u.id,
            Ticket.status == TicketStatus.DONE.value
        ).count()
        user_stats.append({
            'user': u,
            'open_tickets': open_count,
            'done_tickets': done_count,
            'total': open_count + done_count
        })
    return render_template('team/directory.html', user_stats=user_stats)


@team_bp.route('/team/<int:user_id>')
@login_required
def user_profile(user_id):
    user = User.query.get_or_404(user_id)
    open_tickets = Ticket.query.filter(
        Ticket.assigned_to == user.id,
        Ticket.status.notin_([TicketStatus.DONE.value, TicketStatus.CANCELLED.value])
    ).order_by(Ticket.updated_at.desc()).limit(20).all()
    recent_activity = ActivityLog.query.filter_by(
        user_id=user.id
    ).order_by(ActivityLog.created_at.desc()).limit(15).all()

    status_counts = {}
    for s in TicketStatus:
        c = Ticket.query.filter(Ticket.assigned_to == user.id, Ticket.status == s.value).count()
        if c > 0:
            status_counts[s.value] = c

    return render_template('team/profile.html',
        user=user, open_tickets=open_tickets,
        recent_activity=recent_activity, status_counts=status_counts)


@team_bp.route('/team/workload')
@login_required
def workload():
    users = User.query.filter_by(is_active=True).order_by(User.full_name).all()
    projects = Project.query.all()

    matrix = []
    for u in users:
        row = {'user': u, 'projects': {}}
        for p in projects:
            count = Ticket.query.filter(
                Ticket.assigned_to == u.id,
                Ticket.project_id == p.id,
                Ticket.status.notin_([TicketStatus.DONE.value, TicketStatus.CANCELLED.value])
            ).count()
            row['projects'][p.key] = count
        row['total'] = sum(row['projects'].values())
        matrix.append(row)

    return render_template('team/workload.html',
        matrix=matrix, projects=projects)
