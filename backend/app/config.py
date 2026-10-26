"""Application configuration.

All secrets are read from backend/.env (never committed).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AIVOA RCA"
    environment: str = "development"

    # MySQL locally; Render supplies a postgres:// URL for the managed database.
    # The password is URL-encoded (# -> %23) in the local DSN.
    database_url: str = (
        "mysql+pymysql://aivoa:AivoaRca%232026@127.0.0.1:3306/aivoa_rca?charset=utf8mb4"
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalise_database_url(cls, value: str) -> str:
        """Use the psycopg driver for Postgres URLs (Render hands out postgres://)."""
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix):]
        return value

    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    groq_fast_model: str = "openai/gpt-oss-20b"
    # auto -> use Groq when a key is present, otherwise the offline demo engine
    ai_provider: str = "auto"
    ai_temperature: float = 0.15
    ai_timeout_seconds: int = 90
    max_source_chars: int = 18000

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    sample_dir: str = str(BASE_DIR.parent / "samples")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def provider_mode(self) -> str:
        mode = (self.ai_provider or "auto").lower()
        if mode == "auto":
            return "groq" if self.groq_api_key.strip() else "mock"
        return mode if mode in {"groq", "mock"} else "mock"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
