from app import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone
import enum


class UserRole(str, enum.Enum):
    SUPERADMIN = 'superadmin'
    ADMIN = 'admin'
    MANAGER = 'manager'
    DEVELOPER = 'developer'
    VIEWER = 'viewer'


class ProjectStatus(str, enum.Enum):
    PLANNING = 'planning'
    ACTIVE = 'active'
    ON_HOLD = 'on_hold'
    COMPLETED = 'completed'
    ARCHIVED = 'archived'


class TicketType(str, enum.Enum):
    STORY = 'story'
    TASK = 'task'
    BUG = 'bug'
    EPIC = 'epic'
    SUBTASK = 'subtask'
    IMPROVEMENT = 'improvement'


class TicketStatus(str, enum.Enum):
    BACKLOG = 'backlog'
    TODO = 'todo'
    IN_PROGRESS = 'in_progress'
    IN_REVIEW = 'in_review'
    TESTING = 'testing'
    DONE = 'done'
    CANCELLED = 'cancelled'


class TicketPriority(str, enum.Enum):
    CRITICAL = 'critical'
    HIGH = 'high'
    MEDIUM = 'medium'
    LOW = 'low'


class SprintStatus(str, enum.Enum):
    PLANNING = 'planning'
    ACTIVE = 'active'
    COMPLETED = 'completed'


class NotificationType(str, enum.Enum):
    ASSIGNMENT = 'assignment'
    MENTION = 'mention'
    DEADLINE_WARNING = 'deadline_warning'
    DEADLINE_BREACH = 'deadline_breach'
    STATUS_CHANGE = 'status_change'
    COMMENT = 'comment'
    LINK = 'link'


class LinkType(str, enum.Enum):
    BLOCKS = 'blocks'
    IS_BLOCKED_BY = 'is_blocked_by'
    DUPLICATES = 'duplicates'
    RELATES_TO = 'relates_to'


DEFAULT_WORKFLOW_STATUSES = [
    {'name': 'Backlog',     'value': 'backlog',     'color': '#6B7280', 'order': 0, 'is_done': False, 'is_cancelled': False},
    {'name': 'To Do',       'value': 'todo',        'color': '#3B82F6', 'order': 1, 'is_done': False, 'is_cancelled': False},
    {'name': 'In Progress', 'value': 'in_progress', 'color': '#F59E0B', 'order': 2, 'is_done': False, 'is_cancelled': False},
    {'name': 'In Review',   'value': 'in_review',   'color': '#8B5CF6', 'order': 3, 'is_done': False, 'is_cancelled': False},
    {'name': 'Testing',     'value': 'testing',     'color': '#EC4899', 'order': 4, 'is_done': False, 'is_cancelled': False},
    {'name': 'Done',        'value': 'done',        'color': '#10B981', 'order': 5, 'is_done': True,  'is_cancelled': False},
    {'name': 'Cancelled',   'value': 'cancelled',   'color': '#EF4444', 'order': 6, 'is_done': False, 'is_cancelled': True},
]


project_members = db.Table('project_members',
    db.Column('id', db.Integer, primary_key=True),
    db.Column('project_id', db.Integer, db.ForeignKey('project.id'), nullable=False),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), nullable=False),
    db.Column('role_in_project', db.String(50), default='developer'),
    db.Column('joined_at', db.DateTime, default=lambda: datetime.now(timezone.utc)),
    db.UniqueConstraint('project_id', 'user_id', name='uq_project_user')
)

ticket_labels = db.Table('ticket_labels',
    db.Column('ticket_id', db.Integer, db.ForeignKey('ticket.id'), primary_key=True),
    db.Column('label_id', db.Integer, db.ForeignKey('label.id'), primary_key=True)
)

