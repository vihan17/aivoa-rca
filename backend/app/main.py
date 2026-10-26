"""AIVOA RCA - FastAPI application entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import settings
from .db import engine, init_db
from .routers import ai, investigations, meta, sources
from .seed import seed_if_empty

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("aivoa.rca")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    try:
        seed_if_empty()
    except Exception as exc:  # seeding must never block startup
        logger.warning("Seed skipped: %s", exc)
    logger.info("AIVOA RCA ready - database=%s ai=%s", settings.database_url.split("@")[-1], settings.provider_mode)
    yield


app = FastAPI(
    title="AIVOA RCA API",
    version="1.0.0",
    description="AI-powered Root Cause Analysis and CAPA for API manufacturing.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sources.router)
app.include_router(ai.router)
app.include_router(investigations.router)
app.include_router(meta.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    from .ai.provider import provider_status

    return {
        "status": "ok" if db_ok else "degraded",
        "database": "up" if db_ok else "down",
        "ai": provider_status(),
        "app": settings.app_name,
    }


@app.exception_handler(Exception)
async def unhandled_error(_: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Unexpected server error. Check the API logs."})


# ---- Serve the built SPA (single-command demo) -------------------------------
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        target = DIST / path
        if path and target.is_file():
            return FileResponse(target)
        return FileResponse(DIST / "index.html")
