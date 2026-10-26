"""Reference data, demo samples and dashboard aggregates."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..ai.provider import provider_status
from ..config import settings

router = APIRouter(prefix="/api/meta", tags=["meta"])

SAMPLES = [
    {
        "id": "deviation-report",
        "name": "Deviation report",
        "subtitle": "3-page QA deviation report · AT-24118",
        "kind": "pdf",
        "file": "deviation-report.txt",
        "pdf": "deviation-report.pdf",
        "description": "Formal deviation report with batch record extracts, calibration certificate references and change control.",
    },
    {
        "id": "deviation-email",
        "name": "QC email escalation",
        "subtitle": "Email from QC Head to QA · 12 Oct 2026",
        "kind": "email",
        "file": "deviation-email.txt",
        "eml": "deviation-email.eml",
        "description": "Informal escalation email with the key facts, but no structured batch record.",
    },
    {
        "id": "shift-note",
        "name": "Shift handover note",
        "subtitle": "Night shift log · sparse record",
        "kind": "text",
        "file": "shift-note.txt",
        "description": "A short operator note - useful to show how the copilot handles incomplete evidence.",
    },
]


def _sample_dir() -> Path:
    return Path(settings.sample_dir)


@router.get("/options")
def options() -> dict:
    return {
        "classifications": ["Critical", "Major", "Minor"],
        "deviation_types": ["Unplanned", "Planned"],
        "statuses": ["draft", "in_review", "approved", "closed"],
        "capa_types": ["Corrective", "Preventive"],
        "priorities": ["High", "Medium", "Low"],
        "fishbone_categories": ["Man", "Machine", "Material", "Method", "Measurement", "Environment"],
        "rca_methods": ["5 Whys + Fishbone (6M)", "5 Whys", "Fishbone (6M)"],
        "current_user": {
            "name": "Dr. Meera Krishnan",
            "role": "QA Head, Unit 2",
            "initials": "MK",
        },
        "ai": provider_status(),
    }


@router.get("/samples")
def samples() -> dict:
    items = []
    for sample in SAMPLES:
        path = _sample_dir() / sample["file"]
        text = path.read_text(encoding="utf-8") if path.exists() else ""
        items.append({**sample, "text": text, "available": path.exists()})
    return {"items": items}


@router.get("/samples/{sample_id}/file")
def sample_file(sample_id: str):
    sample = next((s for s in SAMPLES if s["id"] == sample_id), None)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found.")
    key = "pdf" if sample["kind"] == "pdf" else sample.get("eml") or sample["file"]
    path = _sample_dir() / key
    if not path.exists():
        raise HTTPException(status_code=404, detail="Sample artifact not generated. Run scripts/generate_samples.py.")
    media = "application/pdf" if key.endswith(".pdf") else "text/plain"
    return FileResponse(path, media_type=media, filename=key)
