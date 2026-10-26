"""Typed contracts for every LLM call.

The same models validate Groq output and the offline demo engine, so the API
surface is identical whether inference is live or not.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class EvidenceItem(BaseModel):
    id: str
    label: str
    kind: str = "Document"
    source_ref: str = ""
    quote: str = ""
    relevance: Literal["High", "Medium", "Low"] = "Medium"


class IntakeGap(BaseModel):
    item: str
    why_needed: str


class IncidentFields(BaseModel):
    title: str = ""
    description: str = ""
    deviation_type: str = "Unplanned"
    classification: str = "Major"
    date_occurred: str = ""
    date_detected: str = ""
    reported_by: str = ""
    site_area: str = ""
    department: str = ""
    product_name: str = ""
    product_code: str = ""
    batch_number: str = ""
    batch_size: str = ""
    process_stage: str = ""
    equipment: str = ""
    immediate_action: str = ""
    impact_assessment: str = ""
    investigation_scope: str = ""


class FieldCitation(BaseModel):
    quote: str = ""
    ref: str = ""


class IntakeResult(BaseModel):
    document_type: str = "Deviation report"
    source_summary: str = ""
    incident: IncidentFields
    evidence: list[EvidenceItem] = Field(default_factory=list)
    intake_gaps: list[IntakeGap] = Field(default_factory=list)
    field_confidence: dict[str, float] = Field(default_factory=dict)
    field_citations: dict[str, FieldCitation] = Field(default_factory=dict)


class WhyStep(BaseModel):
    level: int
    question: str
    answer: str
    evidence: list[str] = Field(default_factory=list)
    confidence: float = 0.5
    verified: bool = False


class FishboneFactor(BaseModel):
    id: str
    category: Literal["Man", "Machine", "Material", "Method", "Measurement", "Environment"]
    factor: str
    rationale: str = ""
    evidence: list[str] = Field(default_factory=list)
    status: Literal["suggested", "confirmed", "dismissed"] = "suggested"


class RootCauseCandidate(BaseModel):
    id: str
    statement: str
    category: str = "Method"
    confidence: float = 0.5
    rationale: str = ""
    evidence: list[str] = Field(default_factory=list)
    falsification: str = ""
    ruled_out: bool = False
    status: Literal["suggested", "accepted", "rejected"] = "suggested"


class Gap(BaseModel):
    id: str
    item: str
    why_needed: str
    request_from: str = ""
    priority: Literal["High", "Medium", "Low"] = "Medium"
    status: Literal["open", "requested", "resolved"] = "open"


class AnalysisResult(BaseModel):
    five_whys: list[WhyStep] = Field(default_factory=list)
    fishbone: list[FishboneFactor] = Field(default_factory=list)
    root_causes: list[RootCauseCandidate] = Field(default_factory=list)
    gaps: list[Gap] = Field(default_factory=list)
    causal_summary: str = ""


class WhysResult(BaseModel):
    five_whys: list[WhyStep] = Field(default_factory=list)
    causal_summary: str = ""


class FishboneResult(BaseModel):
    fishbone: list[FishboneFactor] = Field(default_factory=list)


class RootCauseResult(BaseModel):
    root_causes: list[RootCauseCandidate] = Field(default_factory=list)
    gaps: list[Gap] = Field(default_factory=list)


class CapaItem(BaseModel):
    id: str
    type: Literal["Corrective", "Preventive"]
    action: str
    explanation: str = ""
    owner: str = ""
    due_in_days: int = 30
    priority: Literal["High", "Medium", "Low"] = "Medium"
    root_cause_ref: str = ""
    effectiveness_check: str = ""
    due_date: str = ""
    status: Literal["suggested", "accepted", "rejected"] = "suggested"


class CapaResult(BaseModel):
    capa: list[CapaItem] = Field(default_factory=list)
    conclusion: str = ""


class ReviewIssue(BaseModel):
    severity: Literal["High", "Medium", "Low"] = "Medium"
    issue: str
    recommendation: str


class ReviewResult(BaseModel):
    verdict: Literal["pass", "needs_review"] = "needs_review"
    issues: list[ReviewIssue] = Field(default_factory=list)
    notes: str = ""


class ChatResult(BaseModel):
    answer: str
