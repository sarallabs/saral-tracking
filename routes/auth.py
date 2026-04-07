import hashlib
import secrets

from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app, abort
from flask_login import login_user, logout_user, login_required, current_user
from app import db
from app.models import User, UserRole, APIKey, AuditLog
from app.routes import require_role, log_audit
from werkzeug.utils import secure_filename
from datetime import datetime, timezone
import os

auth_bp = Blueprint('auth', __name__)

# Roles that a superadmin can assign to new users
ASSIGNABLE_ROLES = [
    UserRole.ADMIN.value,
    UserRole.MANAGER.value,
    UserRole.DEVELOPER.value,
    UserRole.VIEWER.value,
]


# ── Login / Logout ─────────────────────────────────────────────────────────────

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        remember = request.form.get('remember') == 'on'

        user = User.query.filter(
            (User.username == username) | (User.email == username)
        ).first()

        if user and user.check_password(password):
            if not user.is_active:
                flash('Your account has been deactivated. Contact an admin.', 'error')
                return render_template('auth/login.html')

            login_user(user, remember=remember)
            user.last_login = datetime.now(timezone.utc)
            al = AuditLog(
                user_id=user.id, username=user.username, action='auth.login',
                entity_type='user', entity_id=user.id, entity_name=user.username,
                ip_address=request.remote_addr or '',
                user_agent=request.headers.get('User-Agent', '')[:500],
            )
            db.session.add(al)
            db.session.commit()

            next_page = request.args.get('next')
            if user.must_change_password:
                flash('Please set a new password to continue.', 'warning')
                return redirect(url_for('auth.change_password'))
            return redirect(next_page or url_for('dashboard.index'))

        flash('Invalid username or password.', 'error')

    return render_template('auth/login.html')


@auth_bp.route('/logout')
@login_required
def logout():
    log_audit('auth.logout', 'user', current_user.id, current_user.username)
    db.session.commit()
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))


# ── Registration — disabled for public; superadmin creates users ────────────────

@auth_bp.route('/register')
def register():
    """Public registration is closed. Redirect with explanation."""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))
    flash('Account creation is by invitation only. Contact your administrator.', 'info')
    return redirect(url_for('auth.login'))


# ── Forced password change (must_change_password flag) ─────────────────────────

@auth_bp.route('/change-password', methods=['GET', 'POST'])
@login_required
def change_password():
    if request.method == 'POST':
        new_pass = request.form.get('new_password', '')
        confirm = request.form.get('confirm_password', '')

        errors = []
        if len(new_pass) < 8:
            errors.append('Password must be at least 8 characters.')
        if new_pass != confirm:
            errors.append('Passwords do not match.')

        if errors:
            for e in errors:
                flash(e, 'error')
            return render_template('auth/change_password.html')

        current_user.set_password(new_pass)
        current_user.must_change_password = False
        log_audit('auth.password_changed', 'user', current_user.id, current_user.username)
        db.session.commit()
        flash('Password updated successfully. Welcome!', 'success')
        return redirect(url_for('dashboard.index'))

    return render_template('auth/change_password.html')


# ── Profile ────────────────────────────────────────────────────────────────────

@auth_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        current_user.full_name = request.form.get('full_name', '').strip() or current_user.full_name
        current_user.email = request.form.get('email', '').strip() or current_user.email

        new_password = request.form.get('new_password', '')
        if new_password:
            if len(new_password) < 8:
                flash('Password must be at least 8 characters.', 'error')
                return render_template('auth/profile.html')
            current_user.set_password(new_password)
            current_user.must_change_password = False
            log_audit('auth.password_changed', 'user', current_user.id, current_user.username)

        current_user.email_notifications = bool(request.form.get('email_notifications'))

        avatar = request.files.get('avatar')
        if avatar and avatar.filename:
            filename = secure_filename(f"avatar_{current_user.id}_{avatar.filename}")
            path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            avatar.save(path)
            current_user.avatar_url = f'/static/uploads/{filename}'

        db.session.commit()
        flash('Profile updated.', 'success')
        return redirect(url_for('auth.profile'))

    return render_template('auth/profile.html')


# ── Superadmin: user management ────────────────────────────────────────────────

@auth_bp.route('/users')
@login_required
@require_role('superadmin', 'admin')
def users():
    all_users = User.query.order_by(User.created_at.desc()).all()
    return render_template('auth/users.html', users=all_users,
                           assignable_roles=ASSIGNABLE_ROLES)


@auth_bp.route('/users/create', methods=['GET', 'POST'])
@login_required
def create_user():
    """Only superadmins can create new user accounts."""
    if current_user.role != UserRole.SUPERADMIN.value:
        abort(403)

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        full_name = request.form.get('full_name', '').strip()
        role = request.form.get('role', UserRole.DEVELOPER.value)
        temp_password = request.form.get('temp_password', '')

        errors = []
        if not username or len(username) < 3:
            errors.append('Username must be at least 3 characters.')
        if not email or '@' not in email:
            errors.append('A valid email is required.')
        if not full_name:
            errors.append('Full name is required.')
        if not temp_password or len(temp_password) < 6:
            errors.append('Temporary password must be at least 6 characters.')
        if role not in ASSIGNABLE_ROLES:
            errors.append('Invalid role selected.')
        if User.query.filter_by(username=username).first():
            errors.append(f'Username "{username}" is already taken.')
        if User.query.filter_by(email=email).first():
            errors.append(f'Email "{email}" is already registered.')

        if errors:
            for e in errors:
                flash(e, 'error')
            return render_template('auth/create_user.html',
                                   assignable_roles=ASSIGNABLE_ROLES,
                                   form=request.form)

        user = User(
            username=username, email=email, full_name=full_name,
            role=role, is_active=True, must_change_password=True,
        )
        user.set_password(temp_password)
        db.session.add(user)
        log_audit('user.create', 'user', entity_name=username,
                  new_values={'email': email, 'role': role})
        db.session.commit()

        flash(
            f'Account created for {full_name} (@{username}). '
            f'They must change their password on first login.',
            'success',
        )
        return redirect(url_for('auth.users'))

    return render_template('auth/create_user.html',
                           assignable_roles=ASSIGNABLE_ROLES, form={})


