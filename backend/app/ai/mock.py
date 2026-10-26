"""Offline demo engine.

This is a deterministic, clinically realistic response set for the bundled
'Atorvastatin AT-24118' deviation. It exists so the product can be demoed and
tested before a Groq key is configured, and it is always labelled in the UI as
the demo engine. When GROQ_API_KEY is set, all inference goes to Groq and this
module is not used.
"""
from __future__ import annotations

import asyncio

from .schemas import (
    AnalysisResult,
    CapaResult,
    ChatResult,
    IntakeResult,
    ReviewResult,
)

PROVIDER_NAME = "demo-engine"
MODEL_NAME = "aivoa-rca-demo-v1"

INTAKE = {
    "document_type": "Deviation Report",
    "source_summary": (
        "Batch AT-24118 of Atorvastatin Calcium USP failed release testing for the specified "
        "impurity desfluoro atorvastatin (0.42% vs NMT 0.30%) and assay (97.1% vs 98.0-102.0%). "
        "The batch was dried for 9 h 30 min, beyond the 8 h limit, and a handheld check recorded "
        "79.4 C while the controller displayed 66-68 C."
    ),
    "incident": {
        "title": "OOS impurity in Atorvastatin Calcium API batch AT-24118 after over-drying",
        "description": (
            "QC release testing on 12-Oct-2026 found desfluoro atorvastatin at 0.42% w/w "
            "(specification NMT 0.30%) and assay 97.1% w/w (98.0-102.0%) in batch AT-24118. "
            "The batch was dried in vacuum tray dryer VD-02 for 9 h 30 min at a controller-recorded "
            "66.2-67.4 C; the BPR limit is NMT 8 h at 65-70 C. A handheld reference reading of "
            "79.4 C at 06:40 on 09-Oct-2026 was recorded but not escalated. Total impurities were "
            "0.71% w/w against a limit of NMT 1.0%."
        ),
        "deviation_type": "Unplanned",
        "classification": "Major",
        "date_occurred": "2026-10-09",
        "date_detected": "2026-10-12",
        "reported_by": "Anita Rao, QC Analyst",
        "site_area": "Unit 2, Building B, Drying Room DR-04",
        "department": "Quality Control",
        "product_name": "Atorvastatin Calcium USP (API)",
        "product_code": "API-ATV-02",
        "batch_number": "AT-24118",
        "batch_size": "250 kg",
        "process_stage": "Vacuum tray drying (final unit operation before milling)",
        "equipment": "Vacuum tray dryer VD-02; RTD temperature probe TT-207",
        "immediate_action": (
            "Batch AT-24118 and retain samples quarantined under QA hold QA-H-2026-118. "
            "VD-02 blocked for use pending instrument verification. Remaining campaign drying stopped."
        ),
        "impact_assessment": (
            "No patient exposure: the batch has not been released. The impurity is a known thermal "
            "degradant, so other batches dried on VD-02 after the last calibration on 15-Sep-2026 may "
            "be affected. AT-24116 and AT-24117 passed release."
        ),
        "investigation_scope": (
            "Drying step of AT-24118; calibration status of TT-207; all batches of any product dried "
            "on VD-02 since 15-Sep-2026; impact of CMMS migration CC-2026-041 on calibration schedules."
        ),
    },
    "evidence": [
        {
            "id": "EV-01",
            "label": "BPR AT-24118 drying log, page 7",
            "kind": "Batch record",
            "source_ref": "Page 2",
            "quote": (
                "Drying 09-Oct-2026 02:10 to 11:40 (9 h 30 min). Controller temperatures every 2 h: "
                "66.2, 67.1, 66.8, 67.4, 67.0 C. Limit NMT 8 h at 65-70 C."
            ),
            "relevance": "High",
        },
        {
            "id": "EV-02",
            "label": "Calibration certificate CAL-2025-8841 (TT-207)",
            "kind": "Calibration record",
            "source_ref": "Page 3",
            "quote": "TT-207 last calibrated 15-Sep-2025, next due 15-Sep-2026. Overdue by 24 days at batch execution.",
            "relevance": "High",
        },
        {
            "id": "EV-03",
            "label": "Handheld verification note, BPR page 9",
            "kind": "Batch record",
            "source_ref": "Page 2",
            "quote": (
                "09-Oct-2026 06:40 handheld reference thermometer 79.4 C at jacket outlet. Operator: "
                "'higher than controller, controller reading OK, continued'."
            ),
            "relevance": "High",
        },
        {
            "id": "EV-04",
            "label": "CMMS work-order export for TT-207",
            "kind": "Equipment log",
            "source_ref": "Attachment 2",
            "quote": "No calibration work order raised for TT-207 after 12-Mar-2026. CMMS migration CC-2026-041 live 01-Aug-2026.",
            "relevance": "High",
        },
        {
            "id": "EV-05",
            "label": "Change control CC-2026-041",
            "kind": "Change control",
            "source_ref": "Page 3",
            "quote": (
                "Scope: migration of asset master data and maintenance history from CMMS v6 to v8. "
                "Impact assessment explicitly excludes maintenance plan and calibration schedule validation."
            ),
            "relevance": "High",
        },
        {
            "id": "EV-06",
            "label": "QC release result, AT-24118",
            "kind": "Lab result",
            "source_ref": "Page 1",
            "quote": (
                "Desfluoro atorvastatin 0.42% w/w (limit NMT 0.30%); assay 97.1% w/w (98.0-102.0%); "
                "total impurities 0.71% w/w (limit NMT 1.0%)."
            ),
            "relevance": "High",
        },
        {
            "id": "EV-07",
            "label": "Batch history AT-24116 / AT-24117",
            "kind": "Batch record",
            "source_ref": "Page 3",
            "quote": (
                "AT-24116 and AT-24117, same API lot and recovered solvent lot, passed release; dried "
                "7 h 15 min and 7 h 45 min at 66-68 C."
            ),
            "relevance": "Medium",
        },
        {
            "id": "EV-08",
            "label": "HPLC system suitability, AT-24118",
            "kind": "Lab result",
            "source_ref": "Attachment 1",
            "quote": "System suitability passed: resolution 2.4, tailing 1.08. No repeat injection or laboratory error recorded.",
            "relevance": "Medium",
        },
        {
            "id": "EV-09",
            "label": "Raw material and solvent COAs",
            "kind": "Lab result",
            "source_ref": "Attachment 3",
            "quote": (
                "Precursor lot RM-26-0912 and recovered toluene lot SOL-26-077 within specification; "
                "the same lots were used in passing batches AT-24116 and AT-24117."
            ),
            "relevance": "Medium",
        },
        {
            "id": "EV-10",
            "label": "SOP QA-SOP-114 rev 4, drying operation",
            "kind": "SOP",
            "source_ref": "Attachment 4",
            "quote": (
                "Drying temperature verified by PLC display. Independent handheld verification required "
                "at start and every 2 h; second-person verification removed in rev 4 (2023). No stop-work "
                "trigger is defined for a temperature excursion."
            ),
            "relevance": "High",
        },
        {
            "id": "EV-11",
            "label": "Training record, R. Patil",
            "kind": "Training record",
            "source_ref": "Attachment 5",
            "quote": "Night-shift operator trained on QA-SOP-114 rev 4 on 18-Nov-2024; no refresher since. Training matrix current.",
            "relevance": "Medium",
        },
        {
            "id": "EV-12",
            "label": "Deviation history for VD-02",
            "kind": "Other",
            "source_ref": "Attachment 6",
            "quote": (
                "DEV-2025-031 and DEV-2026-009 both concern drying temperature excursions on VD-02; "
                "both closed with operator counselling and no calibration review."
            ),
            "relevance": "High",
        },
        {
            "id": "EV-13",
            "label": "Calibration programme review, CC-2026-041",
            "kind": "Calibration record",
            "source_ref": "Attachment 7",
            "quote": (
                "14 instruments migrated; 3 have no calibration work order after migration "
                "(TT-207, PT-114, FT-208)."
            ),
            "relevance": "High",
        },
        {
            "id": "EV-14",
            "label": "Stability status, AT-24118",
            "kind": "Other",
            "source_ref": "Page 3",
            "quote": "Accelerated stability not initiated. Desfluoro atorvastatin is a known thermal degradant of atorvastatin.",
            "relevance": "Medium",
        },
    ],
    "intake_gaps": [
        {
            "item": "Raw trend data / chart-recorder export for VD-02, 08-10 Oct 2026",
            "why_needed": "Confirms the actual temperature profile rather than controller-displayed values.",
        },
        {
            "item": "As-found calibration report for TT-207",
            "why_needed": "Quantifies the probe bias and supports the causal link to over-drying.",
        },
        {
            "item": "Interview statement from the night-shift operator",
            "why_needed": "Establishes why the 79.4 C handheld reading was not escalated.",
        },
        {
            "item": "Disposition status of all batches dried on VD-02 since 15-Sep-2026",
            "why_needed": "Bounds the batch-impact assessment and potential regulatory exposure.",
        },
    ],
    "field_confidence": {
        "title": 0.9,
        "description": 0.94,
        "deviation_type": 0.9,
        "classification": 0.62,
        "date_occurred": 0.86,
        "date_detected": 0.95,
        "reported_by": 0.92,
        "site_area": 0.88,
        "department": 0.9,
        "product_name": 0.96,
        "product_code": 0.93,
        "batch_number": 0.98,
        "batch_size": 0.9,
        "process_stage": 0.88,
        "equipment": 0.95,
        "immediate_action": 0.86,
        "impact_assessment": 0.78,
        "investigation_scope": 0.7,
    },
    "field_citations": {
        "batch_number": {"quote": "Batch No. AT-24118, Atorvastatin Calcium USP", "ref": "Page 1"},
        "product_name": {"quote": "Atorvastatin Calcium USP (API), material code API-ATV-02", "ref": "Page 1"},
        "batch_size": {"quote": "Batch size: 250 kg", "ref": "Page 1"},
        "date_occurred": {"quote": "Drying 09-Oct-2026 02:10 to 11:40 (9 h 30 min)", "ref": "Page 2"},
        "date_detected": {"quote": "QC release testing completed 12-Oct-2026", "ref": "Page 1"},
        "equipment": {"quote": "Vacuum tray dryer VD-02, RTD TT-207", "ref": "Page 2"},
        "description": {"quote": "Desfluoro atorvastatin 0.42% w/w against limit NMT 0.30%", "ref": "Page 1"},
        "immediate_action": {"quote": "Batch placed under QA hold QA-H-2026-118; VD-02 blocked", "ref": "Page 2"},
        "classification": {"quote": "Potential OOS release failure; no patient exposure", "ref": "Page 1"},
    },
}

