"""
MovieBox Android App - Entry Point (Native WebView Bootstrap)
Runs FastAPI backend on 127.0.0.1:8000 safely on Android.
"""
import asyncio
import os
import sys
import traceback

# Add current directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

LOG_FILE = os.path.join(current_dir, "moviebox_boot.log")

def log(msg: str):
    print(f"[MovieBox] {msg}", flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"{msg}\n")
    except Exception:
        pass

def run_error_server(error_msg: str, port: int = 8000):
    """Fallback HTTP server that displays startup errors on the phone screen."""
    from http.server import HTTPServer, BaseHTTPRequestHandler

    class ErrorHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            html = f"""<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1">
<title>MovieBox Error</title>
<style>
body {{ background: #0d0f17; color: #ff6b6b; font-family: monospace; padding: 20px; }}
h2 {{ color: #e63946; }}
pre {{ background: #161a29; padding: 15px; border-radius: 8px; overflow-x: auto; color: #e0e0e0; font-size: 13px; }}
</style>
</head>
<body>
<h2>MovieBox Startup Error</h2>
<p>An error occurred while starting the local server:</p>
<pre>{error_msg}</pre>
</body>
</html>"""
            self.wfile.write(html.encode("utf-8"))

        def log_message(self, format, *args):
            pass

    log(f"Starting fallback error server on port {port}...")
    try:
        httpd = HTTPServer(("127.0.0.1", port), ErrorHandler)
        httpd.serve_forever()
    except Exception as e:
        log(f"Failed to start error server: {e}")

def main():
    log("Initializing MovieBox Android App...")

    try:
        log("Importing uvicorn and api...")
        import uvicorn
        from api import app

        log("Configuring uvicorn server...")
        config = uvicorn.Config(
            app=app,
            host="127.0.0.1",
            port=8000,
            loop="asyncio",
            lifespan="off",
            log_level="info",
            access_log=False
        )

        server = uvicorn.Server(config)
        # CRITICAL FOR ANDROID:
        # In python-for-android, Python runs in a secondary Java thread.
        # Python's signal.signal() raises ValueError on non-main threads.
        # We disable signal handlers so Uvicorn runs smoothly without crashing.
        server.install_signal_handlers = lambda: None

        log("Starting FastAPI server loop on 127.0.0.1:8000...")
        asyncio.run(server.serve())

    except Exception:
        err = traceback.format_exc()
        log(f"CRITICAL ERROR:\n{err}")
        run_error_server(err, port=8000)

if __name__ == "__main__":
    main()