ticket_watchers = db.Table('ticket_watchers',
    db.Column('ticket_id', db.Integer, db.ForeignKey('ticket.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
)


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(150), nullable=False)
    avatar_url = db.Column(db.String(500), default='')
    role = db.Column(db.String(20), nullable=False, default=UserRole.DEVELOPER.value)
    is_active = db.Column(db.Boolean, default=True)
    email_notifications = db.Column(db.Boolean, default=True)
    must_change_password = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = db.Column(db.DateTime)

    tickets_assigned = db.relationship('Ticket', foreign_keys='Ticket.assigned_to',
                                        backref='assignee', lazy='dynamic')
    tickets_created = db.relationship('Ticket', foreign_keys='Ticket.created_by',
                                       backref='creator', lazy='dynamic')
    comments = db.relationship('Comment', backref='author', lazy='dynamic')
    projects = db.relationship('Project', secondary=project_members,
                                backref=db.backref('members', lazy='dynamic'))
    notifications = db.relationship('Notification', backref='user', lazy='dynamic',
                                     order_by='Notification.created_at.desc()')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def get_initials(self):
        parts = self.full_name.split()
        if len(parts) >= 2:
            return (parts[0][0] + parts[-1][0]).upper()
        return self.full_name[:2].upper()

    def has_role(self, *roles):
        return self.role in [r.value if isinstance(r, UserRole) else r for r in roles]

    @property
    def is_superadmin(self):
        return self.role == UserRole.SUPERADMIN.value

    @property
    def can_manage(self):
        """True for superadmin, admin, and manager — can create/edit projects, sprints, etc."""
        return self.role in (UserRole.SUPERADMIN.value, UserRole.ADMIN.value, UserRole.MANAGER.value)

    @property
    def can_develop(self):
        """True for superadmin, admin, manager, and developer — can create tickets, log work."""
        return self.role in (UserRole.SUPERADMIN.value, UserRole.ADMIN.value,
                             UserRole.MANAGER.value, UserRole.DEVELOPER.value)

    def can_edit_ticket(self, ticket):
        if self.role in (UserRole.SUPERADMIN.value, UserRole.ADMIN.value, UserRole.MANAGER.value):
            return True
        if self.role == UserRole.DEVELOPER.value:
            return ticket.assigned_to == self.id or ticket.created_by == self.id
        return False

    def __repr__(self):
        return f'<User {self.username}>'


class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    key = db.Column(db.String(10), unique=True, nullable=False, index=True)
    description = db.Column(db.Text, default='')
    status = db.Column(db.String(20), default=ProjectStatus.ACTIVE.value)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    color = db.Column(db.String(7), default='#2D8CFF')
    icon = db.Column(db.String(50), default='folder')
    ticket_counter = db.Column(db.Integer, default=0)

    tickets = db.relationship('Ticket', backref='project', lazy='dynamic',
                               order_by='Ticket.created_at.desc()')
    sprints = db.relationship('Sprint', backref='project', lazy='dynamic',
                               order_by='Sprint.created_at.desc()')
    labels = db.relationship('Label', backref='project', lazy='dynamic')
    owner = db.relationship('User', foreign_keys=[created_by])

    def next_ticket_key(self):
        self.ticket_counter = (self.ticket_counter or 0) + 1
        return f"{self.key}-{self.ticket_counter}"

    def get_workflow_statuses(self):
        """Return custom workflow statuses if configured, else None (use defaults)."""
        custom = WorkflowStatus.query.filter_by(project_id=self.id).order_by(WorkflowStatus.order).all()
        return custom if custom else None

    def get_status_values(self):
        """Return list of status value strings for this project."""
        custom = self.get_workflow_statuses()
        if custom:
            return [s.value for s in custom]
        return [s.value for s in TicketStatus if s != TicketStatus.CANCELLED]

    def __repr__(self):
        return f'<Project {self.key}>'


class Ticket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(300), nullable=False)
    description = db.Column(db.Text, default='')
    ticket_key = db.Column(db.String(20), unique=True, nullable=False, index=True)
    type = db.Column(db.String(20), default=TicketType.TASK.value)
    status = db.Column(db.String(20), default=TicketStatus.BACKLOG.value, index=True)
    priority = db.Column(db.String(20), default=TicketPriority.MEDIUM.value)

    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    sprint_id = db.Column(db.Integer, db.ForeignKey('sprint.id'), nullable=True)
    parent_ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=True)

    assigned_to = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    assigned_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    fix_version_id = db.Column(db.Integer, db.ForeignKey('version.id'), nullable=True)
    component_id = db.Column(db.Integer, db.ForeignKey('component.id'), nullable=True)
    soft_deadline = db.Column(db.DateTime, nullable=True)
    hard_deadline = db.Column(db.DateTime, nullable=True)
    estimated_hours = db.Column(db.Float, default=0)
    logged_hours = db.Column(db.Float, default=0)
    story_points = db.Column(db.Integer, default=0)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    resolved_at = db.Column(db.DateTime, nullable=True)

    subtasks = db.relationship('Ticket', backref=db.backref('parent', remote_side='Ticket.id'),
                                lazy='dynamic')
    comments = db.relationship('Comment', backref='ticket', lazy='dynamic',
                                order_by='Comment.created_at.asc()')
    labels = db.relationship('Label', secondary=ticket_labels, backref='tickets')
    watchers = db.relationship('User', secondary=ticket_watchers,
                                backref=db.backref('watched_tickets', lazy='dynamic'))
    attachments = db.relationship('Attachment', backref='ticket', lazy='dynamic')
    activity_logs = db.relationship('ActivityLog', backref='ticket', lazy='dynamic',
                                     order_by='ActivityLog.created_at.desc()')

    assigner = db.relationship('User', foreign_keys=[assigned_by])
    fix_version = db.relationship('Version', foreign_keys=[fix_version_id],
                                   backref=db.backref('tickets', lazy='dynamic'))
    component = db.relationship('Component', foreign_keys=[component_id],
                                 backref=db.backref('tickets', lazy='dynamic'))

    def deadline_urgency(self):
        """Return urgency level: green, yellow, orange, red, or None."""
        now = datetime.now(timezone.utc)
        if self.status in (TicketStatus.DONE.value, TicketStatus.CANCELLED.value):
            return None

        if self.hard_deadline:
            hard = self.hard_deadline
            if not hard.tzinfo:
                hard = hard.replace(tzinfo=timezone.utc)
            hours_to_hard = (hard - now).total_seconds() / 3600
            if hours_to_hard <= 0 or hours_to_hard <= 24:
                return 'red'

        if self.soft_deadline:
            soft = self.soft_deadline
            if not soft.tzinfo:
                soft = soft.replace(tzinfo=timezone.utc)
            days_to_soft = (soft - now).total_seconds() / 86400

            if self.hard_deadline:
                hard = self.hard_deadline
                if not hard.tzinfo:
                    hard = hard.replace(tzinfo=timezone.utc)
                if now > soft and now < hard:
                    return 'orange'

            if days_to_soft < 0:
                return 'orange'
            elif days_to_soft <= 7:
                return 'yellow'
            else:
                return 'green'

        return None

    def __repr__(self):
        return f'<Ticket {self.ticket_key}>'


