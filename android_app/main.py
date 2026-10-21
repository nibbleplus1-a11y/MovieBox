"""
MovieBox Android App - Main Entry Point
Starts the FastAPI backend in a background thread and displays the web UI in a WebView.
"""
import os
import sys
import threading
import time

# ─── Kivy config (must be before kivy imports) ──────────────────────────────
os.environ.setdefault("KIVY_NO_ENV_CONFIG", "1")

from kivy.app import App
from kivy.clock import Clock
from kivy.logger import Logger
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.progressbar import ProgressBar


# ─── Android WebView helper ──────────────────────────────────────────────────
try:
    from android.runnable import run_on_ui_thread  # noqa: F401
    from jnius import autoclass

    WebView = autoclass("android.webkit.WebView")
    WebViewClient = autoclass("android.webkit.WebViewClient")
    WebSettings = autoclass("android.webkit.WebSettings")
    LayoutParams = autoclass("android.view.ViewGroup$LayoutParams")
    PythonActivity = autoclass("org.kivy.android.PythonActivity")
    ANDROID = True
except Exception:
    ANDROID = False

SERVER_PORT = 8765
SERVER_URL = f"http://127.0.0.1:{SERVER_PORT}"


# ─── Start the FastAPI server ─────────────────────────────────────────────────
def start_server():
    """Launch the FastAPI/Uvicorn server in a daemon thread."""
    try:
        # Make sure we can import our API
        api_dir = os.path.dirname(os.path.abspath(__file__))
        if api_dir not in sys.path:
            sys.path.insert(0, api_dir)

        import uvicorn
        from api import app as fastapi_app

        Logger.info("MovieBox: Starting FastAPI server on port %s", SERVER_PORT)
        uvicorn.run(
            fastapi_app,
            host="127.0.0.1",
            port=SERVER_PORT,
            log_level="warning",
        )
    except Exception as exc:
        Logger.error("MovieBox: Server failed to start: %s", exc)


def launch_server_thread():
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    return t


# ─── Splash / Loading screen ──────────────────────────────────────────────────
class SplashScreen(BoxLayout):
    def __init__(self, **kwargs):
        super().__init__(orientation="vertical", padding=40, spacing=20, **kwargs)
        from kivy.graphics import Color, Rectangle
        with self.canvas.before:
            Color(0.05, 0.05, 0.08, 1)  # dark background
            self._bg = Rectangle(size=self.size, pos=self.pos)
        self.bind(size=self._update_bg, pos=self._update_bg)

        self.title_label = Label(
            text="[b][color=e63946]Movie[/color][color=ffffff]Box[/color][/b]",
            markup=True,
            font_size="42sp",
            size_hint=(1, 0.4),
        )
        self.status_label = Label(
            text="Starting server...",
            font_size="16sp",
            color=(0.7, 0.7, 0.7, 1),
            size_hint=(1, 0.2),
        )
        self.progress = ProgressBar(max=100, value=0, size_hint=(1, 0.08))
        self.add_widget(self.title_label)
        self.add_widget(self.status_label)
        self.add_widget(self.progress)

    def _update_bg(self, *args):
        self._bg.size = self.size
        self._bg.pos = self.pos

    def set_progress(self, val, text=""):
        self.progress.value = val
        if text:
            self.status_label.text = text


# ─── Main App ─────────────────────────────────────────────────────────────────
class MovieBoxApp(App):
    title = "MovieBox"
    icon = "icon.png"

    def build(self):
        self.splash = SplashScreen()
        self._webview = None
        self._server_ready = False

        # Start server immediately
        launch_server_thread()

        # Poll until server is ready, then open WebView
        Clock.schedule_interval(self._check_server, 1.0)
        return self.splash

    def _check_server(self, dt):
        """Poll the server until it responds, then show the WebView."""
        import socket

        self._progress_val = getattr(self, "_progress_val", 0) + 10
        self._progress_val = min(self._progress_val, 90)
        self.splash.set_progress(self._progress_val, "Starting MovieBox server...")

        try:
            s = socket.create_connection(("127.0.0.1", SERVER_PORT), timeout=1)
            s.close()
            # Server is up!
            self.splash.set_progress(100, "Ready! Loading app...")
            Clock.unschedule(self._check_server)
            Clock.schedule_once(self._open_webview, 0.5)
        except OSError:
            pass  # not ready yet

    def _open_webview(self, dt):
        if ANDROID:
            self._open_android_webview()
        else:
            # Desktop fallback: open in browser
            import webbrowser
            webbrowser.open(SERVER_URL)

    @staticmethod
    def _open_android_webview():
        """Create a full-screen Android WebView and load the app URL."""

        @run_on_ui_thread
        def _create():
            activity = PythonActivity.mActivity
            webview = WebView(activity)
            settings = webview.getSettings()
            settings.setJavaScriptEnabled(True)
            settings.setDomStorageEnabled(True)
            settings.setMediaPlaybackRequiresUserGesture(False)
            settings.setMixedContentMode(0)          # MIXED_CONTENT_ALWAYS_ALLOW
            settings.setCacheMode(2)                  # LOAD_NO_CACHE
            settings.setAllowFileAccess(True)
            settings.setAllowContentAccess(True)
            settings.setLoadWithOverviewMode(True)
            settings.setUseWideViewPort(True)
            settings.setBuiltInZoomControls(False)
            settings.setDisplayZoomControls(False)
            settings.setSupportZoom(False)
            settings.setUserAgentString(
                "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36"
            )

            client = WebViewClient()
            webview.setWebViewClient(client)
            webview.loadUrl(SERVER_URL)

            layout_params = LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT
            )
            activity.addContentView(webview, layout_params)

        _create()


if __name__ == "__main__":
    MovieBoxApp().run()
