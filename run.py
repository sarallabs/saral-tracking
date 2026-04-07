"""
Entry point for SaralTrack.

Run development server:
    python run.py

Or with Flask CLI:
    set FLASK_APP=run.py
    flask run
"""
import sys
import os
import types
import importlib.util

# ---------------------------------------------------------------------------
# Register this directory as the 'app' Python package so that internal
# imports like "from app import db" resolve correctly even though the
# project folder is named 'saral-tracking' (which has a hyphen and cannot
# be imported directly by Python).
# ---------------------------------------------------------------------------
_here = os.path.dirname(os.path.abspath(__file__))

# Make config.py and other top-level modules importable
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

from app import create_app  # noqa: E402  (path manipulation must happen first)

application = create_app()

if __name__ == '__main__':
    application.run(
        debug=os.environ.get('FLASK_DEBUG', '1') == '1',
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
    )
