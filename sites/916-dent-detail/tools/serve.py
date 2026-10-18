#!/usr/bin/env python3
"""Local static preview that behaves like the host: clean URLs, 404.html with a 404 status, the rules from _headers
(CSP included, so a blocked resource shows up here), gzip. HSTS and upgrade-insecure-requests are dropped because the
preview is plain http.   python3 tools/serve.py [port] [dir]"""
import gzip
import mimetypes
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
import os
import ssl
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
TLS = os.environ.get("TLS_CERT") and os.environ.get("TLS_KEY")
PUB = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "public"
mimetypes.add_type("image/avif", ".avif")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("application/manifest+json", ".webmanifest")


def rules():
    out, cur = [], None
    for line in (PUB / "_headers").read_text().splitlines():
        if not line.strip():
            continue
        if not line.startswith(" "):
            cur = (line.strip(), {})
            out.append(cur)
        else:
            k, v = line.strip().split(":", 1)
            cur[1][k.strip()] = v.strip()
    return out


def match(pat, path):
    if pat.endswith("/*"):
        return path.startswith(pat[:-1])
    return pat == path


class H(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split("?")[0].split("#")[0]
        f = PUB / path.lstrip("/")
        status = 200
        if path.endswith("/"):
            f = f / "index.html"
        elif f.is_dir():
            self.send_response(301)
            self.send_header("Location", path + "/")
            self.end_headers()
            return
        if not f.is_file():
            f = PUB / "404.html"
            status = 404
        data = f.read_bytes()
        ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/xml", "application/json", "application/manifest+json", "image/svg+xml"):
            ctype += "; charset=utf-8" if "charset" not in ctype else ""
        hdr = {}
        for pat, h in rules():
            if match(pat, path):
                hdr.update(h)
        if not TLS:
            hdr.pop("Strict-Transport-Security", None)
            hdr.pop("Cross-Origin-Opener-Policy", None)
        if "Content-Security-Policy" in hdr and not TLS:
            hdr["Content-Security-Policy"] = hdr["Content-Security-Policy"].replace("; upgrade-insecure-requests", "")
        self.send_response(status)
        self.send_header("Content-Type", hdr.pop("Content-Type", ctype))
        if "gzip" in self.headers.get("Accept-Encoding", "") and ctype.split(";")[0] in ("text/html", "text/css", "text/javascript", "application/javascript", "application/xml", "text/plain", "image/svg+xml", "application/json"):
            data = gzip.compress(data, 6)
            self.send_header("Content-Encoding", "gzip")
        if "Cache-Control" not in hdr:
            hdr["Cache-Control"] = "no-cache"
        for k, v in hdr.items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    print("serving %s on http://localhost:%d" % (PUB, PORT))
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), H)
    if TLS:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(os.environ["TLS_CERT"], os.environ["TLS_KEY"])
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    srv.serve_forever()
