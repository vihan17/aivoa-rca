"""AI endpoints: extraction, RCA analysis, chat, evidence-request drafting.

Extraction and analysis stream Server-Sent Events so the UI can render the
LangGraph node progress instead of a blocking spinner.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..ai import mock as demo
from ..ai.graph import run_analysis, run_intake
from ..ai.prompts import chat_prompt, evidence_request_prompt
from ..ai.provider import AIProviderError, get_provider
from ..ai.schemas import ChatResult
from ..db import SessionLocal, get_db
from ..models import AiRun, AuditEvent, Source
from ..services.shaping import compact_record
from ..services.streaming import SSE_HEADERS, stream_run

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ExtractRequest(BaseModel):
    source_id: str
    investigation_id: str | None = None


class AnalyzeRequest(BaseModel):
    payload: dict[str, Any]
    investigation_id: str | None = None


class ChatRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1200)
    payload: dict[str, Any]
    history: list[dict[str, str]] = Field(default_factory=list)


class EvidenceRequestBody(BaseModel):
    gaps: list[dict[str, Any]] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)


def _log_run(kind: str, provider, latency_ms: int, investigation_id: str | None, summary: dict, error: str | None = None) -> None:
    db: Session = SessionLocal()
    try:
        db.add(
            AiRun(
                investigation_id=investigation_id,
                kind=kind,
                provider=provider.name,
                model=provider.model,
                status="failed" if error else "completed",
                result=summary if not error else None,
                error=error,
                latency_ms=latency_ms,
            )
        )
        if investigation_id:
            db.add(
                AuditEvent(
                    investigation_id=investigation_id,
                    actor="RCA Copilot",
                    action=f"ai.{kind}",
                    detail={"provider": provider.info(), "latency_ms": latency_ms, "summary": summary, "error": error},
                )
            )
        db.commit()
    finally:
        db.close()


@router.post("/extract")
def extract(body: ExtractRequest, db: Session = Depends(get_db)):
    source = db.get(Source, body.source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found. Upload the document again.")
    provider = get_provider()
    started = time.perf_counter()
    captured: dict = {}

    async def runner(emit):
        result = await run_intake(provider, emit, source.text, source.kind, source.meta or {})
        captured.update(result)
        return result

    async def generate():
        async for chunk in stream_run(runner):
            yield chunk
        latency = int((time.perf_counter() - started) * 1000)
        summary = {
            "fields": sum(1 for v in captured.get("payload", {}).values() if isinstance(v, str) and v),
            "evidence": len(captured.get("payload", {}).get("evidence", [])),
            "gaps": len(captured.get("payload", {}).get("gaps", [])),
        }
        await asyncio.to_thread(_log_run, "extraction", provider, latency, body.investigation_id, summary)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("/analyze")
def analyze(body: AnalyzeRequest, db: Session = Depends(get_db)):
    payload = body.payload or {}
    if not payload.get("description") and not payload.get("evidence"):
        raise HTTPException(status_code=400, detail="The investigation has no description or evidence to analyse.")
    provider = get_provider()
    started = time.perf_counter()
    captured: dict = {}

    async def runner(emit):
        result = await run_analysis(provider, emit, payload)
        captured.update(result)
        return result

    async def generate():
        async for chunk in stream_run(runner):
            yield chunk
        latency = int((time.perf_counter() - started) * 1000)
        result_payload = captured.get("payload", {})
        summary = {
            "five_whys": len(result_payload.get("five_whys", [])),
            "fishbone": len(result_payload.get("fishbone", [])),
            "root_causes": len(result_payload.get("root_causes", [])),
            "capa": len(result_payload.get("capa", [])),
            "review_issues": len((captured.get("review") or {}).get("issues", [])),
        }
        await asyncio.to_thread(_log_run, "analysis", provider, latency, body.investigation_id, summary)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("/chat")
async def chat(body: ChatRequest) -> dict:
    provider = get_provider()
    record = compact_record(body.payload)
    record["five_whys"] = body.payload.get("five_whys", [])
    record["root_causes"] = body.payload.get("root_causes", [])
    record["capa"] = body.payload.get("capa", [])
    record["gaps"] = body.payload.get("gaps", [])
    if not provider.live:
        result = demo.chat(body.question, record)
    else:
        try:
            result = await provider.json(
                chat_prompt(record, body.question, body.history), ChatResult, fast=True
            )
        except AIProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"answer": result.answer, "provider": provider.info()}


@router.post("/evidence-request")
async def evidence_request(body: EvidenceRequestBody) -> dict:
    provider = get_provider()
    gaps = body.gaps[:8]
    if not gaps:
        raise HTTPException(status_code=400, detail="No open evidence gaps to request.")
    if provider.live:
        try:
            text = await provider.text(evidence_request_prompt(gaps, body.context))
        except AIProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
    else:
        text = demo.email_text(gaps, body.context)
    return {"email": text, "provider": provider.info()}
