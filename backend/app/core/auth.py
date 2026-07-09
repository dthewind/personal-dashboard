from fastapi import Request
from starlette.responses import JSONResponse

from app.core.config import settings

# Paths any authenticated tailnet user may hit, even when they're not the
# owner — lets a non-owner see who the backend thinks they are.
OWNER_EXEMPT_PATHS = {"/api/me"}


async def tailscale_auth_middleware(request: Request, call_next):
    # Tailscale Serve injects these headers on every proxied request and
    # strips any client-supplied copies, so they are trustworthy identity —
    # but only when the app is reachable exclusively through Serve
    # (nginx bound to localhost) and require_auth is on.
    tailscale_user = request.headers.get("Tailscale-User-Login", "")

    if not tailscale_user:
        if settings.require_auth:
            # Production: a missing header means the request bypassed
            # Tailscale Serve — reject API access.
            if request.url.path.startswith("/api/"):
                return JSONResponse({"detail": "Not authenticated"}, status_code=401)
            request.state.user = None
            request.state.is_owner = False
            return await call_next(request)
        # Local dev without Tailscale in front
        request.state.user = "dev"
        request.state.is_owner = True
        return await call_next(request)

    request.state.user = tailscale_user
    request.state.is_owner = tailscale_user == settings.owner_tailscale_login

    if (
        settings.require_auth
        and request.url.path.startswith("/api/")
        and request.url.path not in OWNER_EXEMPT_PATHS
        and not request.state.is_owner
    ):
        return JSONResponse({"detail": "Forbidden"}, status_code=403)

    return await call_next(request)
