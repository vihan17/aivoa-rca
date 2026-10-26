# Product demo — recording script

**Target length:** 7 min 30 s (allowed: 5–8 min)  
**Format:** screen recording with voice-over. 1440×900 or 1920×1080, browser at 100% zoom.  
**Start state:** `.\reset-demo.ps1` has been run; dashboard shows `RCA-2026-0003` (approved) and `RCA-2026-0004` (in review).

This script assumes the app is running with a **live Groq key**. The exact counts vary by run; use the numbers on screen rather than the examples below. If no key is configured, the same flow uses the deterministic **Demo engine** — say that explicitly and use the demo counts (14 evidence, 4 intake gaps, 6 Whys, 8 CAPA).

Live analysis usually takes 60–120 seconds. You can keep talking through the visible stage labels, or speed up that section 4× in the edit and add a caption: “analysis ~2 min, sped up”.

---

## Before you record

1. Run `.\reset-demo.ps1` to restore the seeded state.
2. Start the app with `.\run.ps1`, open **http://127.0.0.1:8000**, hard-refresh once.
3. Confirm the top-right provider badge says **Groq** and the dashboard AI-engine card says **Live**. If it says **Demo engine**, stop and check `backend\.env`.
4. Close DevTools, email, chat notifications and any window that shows `.env`, API keys or personal files.
5. Do one silent dry run. Then run `.\reset-demo.ps1` again before the real take.
6. Record at 30 fps or higher. Keep mouse movements deliberate; pause briefly after each click.

---

## 0:00 – 0:35 · Opening

**Screen:** dashboard, full page.

**Say:**

> “This is the Root Cause Analysis module I built for the AIVOA AI Product Engineer assignment. The user is a QA investigator at an API manufacturer. A deviation report, an email escalation, or a pasted shift note comes in, and the module turns it into a reviewable RCA record: extracted evidence, a 5 Whys chain, a fishbone, ranked causes, missing-evidence checks, CAPA, and an auditable sign-off. The scope is intentionally only RCA — no complaint, deviation, or change-control modules.”

**Action:** none. Let the dashboard breathe.

---

## 0:35 – 1:10 · Dashboard and scope

**Action:** move the cursor across the four stat cards, then the records table.

**Say:**

> “The dashboard shows open investigations, items awaiting QA review, open evidence gaps on active records, and AI runs. The two records here are seeded history: one approved Metformin investigation and one Atorvastatin blend-uniformity record still in review. The table exposes status, evidence count, CAPA count, causal confidence, and recency. The right rail is a QA review queue and the current AI provider.”

**Action:** point at the top-right engine badge and the disabled `CAPA tracking` / `Analytics` nav items.

**Say:**

> “The engine badge is deliberately honest. This run is using live Groq. Without a key the app falls back to a deterministic demo engine, so the whole workflow stays testable offline. CAPA tracking and analytics are visible as out-of-scope placeholders; I did not build those modules for this assignment.”

---

## 1:10 – 1:35 · Start a new investigation

**Action:** click **New investigation** (top right).

**Say:**

> “I’ll start a new investigation from the bundled deviation report. The workspace is a three-column review surface: record sections on the left, the editable RCA in the centre, and the copilot on the right. Nothing is saved yet.”

**Action:** in the right rail, point at **Upload file** and **Paste text / email**, then the sample cards.

**Say:**

> “A user can drop a PDF, an `.eml`, a `.txt`, or paste the email body. Parsing happens server-side, and the extracted source text is stored with the investigation. I’ll use the sample deviation report so the demo is reproducible.”

---

## 1:35 – 2:35 · Extract the incident

**Action:** click **Use** on the **Deviation report** sample card (the PDF card). Wait for the green “Sample loaded” toast to settle.

**Action:** click **Extract & fill investigation**.

**Say:**

> “Extraction is a LangGraph intake graph: read and segment the source, extract the structured fields, then build the investigation record with provenance. The stages stream over Server-Sent Events, so the user sees exactly which step is running instead of a generic spinner.”

