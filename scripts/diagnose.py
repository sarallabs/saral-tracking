"""
Diagnostic script — run on the server via SSH to check app health.

Usage (from inside ~/saral-tracking/):
    python scripts/diagnose.py
"""
import sys
import os
import importlib

_here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _here not in sys.path:
    sys.path.insert(0, _here)

SEP = '-' * 60
PASS = '[PASS]'
FAIL = '[FAIL]'
WARN = '[WARN]'


def check(label, fn):
    try:
        result = fn()
        print(f'{PASS}  {label}', f'({result})' if result else '')
        return True
    except Exception as e:
        print(f'{FAIL}  {label}  ->  {e}')
        return False


print(SEP)
print('SaralTrack Deployment Diagnostics')
print(SEP)

# Python version
check('Python version >= 3.9',
      lambda: (__import__('sys').version_info >= (3, 9)) or
              (_ for _ in ()).throw(RuntimeError(f'Got {sys.version}')))
print(f'       Python: {sys.version}')
print(f'       Executable: {sys.executable}')

print()
print('-- Required packages --')

# import-name → PyPI distribution name (they differ for some packages)
PACKAGES = {
    'flask':            'flask',
    'flask_sqlalchemy': 'flask-sqlalchemy',
    'flask_login':      'flask-login',
    'flask_migrate':    'flask-migrate',
    'flask_wtf':        'flask-wtf',
    'mistune':          'mistune',
    'werkzeug':         'werkzeug',
}

import importlib.metadata as _meta  # noqa: E402  (stdlib, always available)

def _pkg_version(import_name, dist_name):
    """Return version string or raise if the package is not importable."""
    # 1. Try importlib.metadata (most reliable — works even without __version__)
    try:
        return _meta.version(dist_name)
    except _meta.PackageNotFoundError:
        pass
    # 2. Try module.__version__ as fallback
    mod = importlib.import_module(import_name)
    ver = getattr(mod, '__version__', None)
    if ver:
        return ver
    # 3. Package is importable but version unknown — still a PASS
    return 'installed'

for import_name, dist_name in PACKAGES.items():
    check(f'import {import_name}',
          lambda i=import_name, d=dist_name: _pkg_version(i, d))

print()
print('-- Config file --')
check('config.py found', lambda: open(os.path.join(_here, 'config.py')) and 'OK')
check('ProductionConfig importable', lambda: __import__('config').ProductionConfig and 'OK')

print()
print('-- App factory --')
try:
    import types, importlib.util
    _pkg = types.ModuleType('app')
    _pkg.__path__ = [_here]
    _pkg.__package__ = 'app'
    _pkg.__file__ = os.path.join(_here, '__init__.py')
    sys.modules.setdefault('app', _pkg)
    _spec = importlib.util.spec_from_file_location(
        'app', os.path.join(_here, '__init__.py'),
        submodule_search_locations=[_here])
    _spec.loader.exec_module(_pkg)
    from app import create_app
    from config import ProductionConfig
    flask_app = create_app(ProductionConfig)
    print(f'{PASS}  Flask app created  (name={flask_app.name})')
except Exception as e:
    print(f'{FAIL}  Flask app creation failed  ->  {e}')

print()
print('-- Database --')
try:
    with flask_app.app_context():
        from app import db
        db.engine.connect()
        print(f'{PASS}  DB connection OK  ({db.engine.url})')

        from app.models import User
        count = User.query.count()
        print(f'{PASS}  User table accessible  ({count} users)')

        from app.models import UserRole
        supers = User.query.filter_by(role=UserRole.SUPERADMIN.value).count()
        if supers > 0:
            print(f'{PASS}  Superadmin(s) exist  ({supers} found)')
        else:
            print(f'{WARN}  No superadmin found — run scripts/init_admins.py')
except Exception as e:
    print(f'{FAIL}  Database error  ->  {e}')

print()
print('-- Directories & permissions --')
for rel, writable in [
    ('instance',       True),
    ('static/uploads', True),
    ('templates',      False),
    ('routes',         False),
]:
    path = os.path.join(_here, rel)
    exists = os.path.isdir(path)
    if not exists:
        print(f'{WARN}  {rel}/ not found — will be created on first run')
    elif writable and not os.access(path, os.W_OK):
        print(f'{FAIL}  {rel}/ is NOT writable — fix with: chmod 755 {rel}/')
    else:
        print(f'{PASS}  {rel}/ {"writable" if writable else "readable"}')

print()
print('-- Environment variables --')
for var, required in [
    ('SECRET_KEY',  True),
    ('SERVER_NAME', False),
    ('BASE_URL',    False),
    ('MAIL_SERVER', False),
]:
    val = os.environ.get(var, '')
    if val:
        masked = val[:4] + '***' if len(val) > 4 else '***'
        print(f'{PASS}  {var} is set  ({masked})')
    elif required:
        print(f'{WARN}  {var} not set — using default (set it in cPanel env vars)')
    else:
        print(f'       {var} not set (optional)')

print()
print(SEP)
print('Diagnostics complete.')
print(SEP)
