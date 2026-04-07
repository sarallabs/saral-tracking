"""
Phusion Passenger WSGI entry point for GoDaddy shared hosting.

GoDaddy cPanel → Setup Python App → Startup file: passenger_wsgi.py
                                  → Application entry point: application
"""
import sys
import os
import types
import importlib.util

# ── 1. Bootstrap: make this directory importable as the 'app' package ─────────
_here = os.path.dirname(os.path.abspath(__file__))

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

# ── 2. Create the Flask app with production config ────────────────────────────
os.environ.setdefault('FLASK_ENV', 'production')

from app import create_app                              # noqa: E402
from config import ProductionConfig                     # noqa: E402
from werkzeug.middleware.proxy_fix import ProxyFix      # noqa: E402

flask_app = create_app(ProductionConfig)

# Trust one level of reverse-proxy headers (Apache → Passenger → Flask)
flask_app.wsgi_app = ProxyFix(
    flask_app.wsgi_app,
    x_for=1,      # X-Forwarded-For  → remote_addr
    x_proto=1,    # X-Forwarded-Proto → request.scheme
    x_host=1,     # X-Forwarded-Host  → request.host
    x_prefix=1,   # X-Forwarded-Prefix → SCRIPT_NAME
)

# ── 3. Expose 'application' — the variable Passenger looks for ────────────────
application = flask_app
