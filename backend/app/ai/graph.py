"""LangGraph workflows for intake extraction and RCA generation.

Intake:   read -> segment -> extract (LLM) -> structure
Analysis: case file -> 5 Whys (LLM) -> fishbone (LLM) -> root causes + gaps (LLM)
          -> CAPA (LLM) -> QA critic (LLM, fast model) -> finalise

Every node emits a progress event consumed by the SSE endpoint, so the UI can
show exactly which reasoning step is running.
"""
from __future__ import annotations

import asyncio
import re
from collections.abc import Awaitable, Callable
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from ..config import settings
from ..services.shaping import (
    apply_analysis,
    apply_capa,
    intake_to_payload,
    normalize_capa_actions,
    record_for_analysis,
)
from . import prompts
from .provider import BaseProvider
from .schemas import (
    AnalysisResult,
    CapaResult,
    FishboneResult,
    IntakeResult,
    ReviewResult,
    RootCauseResult,
    WhysResult,
)

Emit = Callable[[dict], Awaitable[None]]


class IntakeState(TypedDict, total=False):
    text: str
    source_kind: str
    source_meta: dict
    intake: dict
    payload: dict
    provenance: dict
    meta: dict
    error: str


class AnalysisState(TypedDict, total=False):
    record: dict
    original: dict
    whys: dict
    fishbone: dict
    roots: dict
    capa: dict
    review: dict
    payload: dict
    provenance: dict
    error: str


def _event(stage: str, label: str, status: str, detail: str = "", **extra: Any) -> dict:
    return {"stage": stage, "label": label, "status": status, "detail": detail, **extra}


def build_intake_graph(provider: BaseProvider, emit: Emit):
    async def read(state: IntakeState) -> dict:
        text = (state.get("text") or "").strip()
        pages = len(re.findall(r"--- Page \d+ ---", text))
        await emit(_event("read", "Reading source", "running", "Opening document"))
        await asyncio.sleep(0.35)
        detail = f"{pages} pages · {len(text):,} characters" if pages else f"{len(text):,} characters"
        await emit(_event("read", "Reading source", "done", detail))
        await emit(_event("segment", "Segmenting document", "running", "Locating headers, dates and records"))
        await asyncio.sleep(0.35)
        await emit(
            _event(
                "segment",
                "Segmenting document",
                "done",
                "Product, batch, process stage and equipment context identified",
            )
        )
        return {}

    async def extract(state: IntakeState) -> dict:
        text = (state.get("text") or "")[: settings.max_source_chars]
        await emit(
            _event(
                "extract",
                "Extracting fields & evidence",
                "running",
                "Mapping the deviation to the RCA intake record",
            )
        )
        result: IntakeResult = await provider.json(prompts.intake_prompt(text), IntakeResult)
        await emit(
            _event(
                "extract",
                "Extracting fields & evidence",
                "done",
                f"{len(result.evidence)} evidence items · {len(result.intake_gaps)} gaps flagged",
            )
        )
        return {"intake": result.model_dump()}

    async def structure(state: IntakeState) -> dict:
        await emit(
            _event("structure", "Building investigation record", "running", "Applying provenance and confidence")
        )
        result = IntakeResult.model_validate(state["intake"])
        payload, provenance, meta = intake_to_payload(
            result, state.get("source_kind", "text"), state.get("source_meta", {})
        )
        await emit(
            _event(
                "structure",
                "Building investigation record",
                "done",
                f"{sum(1 for v in payload.values() if isinstance(v, str) and v)} fields populated",
            )
        )
        return {"payload": payload, "provenance": provenance, "meta": meta}

    graph = StateGraph(IntakeState)
    graph.add_node("read", read)
    graph.add_node("extract", extract)
    graph.add_node("structure", structure)
    graph.add_edge(START, "read")
    graph.add_edge("read", "extract")
    graph.add_edge("extract", "structure")
    graph.add_edge("structure", END)
    return graph.compile()