@auth_bp.route('/users/<int:user_id>/toggle-active', methods=['POST'])
@login_required
@require_role('superadmin', 'admin')
def toggle_user_active(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        flash('You cannot deactivate yourself.', 'error')
        return redirect(url_for('auth.users'))
    if user.role == UserRole.SUPERADMIN.value:
        flash('Superadmin accounts cannot be deactivated.', 'error')
        return redirect(url_for('auth.users'))

    user.is_active = not user.is_active
    log_audit(
        'user.deactivate' if not user.is_active else 'user.activate',
        'user', user.id, user.username,
    )
    db.session.commit()
    status = 'activated' if user.is_active else 'deactivated'
    flash(f'User {user.username} {status}.', 'success')
    return redirect(url_for('auth.users'))


@auth_bp.route('/users/<int:user_id>/change-role', methods=['POST'])
@login_required
@require_role('superadmin', 'admin')
def change_user_role(user_id):
    user = User.query.get_or_404(user_id)

    if user.role == UserRole.SUPERADMIN.value:
        flash('The role of a superadmin account cannot be changed here.', 'error')
        return redirect(url_for('auth.users'))

    new_role = request.form.get('role')
    if new_role not in ASSIGNABLE_ROLES:
        flash('Invalid role.', 'error')
        return redirect(url_for('auth.users'))

    old_role = user.role
    user.role = new_role
    log_audit('user.role_changed', 'user', user.id, user.username,
              old_values={'role': old_role}, new_values={'role': new_role})
    db.session.commit()
    flash(f'Role updated to {new_role} for {user.username}.', 'success')
    return redirect(url_for('auth.users'))


@auth_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@login_required
def reset_user_password(user_id):
    """Superadmin resets a user's password to a new temporary one."""
    if current_user.role != UserRole.SUPERADMIN.value:
        abort(403)
    user = User.query.get_or_404(user_id)
    if user.role == UserRole.SUPERADMIN.value and user.id != current_user.id:
        flash('Cannot reset another superadmin\'s password.', 'error')
        return redirect(url_for('auth.users'))

    new_temp = request.form.get('new_temp_password', '').strip()
    if not new_temp or len(new_temp) < 6:
        flash('Temporary password must be at least 6 characters.', 'error')
        return redirect(url_for('auth.users'))

    user.set_password(new_temp)
    user.must_change_password = True
    log_audit('user.password_reset', 'user', user.id, user.username)
    db.session.commit()
    flash(f'Password reset for {user.username}. They will be prompted to change it on next login.', 'success')
    return redirect(url_for('auth.users'))


# ── API Key management ────────────────────────────────────────────────────────

@auth_bp.route('/profile/api-keys', methods=['GET', 'POST'])
@login_required
def api_keys():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        scopes = request.form.get('scopes', 'read').strip() or 'read'
        if not name:
            flash('Key name is required.', 'error')
            return redirect(url_for('auth.api_keys'))

        raw_key = secrets.token_urlsafe(32)
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        prefix = raw_key[:8]

        ak = APIKey(
            user_id=current_user.id, name=name,
            key_hash=key_hash, prefix=prefix, scopes=scopes,
        )
        db.session.add(ak)
        log_audit('apikey.create', 'api_key', entity_name=name)
        db.session.commit()

        flash(f'API key created. Copy it now — it will not be shown again: {raw_key}', 'success')
        return redirect(url_for('auth.api_keys'))

    keys = APIKey.query.filter_by(user_id=current_user.id).order_by(
        APIKey.created_at.desc()
    ).all()
    return render_template('auth/api_keys.html', keys=keys)


@auth_bp.route('/profile/api-keys/<int:key_id>/revoke', methods=['POST'])
@login_required
def revoke_api_key(key_id):
    ak = APIKey.query.get_or_404(key_id)
    if ak.user_id != current_user.id and current_user.role != 'superadmin':
        abort(403)
    ak.is_active = False
    log_audit('apikey.revoke', 'api_key', ak.id, ak.name)
    db.session.commit()
    flash('API key revoked.', 'success')
    return redirect(url_for('auth.api_keys'))


@auth_bp.route('/profile/api-keys/<int:key_id>/delete', methods=['POST'])
@login_required
def delete_api_key(key_id):
    ak = APIKey.query.get_or_404(key_id)
    if ak.user_id != current_user.id and current_user.role != 'superadmin':
        abort(403)
    log_audit('apikey.delete', 'api_key', ak.id, ak.name)
    db.session.delete(ak)
    db.session.commit()
    flash('API key deleted.', 'success')
    return redirect(url_for('auth.api_keys'))
