from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.auth import tailscale_auth_middleware

app = FastAPI(title="Personal Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(tailscale_auth_middleware)


@app.get("/health")
async def health():
    return {"status": "ok"}
