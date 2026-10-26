# Code walkthrough — recording script

**Target length:** 8 min 30 s (allowed: 5–10 min)  
**Format:** screen recording with voice-over. Open the repository in an editor with a large font (14–16 px) and a clean theme. Keep terminal windows off-screen unless you are showing a test.

**What to show:** the architecture and the decisions that make the AI usable in a GMP review workflow. Do not narrate every line; show the graph, the schemas, the provenance, the sign-off gate, and the tests.

---

## Before you record

1. Open `C:\Users\Chetan\aivoa-rca` in the editor.
2. Close all files except the ones named in each section. Use split panes only when comparing two files.
3. Have the app running at **http://127.0.0.1:8000** in a browser tab in case you want to connect code to UI.
4. If you show a terminal, use PowerShell at the repo root with a readable prompt. Do not show `backend/.env`.
5. Do a silent pass once. The walkthrough should feel like a design review, not a file tour.

---

## 0:00 – 0:40 · Frame the problem and the stack

**Show:** `README.md`, top section.

**Say:**

> “This is a working RCA module for an API manufacturer. The user is a QA investigator. The problem is not simply filling a form — it is turning an unstructured deviation into evidence that a reviewer can defend, while keeping the reviewer accountable. The stack is React 18 with Redux Toolkit on the front end, FastAPI and SQLAlchemy on the back end, MySQL 8 for persistence, and LangGraph with Groq for the AI workflow. The scope is intentionally only RCA.”

**Point at:** the architecture block in `README.md`.

**Say:**

> “There are two graphs. Intake turns a source into a structured record. Analysis turns that record into a causal case. The API streams each graph node over Server-Sent Events, so the UI can show real progress instead of a fake spinner.”

---

## 0:40 – 1:40 · Request flow and frontend state

**Show:** `frontend/src/lib/api.ts`, then `frontend/src/hooks/useRcaActions.ts`, then `frontend/src/store/investigationSlice.ts`.

**Say:**

> “On the client, `postStream` uses `fetch` with a readable stream, parses SSE frames separated by a blank line, and dispatches stage events. I deliberately did not use `EventSource`, because these are POST requests with a JSON body and a source ID; a reader-based stream keeps the API shape simple.”

**Point at:** `postStream` and `ai.extract` / `ai.analyze`.

**Say:**

> “`useRcaActions` is the orchestration boundary. It starts the run, forwards stages into the copilot slice, and on the final result dispatches `applyIntake` or `applyAnalysis` into the investigation slice. The UI never talks to the model directly, and the model never writes to the database directly.”

**Show:** `investigationSlice.ts`, `markHuman`, `setField`, `verifyHighRelevance`, `acceptRootCause`.

**Say:**

> “The Redux slice is where the human/AI distinction lives. `setField` calls `markHuman`, which overwrites that field’s provenance with source `human`. `acceptRootCause` changes the status to accepted and records the reviewer and timestamp. `verifyHighRelevance` is a single reducer action over the evidence array. The point is that provenance is data, not a CSS badge.”

**Optional:** show `Workspace.tsx` briefly for the three-column layout and the save/sign-off handlers.

---

## 1:40 – 2:30 · Source ingestion and the API boundary

**Show:** `backend/app/routers/sources.py`, `backend/app/services/documents.py`, `backend/app/models.py`.

**Say:**

> "A source is uploaded or pasted, parsed server-side, and stored as a `Source` row with the full text and metadata. The browser never needs to parse a PDF. The PDF path uses `pypdf`; the `.eml` path stores the raw email text and metadata; pasted text is the fallback. The source is linked to the investigation when the record is created; an unlinked source stays available for a retry but is not attached to a record."

**Point at:** the `Source` model and the `Investigation` model in `models.py`.

**Say:**

> “The investigation is a JSON payload plus promoted columns. That is a deliberate trade-off. An RCA is a nested, evolving document — Whys, fishbone, evidence, gaps, CAPA, review — and normalising every one of those into tables would slow the product down for no query benefit at this stage. The columns the dashboard filters on are indexed; the document lives in JSON. In production I would add schema versioning and Alembic migrations before the payload shape became a compatibility problem.”

**Optional:** show `next_code` in `investigations.py`.

**Say:**

> “Codes are assigned server-side from the maximum existing code, not from a client counter, so two investigators cannot receive the same number.”

---

## 2:30 – 4:15 · Intake graph and structured extraction

**Show:** `backend/app/ai/graph.py`, `build_intake_graph`; then `backend/app/ai/schemas.py`; then `backend/app/ai/provider.py`.