ANALYSIS = {
    "five_whys": [
        {
            "level": 1,
            "question": "Why did batch AT-24118 exceed the specified impurity limit?",
            "answer": (
                "The batch was dried at approximately 78-80 C for 9 h 30 min, outside the validated "
                "65-70 C / NMT 8 h envelope, causing thermal degradation to desfluoro atorvastatin "
                "(0.42% w/w against NMT 0.30%)."
            ),
            "evidence": ["EV-01", "EV-03", "EV-06"],
            "confidence": 0.86,
            "verified": False,
        },
        {
            "level": 2,
            "question": "Why was the batch dried above the validated temperature?",
            "answer": (
                "RTD TT-207 had a positive measurement bias of about +11 C: the controller displayed "
                "66-68 C while the true drying temperature was approximately 78-80 C."
            ),
            "evidence": ["EV-02", "EV-03", "EV-04"],
            "confidence": 0.8,
            "verified": False,
        },
        {
            "level": 3,
            "question": "Why was the TT-207 bias not detected and corrected?",
            "answer": (
                "The probe was 24 days past its calibration due date (15-Sep-2026) and no calibration "
                "work order existed after 12-Mar-2026, so the drift was never measured."
            ),
            "evidence": ["EV-02", "EV-04", "EV-13"],
            "confidence": 0.82,
            "verified": False,
        },
        {
            "level": 4,
            "question": "Why was there no calibration work order for TT-207?",
            "answer": (
                "The CMMS v6 to v8 migration (CC-2026-041) moved asset master data but dropped "
                "maintenance and calibration schedules for 14 instruments; its impact assessment "
                "explicitly excluded schedule validation."
            ),
            "evidence": ["EV-04", "EV-05", "EV-13"],
            "confidence": 0.78,
            "verified": False,
        },
        {
            "level": 5,
            "question": "Why did the change control exclude calibration schedules?",
            "answer": (
                "The change was risk-assessed purely as an IT data migration, and the change control "
                "procedure has no mandatory maintenance, calibration or validation impact question for "
                "computerized system changes."
            ),
            "evidence": ["EV-05"],
            "confidence": 0.72,
            "verified": False,
        },
        {
            "level": 6,
            "question": "Why did the 79.4 C handheld reading not stop the batch?",
            "answer": (
                "QA-SOP-114 rev 4 requires independent handheld checks but defines no response or "
                "stop-work trigger for an excursion, and removed second-person verification; the "
                "operator treated the controller as authoritative."
            ),
            "evidence": ["EV-03", "EV-10", "EV-11"],
            "confidence": 0.66,
            "verified": False,
        },
    ],
    "fishbone": [
        {
            "id": "FB-01",
            "category": "Man",
            "factor": "Night-shift operator did not escalate a 79.4 C handheld reading",
            "rationale": "Recorded 'higher than controller, controller reading OK, continued'; training positioned the PLC as authoritative.",
            "evidence": ["EV-03", "EV-11"],
            "status": "suggested",
        },
        {
            "id": "FB-02",
            "category": "Man",
            "factor": "No second-person verification of drying temperature",
            "rationale": "Second-person check was removed from QA-SOP-114 rev 4, leaving a single operator to interpret the discrepancy.",
            "evidence": ["EV-10"],
            "status": "suggested",
        },
        {
            "id": "FB-03",
            "category": "Machine",
            "factor": "RTD TT-207 operating with an uncorrected +11 C bias",
            "rationale": "Explains the gap between controller display (66-68 C) and handheld reference (79.4 C).",
            "evidence": ["EV-02", "EV-03"],
            "status": "suggested",
        },
        {
            "id": "FB-04",
            "category": "Machine",
            "factor": "VD-02 control loop relies on a single temperature input with no cross-check",
            "rationale": "No automatic plausibility check against a second sensor or the jacket reference.",
            "evidence": ["EV-10"],
            "status": "suggested",
        },
        {
            "id": "FB-05",
            "category": "Material",
            "factor": "No material contributor identified in the reviewed records",
            "rationale": "Precursor and recovered solvent lots were within specification and the same lots were used in passing batches.",
            "evidence": ["EV-09", "EV-07"],
            "status": "suggested",
        },
        {
            "id": "FB-06",
            "category": "Method",
            "factor": "QA-SOP-114 rev 4 has no stop-work or deviation trigger for a temperature excursion",
            "rationale": "The excursion was recorded but not actioned; the SOP defines recording, not response.",
            "evidence": ["EV-10"],
            "status": "suggested",
        },
        {
            "id": "FB-07",
            "category": "Method",
            "factor": "Prior similar deviations closed with counselling only",
            "rationale": "DEV-2025-031 and DEV-2026-009 did not trigger a calibration or SOP review, so the systemic weakness persisted.",
            "evidence": ["EV-12"],
            "status": "suggested",
        },
        {
            "id": "FB-08",
            "category": "Measurement",
            "factor": "Calibration schedules for 14 instruments lost in the CMMS migration",
            "rationale": "CC-2026-041 migrated asset master data but excluded calibration schedule validation.",
            "evidence": ["EV-04", "EV-05", "EV-13"],
            "status": "suggested",
        },
        {
            "id": "FB-09",
            "category": "Measurement",
            "factor": "Three migrated instruments have no work order (TT-207, PT-114, FT-208)",
            "rationale": "Indicates a programme-level failure rather than a single missed calibration.",
            "evidence": ["EV-13"],
            "status": "suggested",
        },
        {
            "id": "FB-10",
            "category": "Environment",
            "factor": "No environmental excursion identified in the reviewed records",
            "rationale": "Drying-room conditions were within limits; environmental monitoring is not implicated.",
            "evidence": [],
            "status": "suggested",
        },
    ],
    "root_causes": [
        {
            "id": "RC-01",
            "statement": (
                "Inadequate change control impact assessment for the CMMS v6 to v8 migration "
                "(CC-2026-041) dropped the calibration schedule for TT-207 and 13 other instruments, "
                "allowing a +11 C probe bias to go undetected and over-dry batch AT-24118."
            ),
            "category": "Systemic",
            "confidence": 0.86,
            "rationale": (
                "This single failure explains the measurement bias, the absence of a work order, the "
                "nine other affected instruments and the previous unaddressed VD-02 excursions."
            ),
            "evidence": ["EV-02", "EV-04", "EV-05", "EV-13", "EV-12"],
            "falsification": (
                "As-found calibration shows TT-207 within +/-1 C, or work-order records prove "
                "calibration was performed before 09-Oct-2026."
            ),
            "ruled_out": False,
            "status": "suggested",
        },
        {
            "id": "RC-02",
            "statement": (
                "QA-SOP-114 rev 4 removed second-person temperature verification and defines no "
                "stop-work trigger, so the 79.4 C independent reading did not halt the drying step."
            ),
            "category": "Method",
            "confidence": 0.72,
            "rationale": (
                "The SOP required the check but not a response, and the BPR has no field that would "
                "force an excursion decision. This is a latent control gap independent of the migration."
            ),
            "evidence": ["EV-03", "EV-10", "EV-12"],
            "falsification": "BPR or shift handover shows a documented excursion decision at 06:40 on 09-Oct-2026.",
            "ruled_out": False,
            "status": "suggested",
        },
        {
            "id": "RC-03",
            "statement": (
                "The night-shift operator did not escalate the 79.4 C handheld reading, having been "
                "trained to treat the PLC display as the authoritative value."
            ),
            "category": "Man",
            "confidence": 0.55,
            "rationale": (
                "A direct human-factor contributor, but secondary: a competent operator was placed in "
                "a system with no defined escalation trigger."
            ),
            "evidence": ["EV-03", "EV-11"],
            "falsification": "Interview or alarm log shows escalation was attempted and not actioned.",
            "ruled_out": False,
            "status": "suggested",
        },
        {
            "id": "RC-04",
            "statement": "Raw material or recovered solvent quality caused the impurity result.",
            "category": "Material",
            "confidence": 0.05,
            "rationale": "Excluded: both lots were within specification and the same lots passed in AT-24116 and AT-24117.",
            "evidence": ["EV-09", "EV-07"],
            "falsification": "Not applicable - evidence contradicts this hypothesis.",
            "ruled_out": True,
            "status": "suggested",
        },
    ],
    "gaps": [
        {
            "id": "GAP-01",
            "item": "Chart-recorder / raw trend export for VD-02, 08-10 Oct 2026",
            "why_needed": "Confirms the true temperature profile and duration independent of the biased controller.",
            "request_from": "Production / Engineering",
            "priority": "High",
            "status": "open",
        },
        {
            "id": "GAP-02",
            "item": "As-found and as-left calibration report for TT-207",
            "why_needed": "Quantifies the bias and directly tests RC-01.",
            "request_from": "Metrology",
            "priority": "High",
            "status": "open",
        },
        {
            "id": "GAP-03",
            "item": "Interview statement from operator R. Patil",
            "why_needed": "Establishes why the 79.4 C reading was not escalated (RC-02 / RC-03).",
            "request_from": "Production Head",
            "priority": "High",
            "status": "open",
        },
        {
            "id": "GAP-04",
            "item": "Batch impact list: all batches dried on VD-02 since 15-Sep-2026",
            "why_needed": "Bounds the scope of the failure and prevents release of other affected batches.",
            "request_from": "QA / Production Planning",
            "priority": "High",
            "status": "open",
        },
        {
            "id": "GAP-05",
            "item": "Calibration status assessment for PT-114 and FT-208",
            "why_needed": "Determines whether the migration affected pressure and flow control in other processes.",
            "request_from": "Engineering",
            "priority": "High",
            "status": "open",
        },
        {
            "id": "GAP-06",
            "item": "Impurity profile or forced-degradation data linking over-drying to desfluoro atorvastatin",
            "why_needed": "Converts the thermal-degradation mechanism from inference to evidence.",
            "request_from": "QC / AR&D",
            "priority": "Medium",
            "status": "open",
        },
        {
            "id": "GAP-07",
            "item": "Maintenance technician statement and probe replacement history",
            "why_needed": "Rules out a known probe failure that was reported but not recorded.",
            "request_from": "Maintenance",
            "priority": "Medium",
            "status": "open",
        },
        {
            "id": "GAP-08",
            "item": "Stability / retest strategy for AT-24118",
            "why_needed": "Supports the disposition decision and residual-risk assessment.",
            "request_from": "QA / QC",
            "priority": "High",
            "status": "open",
        },
    ],
    "causal_summary": (
        "The CMMS migration change control failed to protect calibration schedules, so TT-207 ran "
        "24 days overdue and drifted +11 C. The controller therefore displayed 66-68 C while the dryer "
        "actually ran at 78-80 C for 9.5 h. The drying SOP required a handheld check but no response, "
        "so the 79.4 C reading was recorded and ignored. The combination drove thermal degradation of "
        "atorvastatin to desfluoro atorvastatin above the 0.30% limit."
    ),
}

