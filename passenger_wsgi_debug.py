"""
TEMPORARY DEBUG entry point — shows Python errors directly in the browser.
USE ONLY FOR DEBUGGING. Remove/replace with passenger_wsgi.py when fixed.

To activate:
  SSH into server → rename files:
    mv passenger_wsgi.py passenger_wsgi_prod.py
    cp passenger_wsgi_debug.py passenger_wsgi.py
    touch tmp/restart.txt

To deactivate after fixing:
    mv passenger_wsgi_prod.py passenger_wsgi.py
    touch tmp/restart.txt
"""
import sys
import os
import traceback
import html as _html

_here = os.path.dirname(os.path.abspath(__file__))

# Capture every error during startup so we can display it
_startup_error = None
_startup_tb = None

try:
    if _here not in sys.path:
        sys.path.insert(0, _here)

    import types
    import importlib.util

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

    from app import create_app
    from config import ProductionConfig
    from werkzeug.middleware.proxy_fix import ProxyFix

    flask_app = create_app(ProductionConfig)
    flask_app.wsgi_app = ProxyFix(flask_app.wsgi_app,
                                   x_for=1, x_proto=1, x_host=1, x_prefix=1)
    application = flask_app

except Exception as e:
    _startup_error = str(e)
    _startup_tb = traceback.format_exc()


# If startup failed, serve a diagnostic HTML page
if _startup_error:
    _env_info = {
        'Python': sys.version,
        'Executable': sys.executable,
        'sys.path': '<br>'.join(_html.escape(p) for p in sys.path),
        'CWD': os.getcwd(),
        'App dir': _here,
        '__file__ exists': str(os.path.isfile(os.path.join(_here, '__init__.py'))),
        'config.py exists': str(os.path.isfile(os.path.join(_here, 'config.py'))),
    }

    def application(environ, start_response):  # noqa: F811
        body = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>SaralTrack — Startup Error</title>
<style>
  body {{font-family: monospace; background:#1a1a2e; color:#eee; padding:2rem; margin:0}}
  h1 {{color:#ef4444}} h2 {{color:#f59e0b; margin-top:2rem}}
  pre {{background:#0d0d1a; padding:1rem; border-radius:6px; overflow-x:auto;
        border-left:4px solid #ef4444; white-space:pre-wrap; word-break:break-word}}
  table {{border-collapse:collapse; width:100%}}
  td {{padding:.4rem .8rem; border:1px solid #333}}
  td:first-child {{color:#94a3b8; width:180px}}
</style></head><body>
<h1>Passenger Startup Error</h1>
<p>The Python application failed to start. Fix the error below, then
   rename <code>passenger_wsgi_prod.py</code> back to <code>passenger_wsgi.py</code>
   and run <code>touch tmp/restart.txt</code>.</p>

<h2>Error</h2>
<pre>{_html.escape(_startup_error)}</pre>

<h2>Full Traceback</h2>
<pre>{_html.escape(_startup_tb)}</pre>

<h2>Environment</h2>
<table>
{''.join(f'<tr><td>{k}</td><td>{v}</td></tr>' for k, v in _env_info.items())}
</table>
</body></html>""".encode()

        start_response('500 Internal Server Error',
                       [('Content-Type', 'text/html; charset=utf-8'),
                        ('Content-Length', str(len(body)))])
        return [body]
