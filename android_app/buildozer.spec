[app]

# ── Basic metadata ────────────────────────────────────────────────────────────
title = MovieBox
package.name = moviebox
package.domain = com.moviebox.app
version = 1.0.0

# ── Source ────────────────────────────────────────────────────────────────────
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json,html,css,js,woff,woff2,ttf,svg

# Include the full web UI and API
source.include_patterns =
    api.py,
    main.py,
    static/*,
    static/**/*

source.exclude_dirs = tests,bin,__pycache__,.git,scratch

# ── Requirements ──────────────────────────────────────────────────────────────
requirements =
    python3,
    fastapi,
    uvicorn,
    httpx,
    starlette,
    anyio,
    sniffio,
    h11,
    certifi,
    charset-normalizer,
    idna,
    urllib3,
    click,
    typing-extensions

# ── Native Android WebView Bootstrap ──────────────────────────────────────────
# Uses native Android WebView container that serves local FastAPI backend
p4a.bootstrap = webview
p4a.port = 8000

# ── Android config ────────────────────────────────────────────────────────────
android.minapi = 21
android.api = 33
android.ndk = 25b
android.sdk = 33
android.accept_sdk_license = True

android.archs = arm64-v8a

# Permissions
android.permissions =
    INTERNET,
    ACCESS_NETWORK_STATE,
    WRITE_EXTERNAL_STORAGE,
    READ_EXTERNAL_STORAGE,
    FOREGROUND_SERVICE

# ── Orientation & display ─────────────────────────────────────────────────────
orientation = sensor
fullscreen = 0
android.wakelock = True

# ── Build settings ────────────────────────────────────────────────────────────
[buildozer]
log_level = 2
warn_on_root = 1