CAPA = {
    "capa": [
        {
            "id": "CA-01",
            "type": "Corrective",
            "action": "Remove TT-207 from service, perform an as-found calibration, replace or adjust the RTD, and verify VD-02 temperature uniformity against an independent reference at 65, 70 and 80 C.",
            "explanation": "Eliminates the measurement bias that caused over-drying and quantifies the as-found error.",
            "owner": "Maintenance Head",
            "due_in_days": 3,
            "priority": "High",
            "root_cause_ref": "RC-01",
            "effectiveness_check": "As-found bias documented; post-calibration error within +/-0.5 C at all three setpoints.",
            "status": "suggested",
        },
        {
            "id": "CA-02",
            "type": "Corrective",
            "action": "Complete a batch impact assessment for every batch of any product dried on VD-02 since 15-Sep-2026 and hold affected batches pending disposition.",
            "explanation": "Contains the quality impact beyond AT-24118, as required by the investigation scope.",
            "owner": "QA Head",
            "due_in_days": 5,
            "priority": "High",
            "root_cause_ref": "RC-01",
            "effectiveness_check": "100% of batches in the window dispositioned with documented QA rationale.",
            "status": "suggested",
        },
        {
            "id": "CA-03",
            "type": "Corrective",
            "action": "Generate an impurity profile and a stability/retest strategy for AT-24118 before any disposition decision; reject if the degradant remains above 0.30%.",
            "explanation": "Provides the product-quality evidence needed to disposition the batch.",
            "owner": "QC Head",
            "due_in_days": 7,
            "priority": "High",
            "root_cause_ref": "RC-01",
            "effectiveness_check": "Stability protocol executed and disposition approved by QA.",
            "status": "suggested",
        },
        {
            "id": "CA-04",
            "type": "Preventive",
            "action": "Restore and verify calibration and maintenance schedules for all 14 instruments in CC-2026-041, then audit the full asset register for orphaned schedules.",
            "explanation": "Removes the programme-level defect that allowed three instruments to lose their work orders.",
            "owner": "Engineering Head",
            "due_in_days": 15,
            "priority": "High",
            "root_cause_ref": "RC-01",
            "effectiveness_check": "Zero instruments without a future calibration date; audit report signed by QA.",
            "status": "suggested",
        },
        {
            "id": "CA-05",
            "type": "Preventive",
            "action": "Revise the change control SOP and checklist to require a documented maintenance, calibration and validation impact assessment for any computerized system or data migration.",
            "explanation": "Prevents recurrence of the systemic root cause in future system changes.",
            "owner": "QA Head",
            "due_in_days": 30,
            "priority": "High",
            "root_cause_ref": "RC-01",
            "effectiveness_check": "Revised SOP effective; the next three computerized-system changes include a completed impact assessment.",
            "status": "suggested",
        },
        {
            "id": "CA-06",
            "type": "Preventive",
            "action": "Revise QA-SOP-114 and the BPR to require independent temperature verification at start and every 2 h, with a defined stop-work and deviation trigger for any excursion above 3 C.",
            "explanation": "Closes the procedural gap that let the 79.4 C reading pass without action.",
            "owner": "Production Head",
            "due_in_days": 30,
            "priority": "Medium",
            "root_cause_ref": "RC-02",
            "effectiveness_check": "Revised BPR in use; 100% of drying records show independent checks over 3 months.",
            "status": "suggested",
        },
        {
            "id": "CA-07",
            "type": "Preventive",
            "action": "Retrain all dryer operators and supervisors on probe failure modes, independent verification and stop-work authority, with a documented competency check.",
            "explanation": "Addresses the human-factor contributor without treating it as the primary cause.",
            "owner": "QA Training Lead",
            "due_in_days": 45,
            "priority": "Medium",
            "root_cause_ref": "RC-03",
            "effectiveness_check": "100% of 24 operators pass the competency assessment; refresher added to the annual matrix.",
            "status": "suggested",
        },
        {
            "id": "CA-08",
            "type": "Preventive",
            "action": "Implement automated 30-day calibration-due alerts and a monthly overdue-calibration KPI reviewed at quality management review.",
            "explanation": "Adds a detection layer so a lost schedule cannot persist unnoticed.",
            "owner": "Engineering Head",
            "due_in_days": 60,
            "priority": "Medium",
            "root_cause_ref": "RC-01",
            "effectiveness_check": "KPI reported monthly; zero overdue calibrations for 3 consecutive months.",
            "status": "suggested",
        },
    ],
    "conclusion": (
        "The OOS impurity in AT-24118 is most probably caused by thermal degradation during over-drying, "
        "secondary to a +11 C bias in RTD TT-207 that went undetected because its calibration schedule was "
        "lost in the CMMS migration. Both the change control impact assessment and the drying SOP failed to "
        "prevent or detect the condition. Batch disposition and CAPA adequacy remain subject to QA approval; "
        "residual risk includes other batches dried on VD-02 in the affected window."
    ),
}