class Sprint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    goal = db.Column(db.Text, default='')
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    status = db.Column(db.String(20), default=SprintStatus.PLANNING.value)
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    tickets = db.relationship('Ticket', backref='sprint', lazy='dynamic')
    owner = db.relationship('User', foreign_keys=[created_by])

    def __repr__(self):
        return f'<Sprint {self.name}>'


class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_internal = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    edited = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f'<Comment {self.id} on {self.ticket_id}>'


class ActivityLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    old_value = db.Column(db.Text, default='')
    new_value = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship('User', foreign_keys=[user_id])
    project_rel = db.relationship('Project', foreign_keys=[project_id])

    def __repr__(self):
        return f'<ActivityLog {self.action}>'


class Label(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    color = db.Column(db.String(7), default='#2D8CFF')
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)

    def __repr__(self):
        return f'<Label {self.name}>'


class Attachment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    filename = db.Column(db.String(300), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer, default=0)
    mime_type = db.Column(db.String(100), default='')
    uploaded_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    uploader = db.relationship('User', foreign_keys=[uploaded_by])

    def __repr__(self):
        return f'<Attachment {self.filename}>'


class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=True)
    type = db.Column(db.String(30), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    link = db.Column(db.String(500), default='')

    ticket = db.relationship('Ticket', foreign_keys=[ticket_id])

    def __repr__(self):
        return f'<Notification {self.type} for {self.user_id}>'


class TicketLink(db.Model):
    """Directed link between two tickets (blocks, duplicates, relates_to)."""
    id = db.Column(db.Integer, primary_key=True)
    source_ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=False)
    target_ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=False)
    link_type = db.Column(db.String(30), nullable=False, default=LinkType.RELATES_TO.value)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    source_ticket = db.relationship('Ticket', foreign_keys=[source_ticket_id],
                                     backref=db.backref('outgoing_links', lazy='dynamic',
                                                        cascade='all, delete-orphan'))
    target_ticket = db.relationship('Ticket', foreign_keys=[target_ticket_id],
                                     backref=db.backref('incoming_links', lazy='dynamic',
                                                        cascade='all, delete-orphan'))
    creator = db.relationship('User', foreign_keys=[created_by])

    def inverse_label(self):
        """Human-readable label from the target ticket's perspective."""
        return {
            LinkType.BLOCKS.value: 'is blocked by',
            LinkType.IS_BLOCKED_BY.value: 'blocks',
            LinkType.DUPLICATES.value: 'is duplicated by',
            LinkType.RELATES_TO.value: 'relates to',
        }.get(self.link_type, self.link_type)

    def __repr__(self):
        return f'<TicketLink {self.source_ticket_id} {self.link_type} {self.target_ticket_id}>'


