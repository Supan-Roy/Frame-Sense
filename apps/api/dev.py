"""
API Development Server Reloader (Windows Isolated Process Group)
===============================================================
Prevents uvicorn reloader from broadcasting CTRL_C_EVENT to parent shell on Windows.
"""
import sys
import os
import time
import subprocess
from watchfiles import watch

API_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(API_DIR, "app")
PYTHON_EXE = os.path.join(API_DIR, ".venv", "Scripts", "python.exe")
if not os.path.exists(PYTHON_EXE):
    PYTHON_EXE = sys.executable


def start_server():
    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
    cmd = [PYTHON_EXE, "-m", "uvicorn", "app.main:app", "--port", "8000"]
    return subprocess.Popen(cmd, cwd=API_DIR, creationflags=creationflags)


def main():
    print("[API RELOADER] Starting FastAPI dev server in isolated process group...")
    proc = start_server()

    try:
        for changes in watch(APP_DIR):
            changed_files = [path for _, path in changes]
            print(f"[API RELOADER] File change detected ({len(changed_files)} file(s)). Reloading FastAPI...")
            if proc and proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
            proc = start_server()
    except KeyboardInterrupt:
        if proc and proc.poll() is None:
            proc.terminate()


if __name__ == "__main__":
    main()
