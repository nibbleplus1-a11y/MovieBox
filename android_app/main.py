"""
MovieBox Android App - Entry Point (Native WebView Bootstrap)
Runs FastAPI on localhost:8000. The native Android WebView displays the web UI.
"""
import os
import sys

# Add directory containing api.py and dependencies to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

import uvicorn
from api import app

if __name__ == "__main__":
    print("[MovieBox] Starting FastAPI server on 127.0.0.1:8000...")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
        access_log=False
    )
