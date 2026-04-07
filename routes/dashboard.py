from flask import Blueprint, render_template, jsonify
from flask_login import login_required, current_user
from app.models import Ticket, TicketStatus, ActivityLog, Project
from datetime import datetime, timezone, timedelta
from sqlalchemy import func

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/')
@login_required
def index():
    now = datetime.now(timezone.utc)
    week_from_now = now + timedelta(days=7)

    my_open_tickets = Ticket.query.filter(
        Ticket.assigned_to == current_user.id,
        Ticket.status.notin_([TicketStatus.DONE.value, TicketStatus.CANCELLED.value])
    ).order_by(Ticket.updated_at.desc()).all()

    my_created_tickets = Ticket.query.filter(
        Ticket.created_by == current_user.id
    ).order_by(Ticket.created_at.desc()).limit(10).all()

    recent_tickets = Ticket.query.filter(
        Ticket.project_id.in_([p.id for p in current_user.projects])
    ).order_by(Ticket.updated_at.desc()).limit(10).all()

    upcoming_deadlines = Ticket.query.filter(
        Ticket.assigned_to == current_user.id,
        Ticket.status.notin_([TicketStatus.DONE.value, TicketStatus.CANCELLED.value]),
        ((Ticket.soft_deadline != None) & (Ticket.soft_deadline <= week_from_now)) |
        ((Ticket.hard_deadline != None) & (Ticket.hard_deadline <= week_from_now))
    ).order_by(Ticket.hard_deadline.asc().nullslast(), Ticket.soft_deadline.asc().nullslast()).all()

    activity_feed = ActivityLog.query.filter(
        ActivityLog.project_id.in_([p.id for p in current_user.projects])
    ).order_by(ActivityLog.created_at.desc()).limit(15).all()

    status_counts = {}
    for s in TicketStatus:
        count = Ticket.query.filter(
            Ticket.assigned_to == current_user.id,
            Ticket.status == s.value
        ).count()
        if count > 0:
            status_counts[s.value] = count

    overdue_count = 0
    for t in my_open_tickets:
        if t.deadline_urgency() in ('red', 'orange'):
            overdue_count += 1

    due_this_week = len(upcoming_deadlines)

    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    completed_this_month = Ticket.query.filter(
        Ticket.assigned_to == current_user.id,
        Ticket.status == TicketStatus.DONE.value,
        Ticket.resolved_at >= month_start
    ).count()

    projects = current_user.projects

    return render_template('dashboard/index.html',
        my_open_tickets=my_open_tickets,
        my_created_tickets=my_created_tickets,
        recent_tickets=recent_tickets,
        upcoming_deadlines=upcoming_deadlines,
        activity_feed=activity_feed,
        status_counts=status_counts,
        overdue_count=overdue_count,
        due_this_week=due_this_week,
        completed_this_month=completed_this_month,
        projects=projects
    )


@dashboard_bp.route('/api/dashboard/stats')
@login_required
def dashboard_stats():
    now = datetime.now(timezone.utc)
    weeks_data = []
    for i in range(3, -1, -1):
        week_start = now - timedelta(weeks=i+1)
        week_end = now - timedelta(weeks=i)
        count = Ticket.query.filter(
            Ticket.assigned_to == current_user.id,
            Ticket.status == TicketStatus.DONE.value,
            Ticket.resolved_at >= week_start,
            Ticket.resolved_at < week_end
        ).count()
        weeks_data.append({
            'label': f'Week {4-i}',
            'count': count
        })
    return jsonify(weeks_data)
