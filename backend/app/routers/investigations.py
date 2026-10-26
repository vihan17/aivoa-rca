"""Investigation CRUD, sign-off and audit trail."""
from __future__ import annotations

import secrets
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AiRun, AuditEvent, Investigation, Source
from ..services.shaping import blank_payload

router = APIRouter(prefix="/api/investigations", tags=["investigations"])

STATUSES = {"draft", "in_review", "approved", "closed"}


class CreateRequest(BaseModel):
    payload: dict[str, Any]
    provenance: dict[str, Any] = Field(default_factory=dict)
    ai_meta: dict[str, Any] = Field(default_factory=dict)
    source_id: str | None = None
    actor: str = "Dr. Meera Krishnan"


class UpdateRequest(BaseModel):
    payload: dict[str, Any]
    provenance: dict[str, Any] | None = None
    ai_meta: dict[str, Any] | None = None
    actor: str = "Dr. Meera Krishnan"


class SignoffRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    role: str = Field(min_length=2, max_length=120)
    meaning: str = "Reviewed and approved the investigation and CAPA"
    statement: str = ""
    confirmations: list[str] = Field(default_factory=list)


def next_code(db: Session) -> str:
    year = date.today().year
    prefix = f"RCA-{year}-"
    latest = db.scalar(
        select(func.max(Investigation.code)).where(Investigation.code.like(f"{prefix}%"))
    )
    sequence = 1
    if latest:
        try:
            sequence = int(latest.rsplit("-", 1)[1]) + 1
        except (IndexError, ValueError):
            sequence = 1
    return f"{prefix}{sequence:04d}"


def leading_cause(payload: dict) -> dict:
    causes = payload.get("root_causes") or []
    accepted = next((c for c in causes if c.get("status") == "accepted"), None)
    if accepted:
        return accepted
    return max(causes, key=lambda c: c.get("confidence", 0), default={})


def serialize(inv: Investigation, full: bool = False) -> dict:
    payload = inv.payload or {}
    cause = leading_cause(payload)
    base = {
        "id": inv.id,
        "code": inv.code,
        "title": inv.title,
        "status": inv.status,
        "product_name": inv.product_name,
        "batch_number": inv.batch_number,
        "classification": inv.classification,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
        "created_by": inv.created_by,
        "version": inv.version,
        "source_kind": inv.source_kind,
        "counts": {
            "evidence": len(payload.get("evidence") or []),
            "root_causes": len(payload.get("root_causes") or []),
            "capa": len(payload.get("capa") or []),
            "open_gaps": sum(1 for g in (payload.get("gaps") or []) if g.get("status") == "open"),
        },
        "leading_cause": {
            "statement": cause.get("statement", ""),
            "confidence": cause.get("confidence", 0),
            "status": cause.get("status", "none"),
        },
        "signoff": payload.get("signoff", {}),
    }
    if full:
        base.update(
            {
                "payload": payload,
                "provenance": inv.provenance or {},
                "ai_meta": inv.ai_meta or {},
            }
        )
    return base


def _audit(db: Session, investigation_id: str, actor: str, action: str, detail: dict) -> None:
    db.add(AuditEvent(investigation_id=investigation_id, actor=actor, action=action, detail=detail))


@router.get("")
def list_investigations(status: str | None = None, db: Session = Depends(get_db)) -> dict:
    stmt = select(Investigation).order_by(Investigation.updated_at.desc())
    if status:
        stmt = stmt.where(Investigation.status == status)
    rows = db.scalars(stmt).all()
    all_rows = db.scalars(select(Investigation)).all()
    open_payloads = [
        r.payload or {} for r in all_rows if r.status in {"draft", "in_review"}
    ]
    stats = {
        "total": len(all_rows),
        "open": sum(1 for r in all_rows if r.status in {"draft", "in_review"}),
        "approved": sum(1 for r in all_rows if r.status in {"approved", "closed"}),
        "open_gaps": sum(
            1
            for p in open_payloads
            for g in (p.get("gaps") or [])
            if g.get("status") == "open"
        ),
        "ai_runs": db.scalar(select(func.count()).select_from(AiRun)) or 0,
    }
    return {"items": [serialize(r) for r in rows], "stats": stats}


@router.post("", status_code=201)
def create_investigation(body: CreateRequest, db: Session = Depends(get_db)) -> dict:
    payload = {**blank_payload(), **(body.payload or {})}
    code = next_code(db)
    payload["code"] = code
    status = payload.get("status") if payload.get("status") in STATUSES else "draft"
    payload["status"] = status
    source = db.get(Source, body.source_id) if body.source_id else None
    if source:
        payload["source_kind"] = source.kind

    inv = Investigation(
        code=code,
        title=(payload.get("title") or "Untitled investigation")[:255],
        status=status,
        product_name=(payload.get("product_name") or "")[:160] or None,
        batch_number=(payload.get("batch_number") or "")[:64] or None,
        classification=(payload.get("classification") or "")[:24] or None,
        source_kind=(payload.get("source_kind") or "")[:24] or None,
        payload=payload,
        provenance=body.provenance or {},
        ai_meta=body.ai_meta or {},
        created_by=body.actor,
        updated_by=body.actor,
    )
    db.add(inv)
    db.flush()
    if source:
        source.investigation_id = inv.id
    _audit(
        db,
        inv.id,
        body.actor,
        "created",
        {
            "code": code,
            "source": {"kind": inv.source_kind, "id": body.source_id},
            "ai_provider": body.ai_meta.get("provider"),
        },
    )
    db.commit()
    return serialize(inv, full=True)