REVIEW = {
    "verdict": "needs_review",
    "issues": [
        {
            "severity": "High",
            "issue": "The batch impact scope only covers VD-02, while PT-114 and FT-208 also lost calibration work orders.",
            "recommendation": "Extend the impact assessment to those instruments and their processes before closing the investigation.",
        },
        {
            "severity": "Medium",
            "issue": "The link between 9.5 h drying and degradant formation is inferred, not demonstrated.",
            "recommendation": "Attach forced-degradation or impurity-profile data before the root cause is confirmed.",
        },
        {
            "severity": "Low",
            "issue": "The operator-factor cause may be overstated relative to the SOP design gap.",
            "recommendation": "Confirm with the interview statement before assigning individual accountability.",
        },
    ],
    "notes": (
        "The causal chain is coherent and well evidenced, and CAPA traces to the leading cause. The main "
        "residual risk is scope: the calibration programme failure affects more than one asset."
    ),
}


async def demo_delay(seconds: float = 0.5) -> None:
    await asyncio.sleep(seconds)


def intake(_: str) -> IntakeResult:
    return IntakeResult.model_validate(INTAKE)


def analysis(_: dict) -> AnalysisResult:
    return AnalysisResult.model_validate(ANALYSIS)


def capa(_: dict, __: dict) -> CapaResult:
    return CapaResult.model_validate(CAPA)


