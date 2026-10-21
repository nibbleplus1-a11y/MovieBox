#!/usr/bin/env bash
# =============================================================================
#  MovieBox Android Build Script
#  Requires: Linux/macOS or WSL2 on Windows
# =============================================================================
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${CYAN}[MovieBox]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── 1. Check we are on Linux / WSL ───────────────────────────────────────────
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    warn "Buildozer must run on Linux or WSL2."
    warn "On Windows, open WSL2 and run this script from there."
    err  "Unsupported OS: $OSTYPE"
fi

# ── 2. Install system dependencies ───────────────────────────────────────────
log "Installing system dependencies…"
sudo apt-get update -qq
sudo apt-get install -y -qq \
    python3 python3-pip python3-venv \
    git zip unzip openjdk-17-jdk \
    build-essential libssl-dev libffi-dev \
    libsqlite3-dev zlib1g-dev libbz2-dev \
    autoconf libtool pkg-config \
    cmake libltdl-dev > /dev/null
ok "System deps installed."

# ── 3. Create / activate venv ────────────────────────────────────────────────
VENV_DIR="$HOME/.moviebox_build_venv"
if [ ! -d "$VENV_DIR" ]; then
    log "Creating Python virtual environment…"
    python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"
ok "venv active: $VENV_DIR"

# ── 4. Install Buildozer & Cython ────────────────────────────────────────────
log "Installing buildozer & cython…"
pip install --upgrade pip wheel setuptools > /dev/null
pip install buildozer cython > /dev/null
ok "Buildozer $(buildozer --version) installed."

# ── 5. Copy app sources into build dir ───────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$SCRIPT_DIR/build_workspace"

log "Copying sources to build workspace: $BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy app files
cp "$SCRIPT_DIR/main.py"        "$BUILD_DIR/"
cp "$SCRIPT_DIR/buildozer.spec" "$BUILD_DIR/"
cp "$PROJECT_ROOT/api.py"       "$BUILD_DIR/"

# Copy static web assets
mkdir -p "$BUILD_DIR/static"
cp -r "$PROJECT_ROOT/static/." "$BUILD_DIR/static/"
ok "Sources copied."

# ── 6. Run Buildozer ─────────────────────────────────────────────────────────
log "Starting Buildozer — this takes 15-30 min on first run…"
cd "$BUILD_DIR"
buildozer -v android debug

# ── 7. Find and report APK ───────────────────────────────────────────────────
APK=$(find "$BUILD_DIR/bin" -name "*.apk" | head -1)
if [ -n "$APK" ]; then
    ok "APK built successfully!"
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  APK Location:${NC}"
    echo -e "${GREEN}║  ${APK}${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    log "Copy to phone: adb install \"$APK\""
else
    err "Build finished but APK not found. Check buildozer logs above."
fi
