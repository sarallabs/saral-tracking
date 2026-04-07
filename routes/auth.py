from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app
from flask_login import login_user, logout_user, login_required, current_user
from app import db
from app.models import User, UserRole
from app.routes import require_role
from werkzeug.utils import secure_filename
from datetime import datetime, timezone
import os

auth_bp = Blueprint('auth', __name__)


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
            db.session.commit()
            next_page = request.args.get('next')
            return redirect(next_page or url_for('dashboard.index'))
        flash('Invalid username or password.', 'error')
    return render_template('auth/login.html')


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))
    if not current_app.config.get('REGISTRATION_OPEN', True):
        flash('Registration is currently closed.', 'info')
        return redirect(url_for('auth.login'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        full_name = request.form.get('full_name', '').strip()
        password = request.form.get('password', '')
        confirm = request.form.get('confirm_password', '')

        errors = []
        if not username or len(username) < 3:
            errors.append('Username must be at least 3 characters.')
        if not email or '@' not in email:
            errors.append('Valid email is required.')
        if not full_name:
            errors.append('Full name is required.')
        if len(password) < 6:
            errors.append('Password must be at least 6 characters.')
        if password != confirm:
            errors.append('Passwords do not match.')
        if User.query.filter_by(username=username).first():
            errors.append('Username already taken.')
        if User.query.filter_by(email=email).first():
            errors.append('Email already registered.')

        if errors:
            for e in errors:
                flash(e, 'error')
            return render_template('auth/register.html')

        user = User(
            username=username,
            email=email,
            full_name=full_name,
            role=UserRole.DEVELOPER.value
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        flash('Account created! Please log in.', 'success')
        return redirect(url_for('auth.login'))

    return render_template('auth/register.html')


@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))


@auth_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        current_user.full_name = request.form.get('full_name', '').strip() or current_user.full_name
        current_user.email = request.form.get('email', '').strip() or current_user.email

        new_password = request.form.get('new_password', '')
        if new_password:
            if len(new_password) < 6:
                flash('Password must be at least 6 characters.', 'error')
                return render_template('auth/profile.html')
            current_user.set_password(new_password)

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


@auth_bp.route('/users')
@login_required
@require_role('admin')
def users():
    all_users = User.query.order_by(User.created_at.desc()).all()
    return render_template('auth/users.html', users=all_users)


@auth_bp.route('/users/<int:user_id>/toggle-active', methods=['POST'])
@login_required
@require_role('admin')
def toggle_user_active(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        flash('Cannot deactivate yourself.', 'error')
    else:
        user.is_active = not user.is_active
        db.session.commit()
        status = 'activated' if user.is_active else 'deactivated'
        flash(f'User {user.username} {status}.', 'success')
    return redirect(url_for('auth.users'))


@auth_bp.route('/users/<int:user_id>/change-role', methods=['POST'])
@login_required
@require_role('admin')
def change_user_role(user_id):
    user = User.query.get_or_404(user_id)
    new_role = request.form.get('role')
    if new_role in [r.value for r in UserRole]:
        user.role = new_role
        db.session.commit()
        flash(f'Role updated to {new_role} for {user.username}.', 'success')
    else:
        flash('Invalid role.', 'error')
    return redirect(url_for('auth.users'))
