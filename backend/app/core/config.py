from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost/personal_dashboard"
    cors_origins: list[str] = ["http://localhost:5173"]
    owner_tailscale_login: str = ""  # e.g. owner@tailnetname.ts.net
    require_auth: bool = False  # True in production: reject requests lacking Tailscale identity

    class Config:
        env_file = ".env"


settings = Settings()
