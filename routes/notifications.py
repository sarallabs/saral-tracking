from flask import Blueprint, render_template, jsonify, request
from flask_login import login_required, current_user
from app import db
from app.models import Notification, Ticket, User, TicketStatus
from app.routes import create_notification
from datetime import datetime, timezone, timedelta

notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('/api/notifications')
@login_required
def get_notifications():
    notifications = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(Notification.created_at.desc()).limit(10).all()

    return jsonify([{
        'id': n.id,
        'type': n.type,
        'message': n.message,
        'is_read': n.is_read,
        'link': n.link,
        'created_at': n.created_at.isoformat()
    } for n in notifications])


@notifications_bp.route('/api/notifications/unread-count')
@login_required
def unread_count():
    count = Notification.query.filter_by(
        user_id=current_user.id, is_read=False
    ).count()
    return jsonify({'count': count})


@notifications_bp.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
@login_required
def mark_read(notif_id):
    notif = Notification.query.get_or_404(notif_id)
    if notif.user_id != current_user.id:
        return jsonify({'error': 'Forbidden'}), 403
    notif.is_read = True
    db.session.commit()
    return jsonify({'success': True})


@notifications_bp.route('/api/notifications/mark-all-read', methods=['POST'])
@login_required
def mark_all_read():
    Notification.query.filter_by(
        user_id=current_user.id, is_read=False
    ).update({'is_read': True})
    db.session.commit()
    return jsonify({'success': True})


@notifications_bp.route('/notifications')
@login_required
def all_notifications():
    page = request.args.get('page', 1, type=int)
    notifications = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(Notification.created_at.desc()).paginate(
        page=page, per_page=20, error_out=False
    )
    return render_template('team/notifications.html', notifications=notifications)


@notifications_bp.route('/api/check-deadlines', methods=['POST'])
def check_deadlines():
    """Endpoint callable by cron to check deadline warnings/breaches."""
    now = datetime.now(timezone.utc)
    hours_48 = now + timedelta(hours=48)

    tickets_approaching = Ticket.query.filter(
        Ticket.hard_deadline != None,
        Ticket.hard_deadline <= hours_48,
        Ticket.hard_deadline > now,
        Ticket.status.notin_([TicketStatus.DONE.value, TicketStatus.CANCELLED.value])
    ).all()

    for ticket in tickets_approaching:
        existing = Notification.query.filter_by(
            ticket_id=ticket.id, type='deadline_warning'
        ).first()
        if not existing and ticket.assigned_to:
            create_notification(
                ticket.assigned_to,
                f'Hard deadline approaching for {ticket.ticket_key}: {ticket.title}',
                ticket=ticket, notif_type='deadline_warning',
                link=f'/projects/{ticket.project.key}/tickets/{ticket.ticket_key}'
            )
            if ticket.project.created_by and ticket.project.created_by != ticket.assigned_to:
                create_notification(
                    ticket.project.created_by,
                    f'Hard deadline approaching for {ticket.ticket_key} (assigned to {ticket.assignee.username if ticket.assignee else "unassigned"})',
                    ticket=ticket, notif_type='deadline_warning',
                    link=f'/projects/{ticket.project.key}/tickets/{ticket.ticket_key}'
                )

    tickets_breached = Ticket.query.filter(
        Ticket.hard_deadline != None,
        Ticket.hard_deadline <= now,
        Ticket.status.notin_([TicketStatus.DONE.value, TicketStatus.CANCELLED.value])
    ).all()

    for ticket in tickets_breached:
        existing = Notification.query.filter_by(
            ticket_id=ticket.id, type='deadline_breach'
        ).first()
        if not existing and ticket.assigned_to:
            create_notification(
                ticket.assigned_to,
                f'HARD DEADLINE BREACHED for {ticket.ticket_key}: {ticket.title}',
                ticket=ticket, notif_type='deadline_breach',
                link=f'/projects/{ticket.project.key}/tickets/{ticket.ticket_key}'
            )

    db.session.commit()
    return jsonify({
        'checked': True,
        'approaching': len(tickets_approaching),
        'breached': len(tickets_breached)
    })