def review(_: dict, __: dict, ___: dict) -> ReviewResult:
    return ReviewResult.model_validate(REVIEW)


def chat(question: str, record: dict) -> ChatResult:
    q = question.lower()
    if "challenge" in q or "weak" in q or "critique" in q:
        return ChatResult(answer=(
            "The leading cause holds up, but two challenges should be documented:\n"
            "- The +11 C bias is inferred from a single handheld reading; the as-found calibration report is still missing (GAP-02).\n"
            "- The thermal-degradation mechanism is plausible but not demonstrated; forced-degradation data is still missing (GAP-06).\n"
            "I would keep RC-01 as the confirmed cause, record both gaps as open conditions, and request the calibration and AR&D data before closure. If GAP-02 shows no bias, reopen the cause review."
        ))
    if "missing" in q or "evidence" in q or "gap" in q:
        gaps = record.get("gaps") or []
        if gaps:
            lines = [f"- {g.get('item')} ({g.get('priority', 'Medium')}, from {g.get('request_from', 'QA')})" for g in gaps[:5]]
            return ChatResult(answer="The highest-value missing evidence is:\n" + "\n".join(lines) + "\n\nThe first two could confirm or falsify RC-01, so request them before sign-off.")
    if "email" in q or "request" in q or "draft" in q:
        return ChatResult(answer=email_text(record.get("gaps", []), record))
    if "capa" in q or "action" in q:
        return ChatResult(answer=(
            "The CAPA set has 8 actions: 3 corrective (recalibrate TT-207, bound batch impact, stability/disposition) "
            "and 5 preventive (restore all schedules, change-control revision, SOP/BPR revision, retraining, calibration KPI). "
            "The strongest actions are CA-04 and CA-05 because they address the systemic cause."
        ))
    if "why" in q or "root cause" in q or "summary" in q:
        return ChatResult(answer=(
            "Leading hypothesis (RC-01, confidence 0.86): the CMMS migration dropped TT-207's calibration schedule, "
            "so a +11 C probe bias went undetected and the batch over-dried at ~78-80 C for 9.5 h, forming desfluoro "
            "atorvastatin above the limit. The SOP's missing stop-work trigger (RC-02) is a contributing control gap. "
            "Confirm with the as-found calibration report and the raw trend data."
        ))
    return ChatResult(answer=(
        "I can help with the causal chain, missing evidence, CAPA rationale, or a draft evidence-request email. "
        "The record currently has 6 Whys levels, 10 fishbone factors and 4 root-cause candidates (one ruled out)."
    ))


def email_text(gaps: list[dict], context: dict | None = None) -> str:
    code = (context or {}).get("code") or "the investigation"
    lines = [
        "Subject: Evidence request - AT-24118 OOS impurity investigation",
        "",
        "Dear Colleagues,",
        "",
        "We are investigating the OOS impurity result for Atorvastatin Calcium API batch AT-24118 "
        "(desfluoro atorvastatin 0.42% w/w vs NMT 0.30%). To confirm the root cause and bound the batch impact, "
        "please provide the following by 27-Oct-2026:",
        "",
    ]
    for idx, gap in enumerate(gaps[:6], start=1):
        lines.append(f"{idx}. {gap.get('item')} - {gap.get('why_needed')}")
    lines += [
        "",
        "Please send the records to the QA investigation folder and reference the investigation number in your reply.",
        "",
        "Regards,",
        "QA Investigation Lead",
    ]
    return "\n".join(lines)
