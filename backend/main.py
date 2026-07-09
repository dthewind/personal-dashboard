from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.auth import tailscale_auth_middleware
from app.modules.budget.router import router as budget_router

app = FastAPI(title="Personal Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(tailscale_auth_middleware)

app.include_router(budget_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/me")
async def me(request: Request):
    return {
        "user": getattr(request.state, "user", None),
        "is_owner": getattr(request.state, "is_owner", False),
    }