@router.get("/{investigation_id}")
def get_investigation(investigation_id: str, db: Session = Depends(get_db)) -> dict:
    inv = db.get(Investigation, investigation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found.")
    return serialize(inv, full=True)


def _diff_summary(old: dict, new: dict) -> dict:
    changed = [k for k in new.keys() if old.get(k) != new.get(k)]
    accepted = [c.get("id") for c in (new.get("root_causes") or []) if c.get("status") == "accepted"]
    accepted_capa = [c.get("id") for c in (new.get("capa") or []) if c.get("status") == "accepted"]
    return {
        "changed": changed[:30],
        "accepted_root_causes": accepted,
        "accepted_capa": accepted_capa,
    }


@router.patch("/{investigation_id}")
def update_investigation(investigation_id: str, body: UpdateRequest, db: Session = Depends(get_db)) -> dict:
    inv = db.get(Investigation, investigation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found.")

    old_payload = inv.payload or {}
    new_payload = {**blank_payload(), **(body.payload or {})}
    new_payload["code"] = inv.code
    new_status = new_payload.get("status") if new_payload.get("status") in STATUSES else inv.status

    if inv.status in {"approved", "closed"} and old_payload != new_payload:
        # Any change after e-signature requires re-approval (Part 11 style control).
        new_status = "in_review"
        new_payload["signoff"] = {}
        new_payload["status"] = new_status
        _audit(
            db,
            inv.id,
            body.actor,
            "approval.invalidated",
            {"reason": "Record amended after electronic signature", "new_status": new_status},
        )

    inv.payload = new_payload
    if body.provenance is not None:
        inv.provenance = body.provenance
    if body.ai_meta is not None:
        inv.ai_meta = body.ai_meta
    inv.title = (new_payload.get("title") or inv.title)[:255]
    inv.product_name = (new_payload.get("product_name") or "")[:160] or None
    inv.batch_number = (new_payload.get("batch_number") or "")[:64] or None
    inv.classification = (new_payload.get("classification") or "")[:24] or None
    inv.source_kind = (new_payload.get("source_kind") or inv.source_kind or "")[:24] or None
    inv.status = new_status
    inv.updated_by = body.actor
    inv.version += 1

    diff = _diff_summary(old_payload, new_payload)
    _audit(db, inv.id, body.actor, "saved", diff)
    if diff["accepted_root_causes"]:
        _audit(db, inv.id, body.actor, "root_cause.confirmed", {"ids": diff["accepted_root_causes"]})
    if diff["accepted_capa"]:
        _audit(db, inv.id, body.actor, "capa.approved", {"ids": diff["accepted_capa"]})
    db.commit()
    return serialize(inv, full=True)


@router.post("/{investigation_id}/signoff")
def signoff(investigation_id: str, body: SignoffRequest, db: Session = Depends(get_db)) -> dict:
    inv = db.get(Investigation, investigation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found.")
    payload = dict(inv.payload or {})
    if inv.status in {"approved", "closed"}:
        raise HTTPException(status_code=409, detail="This investigation is already approved.")

    accepted_cause = [c for c in (payload.get("root_causes") or []) if c.get("status") == "accepted"]
    if not accepted_cause:
        raise HTTPException(status_code=400, detail="Confirm at least one root cause before sign-off.")
    accepted_capa = [c for c in (payload.get("capa") or []) if c.get("status") == "accepted"]
    if not accepted_capa:
        raise HTTPException(status_code=400, detail="Approve at least one CAPA action before sign-off.")
    if len(body.confirmations) < 3:
        raise HTTPException(status_code=400, detail="All reviewer attestations are required for sign-off.")

    signature = f"ESIG-{inv.code}-{secrets.token_hex(3).upper()}"
    signed_at = date.today().isoformat()
    payload["signoff"] = {
        "name": body.name,
        "role": body.role,
        "meaning": body.meaning,
        "statement": body.statement,
        "confirmations": body.confirmations,
        "signature": signature,
        "signed_at": signed_at,
    }
    payload["status"] = "approved"
    inv.payload = payload
    inv.status = "approved"
    inv.version += 1
    inv.updated_by = body.name
    _audit(
        db,
        inv.id,
        body.name,
        "signed",
        {
            "signature": signature,
            "meaning": body.meaning,
            "role": body.role,
            "root_causes": [c.get("id") for c in accepted_cause],
            "capa": [c.get("id") for c in accepted_capa],
            "confirmations": body.confirmations,
        },
    )
    db.commit()
    return serialize(inv, full=True)


@router.get("/{investigation_id}/audit")
def get_audit(investigation_id: str, db: Session = Depends(get_db)) -> dict:
    inv = db.get(Investigation, investigation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found.")
    events = db.scalars(
        select(AuditEvent)
        .where(AuditEvent.investigation_id == investigation_id)
        .order_by(AuditEvent.created_at.desc())
    ).all()
    return {
        "items": [
            {
                "id": e.id,
                "actor": e.actor,
                "action": e.action,
                "detail": e.detail or {},
                "at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ]
    }


@router.delete("/{investigation_id}", status_code=204)
def delete_draft(investigation_id: str, db: Session = Depends(get_db)) -> None:
    inv = db.get(Investigation, investigation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found.")
    if inv.status != "draft":
        raise HTTPException(status_code=409, detail="Only drafts can be deleted.")
    db.delete(inv)
    db.commit()