**Say:**

> “The intake graph is intentionally small: read, extract, structure. `read` emits two stage events — reading and segmenting — because that is how the work actually feels to a user, even though no model call happens there. `extract` is the only LLM call. `structure` applies provenance and builds the payload, and it is deterministic.”

**Point at:** `provider.json(prompts.intake_prompt(text), IntakeResult)`.

**Say:**

> “Every LLM step is schema-bound. `IntakeResult` is a Pydantic model, not a free-form string. The provider strips code fences, finds the JSON object, validates it, and if validation fails it makes one repair attempt with the validation error. If it still fails, the run fails visibly. I would rather show an honest error than silently persist malformed clinical content.”

**Show:** `schemas.py` — `IntakeField` / `EvidenceItem` / `IntakeGap` (or equivalent names) and `AnalysisResult`.

**Say:**

> “This is the core contract: a value is not just a string, it carries confidence, a source quote and a locator. Evidence carries a relevance level and an identifier. Gaps carry a reason, priority and requester. Those fields are what make the output reviewable instead of plausible-looking text.”

**Show:** `services/shaping.py`, `intake_to_payload` and the provenance assignment.

**Say:**

> “`structuring` converts the model result into the UI payload and builds a provenance map keyed by field. The map is what the UI reads to show the AI badge, confidence and quote. If the human edits the field later, the slice changes the provenance to human. The model’s original suggestion is not silently overwritten in the audit narrative.”

**Optional:** show the demo provider.

**Say:**

> “The demo provider is a deterministic fixture with the same Pydantic contracts. It is not a fake model call hidden behind a spinner; the badge says demo engine, and the API health endpoint reports the provider mode. That was a deliberate product decision: a reviewer should always know whether they are looking at live inference or a reproducible fixture.”

---

## 4:15 – 6:15 · Analysis graph: causal reasoning with a critic

**Show:** `backend/app/ai/graph.py`, `build_analysis_graph`.

**Say:**

> "The analysis graph has seven nodes. `case_file` assembles the compact record. `whys` builds the 5 Whys. `fishbone` does the 6M breadth pass on the fast model. `roots` ranks the candidates and produces the consolidated gaps. `capa` traces actions to causes. `review` is an independent QA critic. `finalise` writes the suggestions and provenance back into the record. The CAPA node also validates every reference against the causes and gaps that actually exist, and repairs an invented ID before the critic sees it. The critic remains advisory, but it no longer reviews a record with a dangling traceability link."

**Point at:** `record_for_analysis(record)` in `run_analysis` and `state.get("original")` in `finalise`.

**Say:**

> “This is a bug I fixed during the build and it is worth calling out. The prompts need a compact record, because sending the full payload wastes context. But finalising must write against the full original payload, otherwise fields that were not in the compact view get dropped. So the graph state carries both `record` for reasoning and `original` for the write-back. The finalise node explicitly uses `original`.”

**Show:** `prompts.py`, `whys_prompt`, `fishbone_prompt`, `root_cause_prompt`, `capa_prompt`, `review_prompt`.

**Say:**

> “The prompts encode the method, not just the persona. The 5 Whys prompt requires each step to name the evidence that supports it and to stop when the causal chain reaches a controllable system condition. The fishbone prompt forces all six Ms, so the model cannot anchor on the first plausible cause. The root-cause prompt requires evidence IDs, assumptions and a falsification test. CAPA must map each action to a cause and define an effectiveness check. The QA critic is asked to find unsupported claims before the human sees the record.”

**Show:** a small slice of `shaping.py`, especially the gap merge/dedupe.

**Say:**

> "The intake pass and the analysis pass both produce gaps, and they overlap. `apply_analysis` merges them semantically and renumbers the result, so the UI shows one consolidated gap list instead of noisy duplicates. The count varies with the source and model; the demo fixture lands at eight, live runs typically land at seven to nine. This is a small piece of product work that matters: duplicate gaps destroy trust faster than a missing gap."

**Show:** `AnalysisState` or the graph edges.

**Say:**

> “The graph is linear in this version, not a branching autonomous agent. For a regulated workflow I want predictable stages, bounded cost and a visible progress model. The value of LangGraph here is explicit state and composable nodes, not letting the model choose its own adventure.”

---

## 6:15 – 7:15 · Persistence, audit and the sign-off gate

**Show:** `backend/app/routers/investigations.py`, `signoff`, `update_investigation`, `_audit`; then `models.py`, `AuditEvent`.

**Say:**

