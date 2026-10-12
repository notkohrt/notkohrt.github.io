#!/usr/bin/env python3
"""Serve an extracted offline bundle on a secure-context loopback origin."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8123)
args = parser.parse_args()

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.webmanifest': 'application/manifest+json', '.mjs': 'text/javascript'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

server = ThreadingHTTPServer(('127.0.0.1', args.port),
                            partial(Handler, directory=str(Path(__file__).resolve().parent)))
print(f'Open http://localhost:{args.port}/ in your browser; Ctrl-C stops the server.', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
