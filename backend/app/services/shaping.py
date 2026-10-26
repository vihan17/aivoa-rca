"""Shaping helpers: turn model output into the UI payload with provenance."""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta

from ..ai.schemas import AnalysisResult, CapaResult, Gap, IntakeResult, ReviewResult
from ..models import utcnow

TEXT_FIELDS = [
    "title", "description", "deviation_type", "classification", "date_occurred",
    "date_detected", "reported_by", "site_area", "department", "product_name",
    "product_code", "batch_number", "batch_size", "process_stage", "equipment",
    "immediate_action", "impact_assessment", "investigation_scope",
]

MAX_LEN = {
    "title": 160,
    "description": 4000,
    "immediate_action": 2000,
    "impact_assessment": 2000,
    "investigation_scope": 2000,
}

DATE_FORMATS = ("%Y-%m-%d", "%d-%b-%Y", "%d %b %Y", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d")

GAP_STOPWORDS = {
    "the", "and", "for", "from", "with", "all", "any", "oct", "sep", "since", "status",
    "report", "data", "export", "statement", "list", "record", "records", "batch",
}


def _gap_tokens(value: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", (value or "").lower())
    return {word for word in words if len(word) > 2 and word not in GAP_STOPWORDS}


def _gap_overlap(left: str, right: str) -> float:
    a, b = _gap_tokens(left), _gap_tokens(right)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)



def normalize_date(value: str) -> str:
    if not value:
        return ""
    raw = str(value).strip()
    if not raw:
        return ""
    cleaned = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", raw, flags=re.I).replace(",", " ")
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(cleaned.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    # Last resort: first ISO-looking date anywhere in the string
    match = re.search(r"\b(20\d{2})-(\d{2})-(\d{2})\b", raw)
    return match.group(0) if match else ""


def _clamp(value: float) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.5


def blank_payload() -> dict:
    payload = {field: "" for field in TEXT_FIELDS}
    payload.update(
        {
            "code": "",
            "status": "draft",
            "rca_method": "5 Whys + Fishbone (6M)",
            "source_summary": "",
            "summary": "",
            "conclusion": "",
            "team": [],
            "evidence": [],
            "five_whys": [],
            "fishbone": [],
            "root_causes": [],
            "gaps": [],
            "capa": [],
        }
    )
    return payload


def intake_to_payload(result: IntakeResult, source_kind: str, source_meta: dict | None = None) -> tuple[dict, dict, dict]:
    """Return (payload, provenance, ai_meta)."""
    payload = blank_payload()
    provenance: dict[str, dict] = {}
    incident = result.incident.model_dump()

    for field in TEXT_FIELDS:
        value = incident.get(field, "") or ""
        value = str(value).strip()
        if field in {"date_occurred", "date_detected"}:
            value = normalize_date(value)
        if field == "deviation_type" and value not in {"Planned", "Unplanned"}:
            value = "Unplanned"
        if field == "classification" and value not in {"Critical", "Major", "Minor"}:
            value = "Major"
        if field in MAX_LEN:
            value = value[: MAX_LEN[field]]
        payload[field] = value

        if value:
            citation = result.field_citations.get(field)
            confidence = _clamp(result.field_confidence.get(field, 0.7))
            provenance[field] = {
                "source": "ai",
                "confidence": round(confidence, 2),
                "quote": (citation.quote if citation else "")[:400],
                "ref": citation.ref if citation else "",
                "at": utcnow().isoformat(),
            }

    payload["source_summary"] = result.source_summary
    payload["evidence"] = [
        {
            **ev.model_dump(),
            "verified": False,
            "origin": "ai",
        }
        for ev in result.evidence[:20]
    ]
    gaps: list[Gap] = []
    for idx, gap in enumerate(result.intake_gaps[:6], start=1):
        gaps.append(
            Gap(
                id=f"GAP-{idx:02d}",
                item=gap.item,
                why_needed=gap.why_needed,
                request_from="Investigation team",
                priority="High" if idx <= 2 else "Medium",
            )
        )
    payload["gaps"] = [gap.model_dump() for gap in gaps]
    payload["evidence_count"] = len(payload["evidence"])

    for section in ("evidence", "gaps", "source_summary"):
        provenance[section] = {
            "source": "ai",
            "confidence": round(_clamp(result.field_confidence.get("title", 0.8)), 2),
            "quote": "",
            "ref": "",
            "at": utcnow().isoformat(),
        }

    ai_meta = {
        "document_type": result.document_type,
        "source_kind": source_kind,
        "source_meta": source_meta or {},
        "generated_at": utcnow().isoformat(),
    }
    return payload, provenance, ai_meta


def apply_analysis(payload: dict, analysis: AnalysisResult, provenance: dict) -> dict:
    updated = dict(payload)
    updated["five_whys"] = [
        {**why.model_dump(), "origin": "ai", "verified": False} for why in analysis.five_whys
    ]
    updated["fishbone"] = [
        {**factor.model_dump(), "origin": "ai"} for factor in analysis.fishbone
    ]
    updated["root_causes"] = [
        {**cause.model_dump(), "origin": "ai", "confirmed_by": "", "confirmed_at": ""}
        for cause in analysis.root_causes
    ]
    incoming_items = [gap.item for gap in analysis.gaps]
    existing_gaps = []
    for gap in payload.get("gaps", []):
        is_ai_open = gap.get("origin", "ai") == "ai" and gap.get("status", "open") == "open"
        superseded = is_ai_open and any(
            _gap_overlap(gap.get("item", ""), item) >= 0.28 for item in incoming_items
        )
        if not superseded:
            existing_gaps.append(gap)

    merged_gaps = []
    for gap in analysis.gaps:
        data = gap.model_dump()
        data["origin"] = "ai"
        # Reuse a reviewer-tracked gap with the same intent so status is not lost.
        best = None
        best_score = 0.0
        for candidate in existing_gaps:
            score = _gap_overlap(data["item"], candidate.get("item", ""))
            if score > best_score:
                best, best_score = candidate, score
        if best is not None and best_score >= 0.3:
            data["status"] = best.get("status", "open")
            data["origin"] = best.get("origin", "ai")
            existing_gaps.remove(best)
        merged_gaps.append(data)
    merged_gaps.extend(existing_gaps)
    for index, gap in enumerate(merged_gaps, start=1):
        gap["id"] = f"GAP-{index:02d}"
    updated["gaps"] = merged_gaps
    updated["summary"] = analysis.causal_summary or updated.get("summary", "")
    updated["rca_method"] = "5 Whys + Fishbone (6M)"
    for section in ("five_whys", "fishbone", "root_causes", "gaps", "summary"):
        provenance[section] = {
            "source": "ai",
            "confidence": 0.78,
            "quote": "",
            "ref": "",
            "at": utcnow().isoformat(),
        }
    return updated


def _ref_tokens(value: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", (value or "").lower())
    return {word for word in words if len(word) > 2 and word not in GAP_STOPWORDS}


def _repair_capa_refs(actions: list[dict], payload: dict) -> None:
    """Keep CAPA traceability valid when a model invents a reference id.

    The prompt asks for an existing RC/GAP id, but models occasionally emit a
    plausible-looking id that was never generated (for example RC-05 in a
    four-cause analysis). Prefer the valid reference with the strongest lexical
    overlap with the action text; fall back to the leading cause.
    """
    candidates: list[tuple[str, set[str]]] = []
    for cause in payload.get("root_causes", []):
        candidates.append(
            (
                cause.get("id", ""),
                _ref_tokens(f"{cause.get('statement', '')} {cause.get('rationale', '')}"),
            )
        )
    for gap in payload.get("gaps", []):
        candidates.append(
            (
                gap.get("id", ""),
                _ref_tokens(f"{gap.get('item', '')} {gap.get('why_needed', '')}"),
            )
        )
    candidates = [(ref, tokens) for ref, tokens in candidates if ref and tokens]
    if not candidates:
        return
    valid = {ref for ref, _ in candidates}
    fallback = next((ref for ref, _ in candidates if ref.startswith("RC-")), candidates[0][0])

    for action in actions:
        ref = action.get("root_cause_ref", "")
        if ref in valid:
            continue
        text = _ref_tokens(f"{action.get('action', '')} {action.get('explanation', '')}")
        scored = [(len(text & tokens) / len(text | tokens), candidate) for candidate, tokens in candidates]
        scored.sort(reverse=True)
        action["root_cause_ref"] = scored[0][1] if scored and scored[0][0] >= 0.08 else fallback


def normalize_capa_actions(payload: dict, actions: list[dict]) -> list[dict]:
    """Add derived due dates and repair invented RC/GAP references."""
    today = date.today()
    normalized = []
    for action in actions:
        data = dict(action)
        days = max(1, min(int(data.get("due_in_days") or 30), 180))
        data["due_date"] = (today + timedelta(days=days)).isoformat()
        data["origin"] = "ai"
        data["accepted_at"] = ""
        normalized.append(data)
    _repair_capa_refs(normalized, payload)
    return normalized


def _filter_review_issues(review: ReviewResult, actions: list[dict], payload: dict) -> dict:
    """Drop critique items that contradict the normalized record.

    The critic is a second model pass; it can flag an invented CAPA reference or
    a missing due date that the deterministic finalizer has already fixed. Those
    stale objections would otherwise appear in the reviewer's issue list.
    """
    valid_refs = {cause.get("id") for cause in payload.get("root_causes", [])}
    valid_refs |= {gap.get("id") for gap in payload.get("gaps", [])}
    normalized_refs = {action.get("root_cause_ref") for action in actions}
    all_due = all(action.get("due_date") for action in actions)
    keep = []
    for issue in review.issues:
        text = f"{issue.issue} {issue.recommendation}".lower()
        refs = set(re.findall(r"\b(?:RC|GAP)-\d+\b", text.upper()))
        claims_ref_invalid = any(
            phrase in text
            for phrase in (
                "references non-existent",
                "references non existent",
                "references root cause",
                "references gap",
                "not defined in the root cause",
                "not defined in the root cause list",
            )
        )
        if claims_ref_invalid and refs and refs <= valid_refs:
            continue
        if claims_ref_invalid and refs and not (refs & normalized_refs):
            continue
        claims_missing_due = any(
            phrase in text
            for phrase in ("lacks due date", "lack due date", "missing due date", "no due date", "without due date")
        )
        if claims_missing_due and all_due:
            continue
        keep.append(issue)
    data = review.model_dump()
    data["issues"] = [item.model_dump() for item in keep]
    return data


def apply_capa(payload: dict, capa: CapaResult, review: ReviewResult | None, provenance: dict) -> dict:
    updated = dict(payload)
    actions = normalize_capa_actions(updated, [item.model_dump() for item in capa.capa])
    updated["capa"] = actions
    updated["conclusion"] = capa.conclusion
    updated["review"] = _filter_review_issues(review, actions, updated) if review else {}
    for section in ("capa", "conclusion"):
        provenance[section] = {
            "source": "ai",
            "confidence": 0.75,
            "quote": "",
            "ref": "",
            "at": utcnow().isoformat(),
        }
    return updated


def compact_record(payload: dict, max_evidence: int = 16) -> dict:
    """Trim the record for prompt context (keeps token use predictable)."""
    keep = [
        "code", "title", "description", "classification", "deviation_type",
        "date_occurred", "date_detected", "product_name", "batch_number",
        "process_stage", "equipment", "immediate_action", "impact_assessment",
        "investigation_scope",
    ]
    record = {k: payload.get(k, "") for k in keep if payload.get(k)}
    evidence = []
    for ev in (payload.get("evidence") or [])[:max_evidence]:
        evidence.append(
            {
                "id": ev.get("id"),
                "label": ev.get("label"),
                "kind": ev.get("kind"),
                "source_ref": ev.get("source_ref"),
                "quote": (ev.get("quote") or "")[:220],
                "relevance": ev.get("relevance"),
            }
        )
    record["evidence"] = evidence
    if payload.get("gaps"):
        record["gaps"] = [
            {"id": g.get("id"), "item": g.get("item"), "priority": g.get("priority")}
            for g in payload["gaps"][:8]
        ]
    return record


def record_for_analysis(payload: dict) -> dict:
    record = compact_record(payload, max_evidence=18)
    if payload.get("five_whys"):
        record["five_whys"] = [
            {"level": w.get("level"), "question": w.get("question"), "answer": w.get("answer")}
            for w in payload["five_whys"]
        ]
    return record
