"""
One-time database initialisation script.

What it does:
  1. Removes ALL existing users from the database.
  2. Creates two superadmin accounts for SaralLabs.

Usage
-----
Run from INSIDE the saral-tracking/ directory:

    python scripts/init_admins.py

Passwords are read from environment variables.  If the variables are not set
the script will prompt you interactively (input is hidden):

    RAHMAN_PASS       password for rahman@sarallabs.com
    SARAL_ADMIN_PASS  password for admin@sarallabs.com

Example (PowerShell):
    $env:RAHMAN_PASS="YourPassword1"; $env:SARAL_ADMIN_PASS="YourPassword2"
    python scripts/init_admins.py

Example (bash/macOS/Linux):
    RAHMAN_PASS="YourPassword1" SARAL_ADMIN_PASS="YourPassword2" python scripts/init_admins.py
"""

import sys
import os
import getpass
import types
import importlib.util

# ── Bootstrap: register this directory as the 'app' package ───────────────────
_here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Make config.py importable (it lives in _here)
if _here not in sys.path:
    sys.path.insert(0, _here)

if 'app' not in sys.modules:
    _pkg = types.ModuleType('app')
    _pkg.__path__ = [_here]
    _pkg.__package__ = 'app'
    _pkg.__file__ = os.path.join(_here, '__init__.py')
    sys.modules['app'] = _pkg

    _spec = importlib.util.spec_from_file_location(
        'app',
        os.path.join(_here, '__init__.py'),
        submodule_search_locations=[_here],
    )
    _spec.loader.exec_module(_pkg)

# ── Now safe to import app modules ────────────────────────────────────────────
from app import create_app, db          # noqa: E402
from app.models import User, UserRole   # noqa: E402


def _get_password(env_var, prompt_label):
    """Return password from env var, or prompt the user (hidden input)."""
    pw = os.environ.get(env_var, '').strip()
    if pw:
        print(f'  [{env_var}] read from environment variable.')
        return pw
    while True:
        pw = getpass.getpass(f'  Enter password for {prompt_label}: ').strip()
        if len(pw) >= 8:
            return pw
        print('  Password must be at least 8 characters. Please try again.')


def main():
    app = create_app()
    with app.app_context():
        print('\n=== SaralTrack — Superadmin Initialisation ===\n')

        # 1. Remove all existing users
        count = User.query.count()
        if count:
            confirm = input(
                f'  This will DELETE all {count} existing user(s). '
                'Type "yes" to confirm: '
            ).strip().lower()
            if confirm != 'yes':
                print('  Aborted.')
                return
            User.query.delete()
            db.session.commit()
            print(f'  Removed {count} user(s).\n')

        # 2. Collect passwords
        print('Collecting passwords for the two superadmin accounts:\n')
        rahman_pass = _get_password('RAHMAN_PASS', 'rahman@sarallabs.com')
        admin_pass  = _get_password('SARAL_ADMIN_PASS', 'admin@sarallabs.com')

        # 3. Create superadmin accounts
        admins = [
            dict(username='rahman',      email='rahman@sarallabs.com',
                 full_name='Rahman',     password=rahman_pass),
            dict(username='saraldmin',   email='admin@sarallabs.com',
                 full_name='SaralAdmin', password=admin_pass),
        ]

        print()
        for a in admins:
            u = User(
                username=a['username'],
                email=a['email'],
                full_name=a['full_name'],
                role=UserRole.SUPERADMIN.value,
                is_active=True,
                must_change_password=False,
                email_notifications=True,
            )
            u.set_password(a['password'])
            db.session.add(u)
            print(f'  [OK] Created superadmin: {a["email"]}  (@{a["username"]})')

        db.session.commit()
        print('\n  All done. You can now log in at /login.\n')


if __name__ == '__main__':
    main()