**Action:** when extraction completes, point at the populated summary. With live Groq on the sample this is typically **19 fields**, **about 15 evidence**, and **about 5 intake gaps**. Read the actual on-screen numbers.

**Say:**

> “It has populated the incident fields — product, batch AT-24118, the OOS result, equipment, dates, impact, and source summary — plus evidence items and intake gaps. The exact count depends on the model. The point is not just autofill: every extracted value keeps a confidence score and a source quote, so the reviewer can check it rather than trust it.”

**Action:** hover one field’s AI badge or show a provenance marker. Then scroll to Evidence and open one evidence quote.

**Say:**

> “Each field is marked AI with its confidence. The evidence cards carry the exact quote and locator from the report. If I edit a field, the marker changes from AI to Edited — the record keeps the difference between what the model proposed and what the human changed.”

---

## 2:35 – 4:15 · Build the causal analysis

**Action:** in the copilot, click **Build root cause analysis**.

**Say:**

> “Now the analysis graph. It assembles a compact case file, builds the 5 Whys, runs a 6M fishbone, synthesises and ranks root-cause hypotheses, generates CAPA, then runs an independent QA critique before finalising. Each step emits a progress event. A live run typically takes one to two minutes, so the stages are doing real work rather than animating a fake spinner.”

**Action:** while it runs, point at each stage as it completes. Do not click a second time. When **Analysis ready** appears, point at the actual counts: typically **5 Whys**, **9–10 factors**, **4 causes**, **4–8 CAPA**, and **2–4 issues**.

**Say:**

> “The result is the 5 Whys chain, fishbone factors across the 6Ms, ranked cause candidates, CAPA actions, and the issues the QA critic wants a reviewer to look at. The numbers vary with a live model; the structure and the guardrails are the point. The model must link causes to evidence IDs and state what would falsify each hypothesis.”

---

## 4:15 – 5:00 · Review the causal chain

**Action:** click **Review causes →** (or scroll to **Root cause analysis**).

**Say:**

> “This is the part that matters for GMP: the AI does not get to declare a root cause. The candidates here cover two threads — thermal exposure from over-drying, and the RTD calibration gap that was missed after the CMMS migration. Each candidate shows its confidence, supporting evidence, assumptions, and a falsification test.”

**Action:** in **Root cause candidates**, click **Confirm as root cause** on **RC-01**. Do not confirm the others.

**Say:**

> “I’m confirming the leading candidate as the qualified reviewer. It is now marked Confirmed by Dr. Meera Krishnan; the other candidates stay as suggestions. That distinction is enforced in the data model, not just in the copy.”

**Action:** briefly show the 5 Whys and one fishbone category, then the **Independent QA critique** card.

**Say:**

> “The 5 Whys gives the linear causal path; the fishbone makes sure we tested the other 6M categories instead of anchoring on the first story. The QA critique is a second, faster model pass that looks for unsupported claims. It is advisory, but it gives the reviewer a challenge list.”

---

## 5:00 – 5:35 · Evidence and gaps

**Action:** click **Evidence** in the left rail.

**Say:**

> “Evidence is a first-class part of the record. Each item has a relevance level and a verification state. The reviewer can verify items one by one, or use this bulk action.”

**Action:** click **Verify high relevance**. Point at the verified count and the green verified chips.

**Say:**

> “That marks the high-relevance subset as checked. The remaining medium and low relevance items are not silently treated as verified. Below that, the copilot has consolidated the missing-evidence gaps from the intake and analysis passes and renumbered them, so the reviewer sees one clean list rather than duplicates.”

**Action:** scroll through the **Missing evidence & information** cards. Point at one gap’s priority and requester.

**Say:**

> “Each gap says what is missing, why it matters, how urgent it is, and who should provide it. These are the questions a GMP investigator would ask before signing the record: calibration history, the CMMS change-control impact assessment, drying validation, and so on.”

---

## 5:35 – 6:05 · CAPA

**Action:** click **CAPA** in the left rail. Scroll to the first action.

**Say:**

> “CAPA actions trace back to a cause, with an owner, due date, priority, and a measurable effectiveness check. These are proposals, not commitments. I’ll approve CA-01 and leave the rest for owner review.”

