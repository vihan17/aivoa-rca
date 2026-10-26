"""Source ingestion endpoints."""
from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Source
from ..services.documents import DocumentError, parse_pasted, parse_upload

router = APIRouter(prefix="/api/sources", tags=["sources"])

MAX_BYTES = 15 * 1024 * 1024


class PasteRequest(BaseModel):
    text: str = Field(min_length=20, max_length=120_000)
    label: str | None = Field(default=None, max_length=120)


def serialize(source: Source) -> dict:
    return {
        "id": source.id,
        "kind": source.kind,
        "filename": source.filename,
        "text": source.text,
        "meta": source.meta or {},
        "created_at": source.created_at.isoformat() if source.created_at else None,
    }


@router.post("/upload")
async def upload_source(file: UploadFile = File(...), db: Session = Depends(get_db)) -> dict:
    filename = Path(file.filename or "upload").name
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 15 MB.")
    try:
        parsed = await asyncio.to_thread(parse_upload, data, filename)
    except DocumentError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    source = Source(
        id=str(uuid.uuid4()),
        kind=parsed.kind,
        filename=parsed.filename,
        text=parsed.text,
        meta=parsed.meta,
    )
    db.add(source)
    db.commit()
    return serialize(source)


@router.post("/text")
async def paste_source(body: PasteRequest, db: Session = Depends(get_db)) -> dict:
    try:
        parsed = parse_pasted(body.text, body.label)
    except DocumentError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    source = Source(
        id=str(uuid.uuid4()),
        kind=parsed.kind,
        filename=parsed.filename,
        text=parsed.text,
        meta=parsed.meta,
    )
    db.add(source)
    db.commit()
    return serialize(source)


@router.get("/{source_id}")
def get_source(source_id: str, db: Session = Depends(get_db)) -> dict:
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found.")
    return serialize(source)
