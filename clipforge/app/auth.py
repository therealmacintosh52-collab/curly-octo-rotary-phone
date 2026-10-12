"""Optional password protection: set CLIPFORGE_PASSWORD in .env and every request needs HTTP Basic
auth (any username). Needed before exposing the app beyond localhost (phone on the same Wi-Fi, a VPS)."""
from __future__ import annotations

import base64
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from . import settings


class BasicAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        password = settings.PASSWORD
        if not password:
            return await call_next(request)
        header = request.headers.get("authorization", "")
        ok = False
        if header.lower().startswith("basic "):
            try:
                decoded = base64.b64decode(header[6:]).decode("utf-8", "replace")
                supplied = decoded.split(":", 1)[1] if ":" in decoded else decoded
                ok = secrets.compare_digest(supplied.encode(), password.encode())
            except Exception:  # noqa: BLE001
                ok = False
        if not ok:
            return Response("ClipForge: password required", status_code=401,
                            headers={"WWW-Authenticate": 'Basic realm="ClipForge", charset="UTF-8"'})
        return await call_next(request)
