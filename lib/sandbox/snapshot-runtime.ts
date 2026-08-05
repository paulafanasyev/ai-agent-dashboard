/**
 * File: lib/sandbox/snapshot-runtime.ts
 * Purpose: Pin and supervise every process required by the reusable desktop snapshot.
 * Problem solved: Makes Xvnc, openbox, websockify, and Chrome reproducible and self-recovering.
 */

export const NOVNC_VERSION = "v1.7.0";
export const WEBSOCKIFY_VERSION = "0.13.0";

export const DESKTOP_STARTUP_SCRIPT = `#!/bin/bash
set -uo pipefail

# Read resolution from env or default
RESOLUTION=\${RESOLUTION:-1024x768}
LOG_DIR=/tmp/agent-desktop
mkdir -p "$LOG_DIR"

supervise() {
  local name="$1"
  shift
  while true; do
    echo "[$(date -Iseconds)] starting $name" >> "$LOG_DIR/supervisor.log"
    "$@" >> "$LOG_DIR/$name.log" 2>&1
    local exit_code=$?
    echo "[$(date -Iseconds)] $name exited with $exit_code; restarting" >> "$LOG_DIR/supervisor.log"
    sleep 1
  done
}

supervise_xvnc() {
  while true; do
    rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
    echo "[$(date -Iseconds)] starting Xvnc" >> "$LOG_DIR/supervisor.log"
    Xvnc :99 -geometry "$RESOLUTION" -depth 24 -SecurityTypes None -AlwaysShared -UseBlacklist=0 -rfbport 5900 >> "$LOG_DIR/xvnc.log" 2>&1
    local exit_code=$?
    echo "[$(date -Iseconds)] Xvnc exited with $exit_code; restarting" >> "$LOG_DIR/supervisor.log"
    sleep 1
  done
}

# Keep every desktop service alive for the lifetime of the Sandbox.
supervise_xvnc &
sleep 1

export DISPLAY=:99

# Set a desktop background color
# NOTE: ctypes.util is not available on AL2023, so load libX11.so.6 directly
python3 -c "
import ctypes
lib = ctypes.cdll.LoadLibrary('libX11.so.6')
d = lib.XOpenDisplay(None)
s = lib.XDefaultScreen(d)
r = lib.XRootWindow(d, s)
lib.XSetWindowBackground(d, r, 0x2D2D2D)
lib.XClearWindow(d, r)
lib.XFlush(d)
lib.XCloseDisplay(d)
" 2>/dev/null || true

# Start and supervise the window manager, noVNC proxy, and Chrome.
supervise openbox env DISPLAY=:99 openbox &
supervise websockify websockify --web /usr/share/novnc 6080 localhost:5900 &
supervise chrome env DISPLAY=:99 google-chrome --no-sandbox --disable-gpu --no-first-run --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile --start-maximized about:blank &

echo "Desktop environment started"
wait
`;
