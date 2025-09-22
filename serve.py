#!/usr/bin/env python3
import http.server
import socketserver
import os
import functools
from pathlib import Path

PORT = 8081

# Serve from the directory containing this file (works cross-platform)
WEB_DIR = Path(__file__).resolve().parent

# Prefer setting the directory on the handler instead of changing global CWD
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(WEB_DIR))

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving {WEB_DIR} at http://127.0.0.1:{PORT} (Ctrl+C to stop)")
    httpd.serve_forever()