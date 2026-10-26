"""Seed two representative investigations so the workspace has history."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from .db import SessionLocal
from .models import AiRun, AuditEvent, Investigation, User
from .services.shaping import blank_payload

NOW = datetime.now(timezone.utc).replace(tzinfo=None)


def _p(**overrides) -> dict:
    payload = blank_payload()
    payload.update(overrides)
    return payload


def _seed_a() -> dict:
    payload = _p(
        code="RCA-2026-0003",
        status="approved",
        title="High moisture content in Metformin HCl API batch MF-23107",
        description=(
            "Batch MF-23107 failed the release specification for water content (0.62% w/w against NMT 0.50% w/w) "
            "after the final wash and drying step. Drying time was within the validated 6 h, and the dryer "
            "performed to setpoint, so the investigation focused on wash-water ingress during centrifugation."
        ),
        deviation_type="Unplanned",
        classification="Major",
        date_occurred="2026-07-18",
        date_detected="2026-07-22",
        reported_by="Vikram Shetty, QC Analyst",
        site_area="Unit 2, Building A, Centrifuge Bay CB-01",
        department="Quality Control",
        product_name="Metformin HCl USP (API)",
        product_code="API-MET-01",
        batch_number="MF-23107",
        batch_size="400 kg",
        process_stage="Centrifugation and final wash",
        equipment="Peeler centrifuge CF-03",
        immediate_action="Batch placed on hold QA-H-2026-071. CF-03 taken out of service pending seal inspection.",
        impact_assessment="No release or distribution. Two subsequent batches were manufactured on CF-04 and released.",
        investigation_scope="Final wash step of MF-23107, CF-03 seal integrity, preventive maintenance interval for the discharge chute seal.",
        source_summary="Moisture OOS after final wash, traced to a wash-water seal leak on centrifuge CF-03.",
        summary=(
            "The centrifuge discharge chute seal was worn and allowed wash water to enter the product bed during the "
            "final wash. The seal was replaced 13 months earlier against an OEM interval of 6 months."
        ),
        conclusion=(
            "Moisture OOS is attributed to wash-water ingress through a worn discharge chute seal. The PM interval "
            "for the seal did not follow the OEM recommendation and no condition monitoring was in place. CAPA has "
            "been implemented and the batch rejected."
        ),
        rca_method="5 Whys + Fishbone (6M)",
        evidence=[
            {"id": "EV-01", "label": "QC moisture result MF-23107", "kind": "Lab result", "source_ref": "Page 1",
             "quote": "Water content 0.62% w/w (limit NMT 0.50%); assay and impurities within specification.",
             "relevance": "High", "verified": True, "origin": "ai"},
            {"id": "EV-02", "label": "Centrifuge CF-03 maintenance history", "kind": "Equipment log", "source_ref": "Attachment 2",
             "quote": "Discharge chute seal replaced 12-Jun-2025. OEM recommended replacement interval 6 months.",
             "relevance": "High", "verified": True, "origin": "ai"},
            {"id": "EV-03", "label": "Wash filtrate turbidity trend", "kind": "Batch record", "source_ref": "Page 6",
             "quote": "Filtrate turbidity 18 NTU at final wash vs 4-6 NTU for the previous three batches.",
             "relevance": "Medium", "verified": False, "origin": "ai"},
            {"id": "EV-04", "label": "PM schedule extract", "kind": "SOP", "source_ref": "Attachment 3",
             "quote": "Seal replacement scheduled annually under PM plan PM-CF-03-01; OEM manual specifies 6 months.",
             "relevance": "High", "verified": True, "origin": "ai"},
        ],
        five_whys=[
            {"level": 1, "question": "Why did batch MF-23107 exceed the water content limit?",
             "answer": "Wash water entered the product bed during the final wash.", "evidence": ["EV-01", "EV-03"],
             "confidence": 0.9, "verified": True, "origin": "ai"},
            {"level": 2, "question": "Why did wash water enter the product bed?",
             "answer": "The discharge chute seal on CF-03 was worn and leaked under wash pressure.",
             "evidence": ["EV-03"], "confidence": 0.86, "verified": True, "origin": "ai"},
            {"level": 3, "question": "Why was a worn seal still in service?",
             "answer": "The PM plan used a 12-month interval while the OEM specifies 6 months, and there was no seal condition check.",
             "evidence": ["EV-02", "EV-04"], "confidence": 0.82, "verified": True, "origin": "ai"},
        ],
        fishbone=[
            {"id": "FB-01", "category": "Machine", "factor": "Worn discharge chute seal on CF-03",
             "rationale": "Leak path for wash water into the product bed.", "evidence": ["EV-02", "EV-03"], "status": "confirmed", "origin": "ai"},
            {"id": "FB-02", "category": "Method", "factor": "PM interval longer than OEM recommendation",
             "rationale": "Seal replaced annually instead of every 6 months.", "evidence": ["EV-04"], "status": "confirmed", "origin": "ai"},
            {"id": "FB-03", "category": "Measurement", "factor": "No seal condition monitoring",
             "rationale": "Turbidity was not trended batch to batch, so the drift was missed.", "evidence": ["EV-03"], "status": "confirmed", "origin": "ai"},
        ],
        root_causes=[
            {"id": "RC-01", "statement": "The CF-03 discharge chute seal was worn because the PM plan used a 12-month interval against an OEM recommendation of 6 months, allowing wash water to enter the product bed.",
             "category": "Systemic", "confidence": 0.88, "rationale": "Seal age, maintenance record and turbidity trend all align.",
             "evidence": ["EV-02", "EV-03", "EV-04"], "falsification": "Seal inspection shows no wear or leak path.",
             "ruled_out": False, "status": "accepted", "origin": "ai", "confirmed_by": "Dr. Meera Krishnan",
             "confirmed_at": "2026-08-10", "confirmed_note": "Confirmed against seal inspection report."},
            {"id": "RC-02", "statement": "Wash-water pressure exceeded the validated range during the final wash.",
             "category": "Machine", "confidence": 0.08, "rationale": "Excluded: pressure recorder shows 2.1-2.3 bar against a 2.0-2.5 bar range.",
             "evidence": ["EV-03"], "falsification": "Not applicable - evidence contradicts this hypothesis.",
             "ruled_out": True, "status": "rejected", "origin": "ai"},
        ],
        gaps=[
            {"id": "GAP-01", "item": "Seal inspection photographs and wear measurement", "why_needed": "Confirms the physical failure mode.",
             "request_from": "Maintenance", "priority": "High", "status": "resolved", "origin": "ai"},
            {"id": "GAP-02", "item": "Turbidity trend for the previous 10 batches", "why_needed": "Establishes when the leak started.",
             "request_from": "QC", "priority": "Medium", "status": "resolved", "origin": "ai"},
        ],
        capa=[
            {"id": "CA-01", "type": "Corrective", "action": "Replace the CF-03 discharge chute seal and requalify the centrifuge with a water leak test.",
             "explanation": "Restores equipment integrity and confirms there is no leak path.", "owner": "Maintenance Head",
             "due_in_days": 5, "due_date": "2026-07-27", "priority": "High", "root_cause_ref": "RC-01",
             "effectiveness_check": "Leak test passes; no turbidity excursion in the next 3 batches.", "status": "accepted", "origin": "ai"},
            {"id": "CA-02", "type": "Preventive", "action": "Revise the CF-03 PM plan to a 6-month seal replacement interval aligned with the OEM manual, and apply the same review to all peeler centrifuges.",
             "explanation": "Prevents recurrence and closes the systemic gap.", "owner": "Engineering Head",
             "due_in_days": 30, "due_date": "2026-08-21", "priority": "High", "root_cause_ref": "RC-01",
             "effectiveness_check": "PM plan updated for all 4 centrifuges; audit shows 100% alignment with OEM intervals.", "status": "accepted", "origin": "ai"},
            {"id": "CA-03", "type": "Preventive", "action": "Add wash filtrate turbidity to the batch review checklist with an alert limit of 10 NTU.",
             "explanation": "Adds an early detection layer for seal leakage.", "owner": "QA Head",
             "due_in_days": 45, "due_date": "2026-09-05", "priority": "Medium", "root_cause_ref": "RC-01",
             "effectiveness_check": "Checklist effective; 100% of batches reviewed with turbidity for 3 months.", "status": "accepted", "origin": "ai"},
        ],
        signoff={
            "name": "Dr. Meera Krishnan", "role": "QA Head, Unit 2",
            "meaning": "Reviewed and approved the investigation and CAPA",
            "signature": "ESIG-RCA-2026-0003-7F2A19", "signed_at": "2026-08-14",
            "confirmations": ["Evidence reviewed", "Root cause supported", "CAPA adequate"],
        },
    )
    return payload


def _seed_b() -> dict:
    payload = _p(
        code="RCA-2026-0004",
        status="in_review",
        title="Blend uniformity out of trend - Atorvastatin Calcium batch AT-24096",
        description=(
            "Blend uniformity results for AT-24096 showed a relative standard deviation of 4.8% across 10 sample "
            "points against an internal alert limit of 3.5% (validation acceptance criterion NMT 5.0%). Assay was "
            "within specification. The blend was held for 26 h before compression against a validated maximum of 12 h."
        ),
        deviation_type="Unplanned",
        classification="Minor",
        date_occurred="2026-09-28",
        date_detected="2026-09-30",
        reported_by="Farah Khan, QC Analyst",
        site_area="Unit 2, Building B, Blending Suite BL-02",
        department="Quality Control",
        product_name="Atorvastatin Calcium USP (API)",
        product_code="API-ATV-02",
        batch_number="AT-24096",
        batch_size="180 kg",
        process_stage="Blending and bin transfer",
        equipment="Bin blender BB-05; transfer bin TB-12",
        immediate_action="Batch held pending investigation; no release. Blend repeated from the same granulate lot.",
        impact_assessment="No patient exposure. The repeat blend passed. Hold-time validation may not cover the observed 26 h hold.",
        investigation_scope="Blend uniformity, bin transfer and hold time for AT-24096; adequacy of the 12 h hold-time validation.",
        source_summary="Blend uniformity RSD 4.8% after a 26 h hold, exceeding the validated 12 h hold time.",
        summary="Segregation during an extended bin hold is the leading hypothesis; sampling method is not yet excluded.",
        conclusion="",
        rca_method="5 Whys + Fishbone (6M)",
        evidence=[
            {"id": "EV-01", "label": "Blend uniformity results", "kind": "Lab result", "source_ref": "Page 1",
             "quote": "RSD 4.8% across 10 points; lowest 94.2%, highest 103.1% (alert limit 3.5%).",
             "relevance": "High", "verified": False, "origin": "ai"},
            {"id": "EV-02", "label": "Manufacturing log hold time", "kind": "Batch record", "source_ref": "Page 4",
             "quote": "Blend completed 28-Sep 14:10; transfer to compression 29-Sep 16:20 (26 h 10 min). Validated hold 12 h.",
             "relevance": "High", "verified": False, "origin": "ai"},
            {"id": "EV-03", "label": "Sampling procedure QC-SOP-221", "kind": "SOP", "source_ref": "Attachment 1",
             "quote": "Ten-point thief sampling; sampler qualification valid to 31-Aug-2026 (expired).",
             "relevance": "High", "verified": False, "origin": "ai"},
            {"id": "EV-04", "label": "Previous blend uniformity trend", "kind": "Lab result", "source_ref": "Attachment 2",
             "quote": "Previous 5 batches: RSD 1.9%, 2.2%, 2.6%, 2.1%, 2.4%.",
             "relevance": "Medium", "verified": False, "origin": "ai"},
        ],
        five_whys=[
            {"level": 1, "question": "Why was blend uniformity out of trend?",
             "answer": "Potency varied by up to 8.9 percentage points across the 10 sample points.",
             "evidence": ["EV-01"], "confidence": 0.8, "verified": False, "origin": "ai"},
            {"level": 2, "question": "Why did potency vary across the blender?",
             "answer": "The blend was held for 26 h before transfer, more than double the validated 12 h hold, allowing segregation.",
             "evidence": ["EV-01", "EV-02"], "confidence": 0.68, "verified": False, "origin": "ai"},
            {"level": 3, "question": "Why was the blend held for 26 h?",
             "answer": "Compression was rescheduled after an unplanned line clearance; no hold-time expiry control exists on the transfer bin.",
             "evidence": ["EV-02"], "confidence": 0.6, "verified": False, "origin": "ai"},
        ],
        fishbone=[
            {"id": "FB-01", "category": "Machine", "factor": "Extended hold in transfer bin TB-12",
             "rationale": "Segregation is time dependent; hold exceeded validation.", "evidence": ["EV-02"], "status": "suggested", "origin": "ai"},
            {"id": "FB-02", "category": "Method", "factor": "No hold-time expiry control at the bin",
             "rationale": "Nothing prevented use after 12 h.", "evidence": ["EV-02"], "status": "suggested", "origin": "ai"},
            {"id": "FB-03", "category": "Measurement", "factor": "Sampler qualification expired",
             "rationale": "Sampling error cannot be excluded.", "evidence": ["EV-03"], "status": "suggested", "origin": "ai"},
        ],
        root_causes=[
            {"id": "RC-01", "statement": "Segregation during a 26 h bin hold, beyond the validated 12 h hold time, caused the blend uniformity excursion.",
             "category": "Systemic", "confidence": 0.68, "rationale": "Hold time exceeded validation by more than 2x; previous batches within 12 h had RSD below 2.6%.",
             "evidence": ["EV-02", "EV-04"], "falsification": "Repeat sampling immediately after blending shows the same RSD.",
             "ruled_out": False, "status": "suggested", "origin": "ai"},
            {"id": "RC-02", "statement": "Sampling error by an unqualified sampler produced the out-of-trend result.",
             "category": "Measurement", "confidence": 0.35, "rationale": "Sampler qualification expired 31-Aug-2026; not yet excluded.",
             "evidence": ["EV-03"], "falsification": "Review of sampler qualification and repeat sampling by a qualified analyst.",
             "ruled_out": False, "status": "suggested", "origin": "ai"},
            {"id": "RC-03", "statement": "Raw material particle size distribution caused demixing.",
             "category": "Material", "confidence": 0.07, "rationale": "Excluded: input lot used in the previous three conforming batches.",
             "evidence": ["EV-04"], "falsification": "Not applicable.", "ruled_out": True, "status": "suggested", "origin": "ai"},
        ],
        gaps=[
            {"id": "GAP-01", "item": "Repeat blend uniformity by a qualified analyst", "why_needed": "Excludes sampling error (RC-02).",
             "request_from": "QC", "priority": "High", "status": "open", "origin": "ai"},
            {"id": "GAP-02", "item": "Hold-time validation report for AT-24096 blend", "why_needed": "Confirms the validated 12 h limit and its basis.",
             "request_from": "Validation", "priority": "High", "status": "open", "origin": "ai"},
            {"id": "GAP-03", "item": "Particle size distribution of granulate lot GR-24096", "why_needed": "Tests the material hypothesis.",
             "request_from": "QC", "priority": "Medium", "status": "open", "origin": "ai"},
        ],
        capa=[
            {"id": "CA-01", "type": "Corrective", "action": "Repeat the blend uniformity test with a qualified analyst before disposition.",
             "explanation": "Separates sampling error from a true blend failure.", "owner": "QC Head",
             "due_in_days": 3, "due_date": "2026-10-03", "priority": "High", "root_cause_ref": "GAP-01",
             "effectiveness_check": "Repeat result with RSD <= 3.5%.", "status": "suggested", "origin": "ai"},
            {"id": "CA-02", "type": "Preventive", "action": "Add a hold-time expiry label and system control at the transfer bin, with automatic QA notification after 12 h.",
             "explanation": "Prevents use beyond the validated hold time.", "owner": "Production Head",
             "due_in_days": 30, "due_date": "2026-10-30", "priority": "High", "root_cause_ref": "RC-01",
             "effectiveness_check": "Zero hold-time exceedances for 3 months; label in use on all bins.", "status": "suggested", "origin": "ai"},
        ],
        review={
            "verdict": "needs_review",
            "issues": [
                {"severity": "High", "issue": "Sampling error is not excluded before concluding segregation.",
                 "recommendation": "Obtain the repeat blend uniformity result first."},
                {"severity": "Medium", "issue": "Hold-time validation basis is not in the record.",
                 "recommendation": "Attach the validation report."},
            ],
            "notes": "Two plausible causes remain open; the record should not be approved until sampling error is excluded.",
        },
    )
    return payload


def seed_if_empty() -> None:
    db = SessionLocal()
    try:
        if (db.scalar(select(func.count()).select_from(Investigation)) or 0) > 0:
            return

        db.add_all(
            [
                User(name="Dr. Meera Krishnan", role="QA Head, Unit 2", email="meera.krishnan@aivoa-api.example"),
                User(name="Suresh Kulkarni", role="QC Head, Unit 2", email="s.kulkarni@aivoa-api.example"),
                User(name="Anita Rao", role="QC Analyst", email="anita.rao@aivoa-api.example"),
            ]
        )

        a = Investigation(
            code="RCA-2026-0003",
            title="High moisture content in Metformin HCl API batch MF-23107",
            status="approved",
            product_name="Metformin HCl USP (API)",
            batch_number="MF-23107",
            classification="Major",
            source_kind="pdf",
            payload=_seed_a(),
            provenance={},
            ai_meta={"provider": "groq", "model": "openai/gpt-oss-120b", "live": True},
            created_by="Dr. Meera Krishnan",
            updated_by="Dr. Meera Krishnan",
            created_at=NOW - timedelta(days=98),
            updated_at=NOW - timedelta(days=70),
            version=3,
        )
        b = Investigation(
            code="RCA-2026-0004",
            title="Blend uniformity out of trend - Atorvastatin Calcium batch AT-24096",
            status="in_review",
            product_name="Atorvastatin Calcium USP (API)",
            batch_number="AT-24096",
            classification="Minor",
            source_kind="email",
            payload=_seed_b(),
            provenance={},
            ai_meta={"provider": "groq", "model": "openai/gpt-oss-120b", "live": True},
            created_by="Dr. Meera Krishnan",
            updated_by="Dr. Meera Krishnan",
            created_at=NOW - timedelta(days=24),
            updated_at=NOW - timedelta(days=2),
            version=2,
        )
        db.add_all([a, b])
        db.flush()

        db.add_all(
            [
                AuditEvent(investigation_id=a.id, actor="Dr. Meera Krishnan", action="created",
                           detail={"code": a.code, "source": {"kind": "pdf"}},
                           created_at=NOW - timedelta(days=98)),
                AuditEvent(investigation_id=a.id, actor="RCA Copilot", action="ai.extraction",
                           detail={"fields": 18, "evidence": 4, "gaps": 2, "latency_ms": 18420},
                           created_at=NOW - timedelta(days=97)),
                AuditEvent(investigation_id=a.id, actor="RCA Copilot", action="ai.analysis",
                           detail={"root_causes": 2, "capa": 3, "review_issues": 0, "latency_ms": 26310},
                           created_at=NOW - timedelta(days=97)),
                AuditEvent(investigation_id=a.id, actor="Dr. Meera Krishnan", action="root_cause.confirmed",
                           detail={"ids": ["RC-01"]}, created_at=NOW - timedelta(days=71)),
                AuditEvent(investigation_id=a.id, actor="Dr. Meera Krishnan", action="signed",
                           detail={"signature": "ESIG-RCA-2026-0003-7F2A19", "meaning": "Reviewed and approved the investigation and CAPA", "role": "QA Head, Unit 2"},
                           created_at=NOW - timedelta(days=70)),
                AuditEvent(investigation_id=b.id, actor="Dr. Meera Krishnan", action="created",
                           detail={"code": b.code, "source": {"kind": "email"}},
                           created_at=NOW - timedelta(days=24)),
                AuditEvent(investigation_id=b.id, actor="RCA Copilot", action="ai.extraction",
                           detail={"fields": 17, "evidence": 4, "gaps": 3, "latency_ms": 15110},
                           created_at=NOW - timedelta(days=24)),
                AuditEvent(investigation_id=b.id, actor="RCA Copilot", action="ai.analysis",
                           detail={"root_causes": 3, "capa": 2, "review_issues": 2, "latency_ms": 24190},
                           created_at=NOW - timedelta(days=23)),
                AuditEvent(investigation_id=b.id, actor="Dr. Meera Krishnan", action="saved",
                           detail={"changed": ["five_whys", "root_causes"], "accepted_root_causes": [], "accepted_capa": []},
                           created_at=NOW - timedelta(days=2)),
            ]
        )

        db.add_all(
            [
                AiRun(investigation_id=a.id, kind="extraction", provider="groq", model="openai/gpt-oss-120b",
                      status="completed", result={"fields": 18, "evidence": 4, "gaps": 2}, latency_ms=18420,
                      created_at=NOW - timedelta(days=97)),
                AiRun(investigation_id=a.id, kind="analysis", provider="groq", model="openai/gpt-oss-120b",
                      status="completed", result={"five_whys": 3, "fishbone": 3, "root_causes": 2, "capa": 3},
                      latency_ms=26310, created_at=NOW - timedelta(days=97)),
                AiRun(investigation_id=b.id, kind="extraction", provider="groq", model="openai/gpt-oss-120b",
                      status="completed", result={"fields": 17, "evidence": 4, "gaps": 3}, latency_ms=15110,
                      created_at=NOW - timedelta(days=24)),
                AiRun(investigation_id=b.id, kind="analysis", provider="groq", model="openai/gpt-oss-120b",
                      status="completed", result={"five_whys": 3, "fishbone": 3, "root_causes": 3, "capa": 2},
                      latency_ms=24190, created_at=NOW - timedelta(days=23)),
            ]
        )
        db.commit()
        print("Seeded 2 investigations.")
    finally:
        db.close()
