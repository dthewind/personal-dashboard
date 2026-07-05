from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings


async def tailscale_auth_middleware(request: Request, call_next):
    # Tailscale Serve injects these headers
    tailscale_user = request.headers.get("Tailscale-User-Login", "")

    if not tailscale_user:
        # Allow requests without Tailscale headers in local dev
        request.state.user = "dev"
        request.state.is_owner = True
        return await call_next(request)

    request.state.user = tailscale_user
    request.state.is_owner = tailscale_user == settings.owner_tailscale_login

    return await call_next(request)