**Action:** click **Approve** on **CA-01**. Point at the approved count and the green Approved chip.

**Say:**

> “The record now has one confirmed cause and one approved CAPA action, which is the minimum the sign-off gate requires. The gate is enforced on the server as well as in the UI.”

---

## 6:05 – 6:35 · Missing-evidence email (optional)

**Action:** in the right rail, click the amber **open evidence gaps — draft the request** bar. (Alternative: **Draft evidence request** in the Evidence section.)

**Say:**

> “The gaps are not just a dashboard decoration. The copilot drafts an evidence-request email, grouped by owner, with the batch, the gap IDs, and the specific records requested. Outbound email is intentionally not automated — the user reviews and copies the draft into their mail client.”

**Action:** let the **Evidence request email** modal show. Point at the recipient, the gap list, and **Copy email**. Close the modal with the X or **Close**.

**Say:**

> “This is the loop between the investigation and the evidence it still needs. It keeps the reviewer from signing a record with invisible assumptions.”

---

## 6:35 – 7:15 · Save and sign off

**Action:** click **Save** (top right). Wait for the toast **RCA-2026-0005 saved**.

**Say:**

> “Saving persists the full payload, the provenance map, the source link, and an audit event. After a reset, the record gets the next code, RCA-2026-0005, and a version number.”

**Action:** click **Sign off** (top right). The sign-off modal opens.

**Say:**

> “Sign-off is a separate, explicit act. The readiness panel has already checked the prerequisites: record saved, a confirmed cause, an approved CAPA action, and the evidence review. The modal shows the attestations and the meaning of the signature.”

**Action:** check all three attestations. Optionally type a reviewer statement: “Residual gaps tracked as conditions; evidence review complete.”

**Say:**

> “I’m attesting that I reviewed the evidence, that the root cause is supported, and that the CAPA is adequate. The statement field is where I would document residual risk or justify an open gap. The signature records my identity, role, the meaning, the attestations, and a timestamp.”

**Action:** click **Sign & approve**. Wait for the green signed state.

**Say:**

> “The record is now approved and signed. It has a signature ID, the version is incremented, and a later saved amendment would invalidate this signature and return it to review. The audit trail is append-only in the application.”

---

## 7:15 – 7:40 · Audit trail and close

**Action:** click **Audit trail** in the left rail.

**Say:**

> “The audit trail is the reviewer’s evidence that the workflow happened: created, AI extraction, AI analysis, root cause confirmed, CAPA approved, saved, and signed — with actor, action, detail, and time.”

**Optional:** open **Ask copilot** and click **Challenge the leading cause**. With live Groq this is another model call; if it is slow, skip it. Then click **Investigations** in the breadcrumb.

**Screen:** dashboard, now with `RCA-2026-0005` approved at the top.

**Say:**

> “Back on the dashboard, the new investigation is approved. That is the product loop: evidence in, structured causal analysis, human confirmation, CAPA, signature, audit. The AI accelerates the investigation, but the qualified reviewer remains accountable for every conclusion.”

**Action:** stop recording. Run `.\reset-demo.ps1` to restore the starting state for a retake or the code walkthrough.

---

## Contingencies

- **Live counts differ from the examples:** use the on-screen numbers. Say “the exact counts depend on the model; the structure and the guardrails are what matter.”
- **Analysis takes longer than expected:** keep talking through the visible stage labels; do not click twice. If it exceeds your time budget, speed up the wait in the edit and caption it.
- **No Groq key:** say **Demo engine**, not live Groq. The demo counts are 19 fields, 14 evidence, 4 intake gaps, 6 Whys, 10 factors, 4 causes, 8 CAPA, 8 gaps.
- **Groq returns an error:** stop, check the API log, reset, and retake. Do not show the terminal or `.env` on camera.
- **A toast covers the rail:** toasts are bottom-left and clear in 4.5 seconds; wait briefly rather than fighting the UI.
- **You need to shorten to 5 minutes:** cut the email section, the audit walkthrough, and the copilot question; keep extraction, analysis, human confirmation, CAPA, and sign-off.
