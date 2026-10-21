#!/usr/bin/env python3
"""Static server for the StreamEast clone.

    python serve.py --port 8080

Serves the site with caching disabled so edits show up on reload.
"""

import argparse
import functools
import http.server
import os


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))


def main():
    parser = argparse.ArgumentParser(description="Serve the StreamEast clone.")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument(
        "--dir",
        default=os.path.dirname(os.path.abspath(__file__)),
        help="Directory to serve (defaults to this file's folder).",
    )
    args = parser.parse_args()

    handler = functools.partial(Handler, directory=args.dir)
    with http.server.ThreadingHTTPServer(("", args.port), handler) as server:
        print("serving %s on http://localhost:%d" % (args.dir, args.port))
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