class WorkflowStatus(db.Model):
    """Project-specific workflow status configuration."""
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    value = db.Column(db.String(50), nullable=False)
    color = db.Column(db.String(7), default='#6B7280')
    order = db.Column(db.Integer, default=0)
    is_done = db.Column(db.Boolean, default=False)
    is_cancelled = db.Column(db.Boolean, default=False)

    project = db.relationship('Project',
                               backref=db.backref('workflow_statuses', lazy='dynamic'))

    def __repr__(self):
        return f'<WorkflowStatus {self.value} ({self.project_id})>'


class SavedFilter(db.Model):
    """User-saved search/filter preset for a project's backlog."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    filter_json = db.Column(db.Text, nullable=False, default='{}')
    is_shared = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    owner = db.relationship('User', foreign_keys=[user_id])
    project = db.relationship('Project', foreign_keys=[project_id],
                               backref=db.backref('saved_filters', lazy='dynamic'))

    def __repr__(self):
        return f'<SavedFilter {self.name}>'


class CustomField(db.Model):
    """Project-defined extra field that can be attached to tickets."""
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    field_type = db.Column(db.String(20), nullable=False, default='text')
    options_json = db.Column(db.Text, default='[]')
    required = db.Column(db.Boolean, default=False)
    order = db.Column(db.Integer, default=0)

    project = db.relationship('Project',
                               backref=db.backref('custom_fields', lazy='dynamic',
                                                  order_by='CustomField.order'))
    values = db.relationship('TicketCustomFieldValue', backref='field', lazy='dynamic',
                              cascade='all, delete-orphan')

    def __repr__(self):
        return f'<CustomField {self.name}>'


class TicketCustomFieldValue(db.Model):
    """Value for a custom field on a specific ticket."""
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=False)
    custom_field_id = db.Column(db.Integer, db.ForeignKey('custom_field.id'), nullable=False)
    value_text = db.Column(db.Text, default='')

    ticket = db.relationship('Ticket',
                              backref=db.backref('custom_field_values', lazy='dynamic',
                                                 cascade='all, delete-orphan'))

    def __repr__(self):
        return f'<TicketCustomFieldValue field={self.custom_field_id} ticket={self.ticket_id}>'


class CommentReaction(db.Model):
    """Emoji reaction on a comment."""
    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey('comment.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    emoji = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    comment = db.relationship('Comment',
                               backref=db.backref('reactions', lazy='dynamic',
                                                  cascade='all, delete-orphan'))
    user = db.relationship('User', foreign_keys=[user_id])

    __table_args__ = (
        db.UniqueConstraint('comment_id', 'user_id', 'emoji', name='uq_reaction'),
    )

    def __repr__(self):
        return f'<CommentReaction {self.emoji} on {self.comment_id}>'


class VersionStatus(str, enum.Enum):
    UNRELEASED = 'unreleased'
    RELEASED = 'released'
    ARCHIVED = 'archived'


class Version(db.Model):
    """Project release / version (like Jira Fix Version)."""
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, default='')
    release_date = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default=VersionStatus.UNRELEASED.value)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    project = db.relationship('Project',
                               backref=db.backref('versions', lazy='dynamic'))
    creator = db.relationship('User', foreign_keys=[created_by])

    def __repr__(self):
        return f'<Version {self.name}>'


class Component(db.Model):
    """Project component / module for grouping tickets (like Jira Components)."""
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, default='')
    lead_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    color = db.Column(db.String(7), default='#6B7280')

    project = db.relationship('Project', backref=db.backref('components', lazy='dynamic'))
    lead = db.relationship('User', foreign_keys=[lead_user_id])

    def __repr__(self):
        return f'<Component {self.name}>'


# Permissions available per project role
ALL_PERMISSIONS = [
    'create_ticket', 'edit_any_ticket', 'delete_ticket',
    'manage_sprint', 'manage_members', 'manage_workflow',
    'manage_labels', 'view_internal_comments',
]

DEFAULT_PERMISSIONS = {
    'owner': {p: True for p in ALL_PERMISSIONS},
    'manager': {p: True for p in ALL_PERMISSIONS},
    'developer': {
        'create_ticket': True, 'edit_any_ticket': False, 'delete_ticket': False,
        'manage_sprint': False, 'manage_members': False, 'manage_workflow': False,
        'manage_labels': True, 'view_internal_comments': True,
    },
    'viewer': {p: False for p in ALL_PERMISSIONS},
}


class ProjectPermission(db.Model):
    """Fine-grained per-project role permission overrides."""
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    role = db.Column(db.String(30), nullable=False)
    permissions_json = db.Column(db.Text, default='{}')

    project = db.relationship('Project', backref=db.backref('permissions', lazy='dynamic'))

    __table_args__ = (
        db.UniqueConstraint('project_id', 'role', name='uq_project_role_perm'),
    )

    def get_permissions(self):
        import json as _j
        try:
            return _j.loads(self.permissions_json or '{}')
        except Exception:
            return {}

    def __repr__(self):
        return f'<ProjectPermission {self.project_id}/{self.role}>'


class APIKey(db.Model):
    """User API key for REST API authentication."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    key_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    prefix = db.Column(db.String(8), nullable=False)
    scopes = db.Column(db.String(200), default='read')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_used_at = db.Column(db.DateTime, nullable=True)

    owner = db.relationship('User', foreign_keys=[user_id],
                             backref=db.backref('api_keys', lazy='dynamic'))

    def has_scope(self, scope):
        return scope in self.scopes.split(',')

    def __repr__(self):
        return f'<APIKey {self.prefix}...>'


class AuditLog(db.Model):
    """System-wide audit log for admin visibility of all user actions."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    username = db.Column(db.String(80), default='')
    action = db.Column(db.String(100), nullable=False, index=True)
    entity_type = db.Column(db.String(50), default='')
    entity_id = db.Column(db.Integer, nullable=True)
    entity_name = db.Column(db.String(200), default='')
    ip_address = db.Column(db.String(45), default='')
    user_agent = db.Column(db.String(500), default='')
    old_values = db.Column(db.Text, default='')
    new_values = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    user = db.relationship('User', foreign_keys=[user_id])

    def __repr__(self):
        return f'<AuditLog {self.action} by {self.username}>'
