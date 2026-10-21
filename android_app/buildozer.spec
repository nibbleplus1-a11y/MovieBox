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
# NOTE: curl_cffi does NOT work on Android; httpx is used as fallback.
requirements =
    python3,
    kivy==2.3.0,
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

# ── Android config ────────────────────────────────────────────────────────────
android.minapi = 21
android.api = 33
android.ndk = 25b
android.sdk = 33
android.accept_sdk_license = True

android.archs = arm64-v8a, armeabi-v7a

# Permissions
android.permissions =
    INTERNET,
    ACCESS_NETWORK_STATE,
    WRITE_EXTERNAL_STORAGE,
    READ_EXTERNAL_STORAGE,
    FOREGROUND_SERVICE

# ── Orientation & display ─────────────────────────────────────────────────────
orientation = portrait
fullscreen = 0
android.wakelock = True

# ── Icons & presplash ─────────────────────────────────────────────────────────
# icon.filename = %(source.dir)s/icon.png
# presplash.filename = %(source.dir)s/presplash.png

# ── Build settings ────────────────────────────────────────────────────────────
[buildozer]
log_level = 2
warn_on_root = 1