> “The server owns the readiness rules. Sign-off rejects the request unless there is at least one accepted root cause, at least one approved CAPA action, and three attestations. The UI mirrors that logic for a good experience, but the API is the authority. That matters because a UI-only gate is not a control.”

**Point at:** the post-signature branch in `update_investigation`.

**Say:**

> “If a signed record is amended, the server clears the signature, returns the status to in-review, increments the version, and writes `approval.invalidated` to the audit trail. The client refreshes to the new version and shows the signature as invalidated. This is a Part 11-style behaviour, not a claim of Part 11 validation.”

**Point at:** `AuditEvent`.

**Say:**

> “Audit events are append-only by application convention: created, ai.extraction, ai.analysis, root_cause.confirmed, capa.approved, saved, signed, approval.invalidated. The detail is JSON so the event can carry the specific cause IDs, CAPA IDs, signature ID and attestations. In production I would enforce append-only at the database grant level and ship events to immutable storage.”

**Show:** `Workspace.tsx` sign-off handler or `SignoffModal.tsx` briefly.

**Say:**

> “One UX detail: if the user clicks Sign off with unsaved changes, the client saves first, then opens the signature modal. Otherwise the signature would cover a different version of the record than the one on screen. That is the kind of sequencing bug that makes an audit trail lie.”

---

## 7:15 – 8:00 · Verification and what I would harden

**Show:** `scripts/ui-e2e.mjs` and the final test output (or the passing run in the terminal, without secrets).

**Say:**

> “The Playwright flow is the acceptance test: load the sample, extract, analyse, verify high-relevance evidence, confirm a cause, approve CAPA, edit a field and check the provenance marker, save, sign off, verify the audit trail, ask the copilot, draft the evidence email, and return to the dashboard. It adapts its timeouts to the live provider, fails on console errors or failed requests, and creates a signed record that is reset afterwards. I also have a backend smoke test that exercises the API and both graphs, and asserts that every CAPA reference resolves to a real cause or gap.”

**Show:** `README.md`, “Known limitations”.

**Say:**

> “The honest limitations: no OCR for scanned PDFs; a single reviewer identity instead of SSO and server-side RBAC; audit immutability is application-level only; the e-signature is a prototype record, not a validated identity proof; and the MySQL JSON document will need schema versioning as the record evolves. The next production steps are auth and role enforcement, Alembic migrations, object storage for source files, background job retries, and immutable audit storage.”

---

## 8:00 – 8:30 · Close

**Show:** the workspace or the graph diagram.

**Say:**

> “The design principle is simple: the model does the reading, structuring and hypothesis generation; the human does the confirming and signing. The product makes that split visible at every step — provenance, confidence, evidence links, gaps, a QA critique, and a server-enforced signature gate. That is what makes an AI RCA tool usable in a GMP environment rather than just impressive in a demo.”

**Action:** stop recording.

---

## Likely questions and short answers

**Why LangGraph instead of one large prompt?**  
The work has distinct reasoning stages with different schemas and different models. Splitting them makes failures visible, allows a fast model for breadth passes, and gives the UI real progress. It also lets the QA critic challenge the causal chain before finalisation.

**How do you stop hallucinated evidence?**  
Every extracted value and cause carries a source quote or evidence ID. The schemas require them. The QA critic looks for unsupported claims. The reviewer sees the quote next to the value and must confirm causes manually. None of that proves truth, but it makes unsupported claims visible and reviewable.

**Why both 5 Whys and a fishbone?**  
5 Whys is a linear causal path and is easy to review; the fishbone forces breadth across Man, Machine, Material, Method, Measurement and Environment. They cross-check each other: a fishbone factor that never appears in the Whys chain is either irrelevant or a gap in the reasoning.

**What happens if Groq is unavailable?**  
With a key configured, the provider retries malformed responses once and surfaces a clear error if inference still fails. With no key, the app uses the deterministic demo engine and labels it. It does not silently pretend the demo is live.

**Is this Part 11 compliant?**  
No, and the README says so. It implements Part 11-style behaviours — attributable reviewer identity, meaning of signature, attestations, audit events, signature invalidation on amendment — but validation, authentication, immutable storage and a qualified e-signature provider are production work.

**Why store the record as JSON?**  
The RCA is a nested document that evolves with review. JSON keeps the product fast to change; promoted columns keep the dashboard queries indexed. The trade-off is weaker ad-hoc querying and the need for schema versioning later.

**What would you do with two more weeks?**  
Authentication and server-side RBAC, immutable audit storage, OCR, schema migrations, background job durability, and a proper review-assignment workflow with electronic signatures integrated into an identity provider.