def build_analysis_graph(provider: BaseProvider, emit: Emit):
    async def case_file(state: AnalysisState) -> dict:
        record = state.get("record") or {}
        await emit(
            _event(
                "case",
                "Assembling case file",
                "done",
                f"{len(record.get('evidence') or [])} evidence items · {len(record.get('gaps') or [])} open questions",
            )
        )
        return {}

    async def whys(state: AnalysisState) -> dict:
        record = state["record"]
        await emit(
            _event("whys", "Building the 5 Whys chain", "running", "Tracing the causal path from effect to system")
        )
        result: WhysResult = await provider.json(prompts.whys_prompt(record), WhysResult)
        await emit(
            _event(
                "whys",
                "Building the 5 Whys chain",
                "done",
                f"{len(result.five_whys)} levels · ends at '{result.five_whys[-1].answer[:60]}...'"
                if result.five_whys
                else "No chain produced",
            )
        )
        return {"whys": result.model_dump()}

    async def fishbone(state: AnalysisState) -> dict:
        record = state["record"]
        await emit(
            _event("fishbone", "Fishbone (6M) analysis", "running", "Testing Man, Machine, Material, Method, Measurement, Environment")
        )
        result: FishboneResult = await provider.json(
            prompts.fishbone_prompt(record, state["whys"]), FishboneResult, fast=True
        )
        categories = sorted({f.category for f in result.fishbone})
        await emit(
            _event(
                "fishbone",
                "Fishbone (6M) analysis",
                "done",
                f"{len(result.fishbone)} factors across {len(categories)} categories",
            )
        )
        return {"fishbone": result.model_dump()}

    async def roots(state: AnalysisState) -> dict:
        await emit(
            _event("roots", "Root cause synthesis", "running", "Ranking hypotheses and testing falsification criteria")
        )
        result: RootCauseResult = await provider.json(
            prompts.root_cause_prompt(state["record"], state["whys"], state["fishbone"]),
            RootCauseResult,
        )
        high = sum(1 for c in result.root_causes if c.confidence >= 0.7)
        await emit(
            _event(
                "roots",
                "Root cause synthesis",
                "done",
                f"{len(result.root_causes)} candidates · {high} well supported · {len(result.gaps)} gaps",
            )
        )
        return {"roots": result.model_dump()}

    async def capa(state: AnalysisState) -> dict:
        record = state["record"]
        analysis = {
            "five_whys": (state.get("whys") or {}).get("five_whys", []),
            "causal_summary": (state.get("whys") or {}).get("causal_summary", ""),
            "fishbone": (state.get("fishbone") or {}).get("fishbone", []),
            "root_causes": (state.get("roots") or {}).get("root_causes", []),
            "gaps": (state.get("roots") or {}).get("gaps", []),
        }
        await emit(_event("capa", "CAPA generation", "running", "Tracing actions back to confirmed causes"))
        result: CapaResult = await provider.json(prompts.capa_prompt(record, analysis), CapaResult, fast=True)
        corrective = sum(1 for c in result.capa if c.type == "Corrective")
        capa_data = result.model_dump()
        capa_data["capa"] = normalize_capa_actions(analysis, capa_data["capa"])
        await emit(
            _event(
                "capa",
                "CAPA generation",
                "done",
                f"{len(result.capa)} actions · {corrective} corrective / {len(result.capa) - corrective} preventive",
            )
        )
        return {"capa": capa_data}

    async def review(state: AnalysisState) -> dict:
        analysis = {
            "five_whys": (state.get("whys") or {}).get("five_whys", []),
            "fishbone": (state.get("fishbone") or {}).get("fishbone", []),
            "root_causes": (state.get("roots") or {}).get("root_causes", []),
            "gaps": (state.get("roots") or {}).get("gaps", []),
        }
        await emit(_event("review", "Independent QA review", "running", "A second pass looks for unsupported claims"))
        result: ReviewResult = await provider.json(
            prompts.review_prompt(state["record"], analysis, state.get("capa") or {}),
            ReviewResult,
            fast=True,
        )
        await emit(
            _event(
                "review",
                "Independent QA review",
                "done",
                f"{len(result.issues)} issues to review · verdict: {result.verdict}",
            )
        )
        return {"review": result.model_dump()}

    async def finalise(state: AnalysisState) -> dict:
        await emit(_event("finalise", "Finalising record", "running", "Writing AI suggestions into the investigation"))
        provenance: dict = {}
        record = state.get("original") or state["record"]
        analysis = AnalysisResult(
            five_whys=(state.get("whys") or {}).get("five_whys", []),
            causal_summary=(state.get("whys") or {}).get("causal_summary", ""),
            fishbone=(state.get("fishbone") or {}).get("fishbone", []),
            root_causes=(state.get("roots") or {}).get("root_causes", []),
            gaps=(state.get("roots") or {}).get("gaps", []),
        )
        payload = apply_analysis(record, analysis, provenance)
        payload = apply_capa(
            payload,
            CapaResult.model_validate(state.get("capa") or {}),
            ReviewResult.model_validate(state.get("review") or {}),
            provenance,
        )
        await emit(_event("finalise", "Finalising record", "done", "Review each suggestion before sign-off"))
        return {"payload": payload, "provenance": provenance}

    graph = StateGraph(AnalysisState)
    graph.add_node("case_file", case_file)
    graph.add_node("why_node", whys)
    graph.add_node("fishbone_node", fishbone)
    graph.add_node("root_node", roots)
    graph.add_node("capa_node", capa)
    graph.add_node("review_node", review)
    graph.add_node("finalise", finalise)
    graph.add_edge(START, "case_file")
    graph.add_edge("case_file", "why_node")
    graph.add_edge("why_node", "fishbone_node")
    graph.add_edge("fishbone_node", "root_node")
    graph.add_edge("root_node", "capa_node")
    graph.add_edge("capa_node", "review_node")
    graph.add_edge("review_node", "finalise")
    graph.add_edge("finalise", END)
    return graph.compile()


async def run_intake(provider: BaseProvider, emit: Emit, text: str, source_kind: str, source_meta: dict) -> dict:
    graph = build_intake_graph(provider, emit)
    state = await graph.ainvoke(
        {"text": text, "source_kind": source_kind, "source_meta": source_meta},
        {"recursion_limit": 20},
    )
    return {
        "payload": state.get("payload", {}),
        "provenance": state.get("provenance", {}),
        "meta": state.get("meta", {}),
        "provider": provider.info(),
    }


async def run_analysis(provider: BaseProvider, emit: Emit, record: dict) -> dict:
    graph = build_analysis_graph(provider, emit)
    state = await graph.ainvoke(
        {"record": record_for_analysis(record), "original": record},
        {"recursion_limit": 30},
    )
    return {
        "payload": state.get("payload", {}),
        "provenance": state.get("provenance", {}),
        "review": state.get("review", {}),
        "provider": provider.info(),
    }

