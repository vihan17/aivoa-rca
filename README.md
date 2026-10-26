# AIVOA RCA — AI-assisted Root Cause Analysis

A working RCA module for an API pharmaceutical manufacturer. A deviation report, email, or pasted incident note is turned into a reviewable investigation: extracted fields and evidence, a 5 Whys chain, a 6M fishbone, ranked root-cause hypotheses, missing-evidence checks, CAPA proposals, an independent QA critique, and an electronic sign-off trail.

Built for the AIVOA.AI AI Product Engineer assignment. Scope is deliberately limited to **Root Cause Analysis** — there are no Customer Complaint, Deviation, or Change Control modules.

---

## What is in the build

| Area | Behaviour |
|---|---|
| Intake | PDF upload, `.eml`/text upload, or paste. PDF text is parsed server-side with `pypdf`; files and extracted text are stored as a `Source`. |
| Extraction | LangGraph intake graph fills **19 fields**, extracts evidence with source quotes, and flags intake gaps. The bundled sample yields 14 evidence items and 4 gaps with the demo engine, or about 15 evidence items and 5 gaps with live Groq. |
| Analysis | LangGraph analysis graph produces a 5 Whys chain, **9–10 fishbone factors**, **4 ranked causes**, **4–8 CAPA actions**, consolidated gaps, and a QA critic pass. Demo-engine counts are fixed; live counts vary by run. |
| Human review | Every AI field has confidence and a source quote. Any edit changes its provenance marker from **AI** to **Edited**. Root causes and CAPA remain suggestions until a reviewer accepts them. |
| Evidence | Evidence cards expose relevance, quote and verification state. `Verify high relevance` checks all high-relevance items in one action. Missing evidence can be drafted into an email request. |
| Sign-off | Requires at least one accepted root cause, at least one approved CAPA action, and three reviewer attestations. Produces a signature ID, signs the record, and appends audit events. |
| Governance | Approved records carry an electronic signature; editing and saving an amendment invalidates it and returns the record to review. Audit trail is append-only in application logic. |
| Copilot | Context-aware Q&A over the current record (demo engine offline, Groq when configured). |
| Dashboard | Open investigations, awaiting review, open gaps (active records only), AI runs, QA queue, and historical records. |
| AI provider | **Live Groq** when `GROQ_API_KEY` is set. Otherwise a deterministic, clearly labelled **Demo engine** keeps the workflow fully testable offline. |

The demo fixture is a realistic OOS investigation: Atorvastatin Calcium API batch **AT-24118**, desfluoro impurity **0.42%** against NMT **0.30%**, vacuum dryer **VD-02**, RTD **TT-207** 24 days past calibration, and a CMMS v6→v8 change control that dropped the calibration schedule.

---

## Stack

- **Frontend:** React 18, TypeScript, Redux Toolkit, React Router, Tailwind CSS, lucide-react, Vite.
- **Backend:** Python 3, FastAPI, SQLAlchemy 2, Pydantic v2.
- **AI:** LangGraph, LangChain, Groq (`openai/gpt-oss-120b` primary, `openai/gpt-oss-20b` for fast passes).
- **Database:** MySQL 8 locally, Render Postgres in production (`JSON` payload + indexed summary columns, plus sources, AI runs and audit events).
- **Streaming:** Server-Sent Events for extraction and analysis progress.

```
React SPA (Redux)
  │  REST + SSE
  ▼
FastAPI routers ──► LangGraph intake graph:  read/segment → extract → structure
  │                LangGraph analysis graph: case file → 5 Whys → fishbone
  │                                           → roots → CAPA → QA review → finalise
  ▼
MySQL: investigations (JSON payload + indexed columns), sources, ai_runs, audit_events
```

The investigation payload is stored as JSON because the RCA is a nested, evolving document. The columns the UI filters on (`code`, `status`, `product_name`, `batch_number`, `classification`, `source_kind`) are promoted to real columns.

---

## Run locally

### Prerequisites

- Python **3.11+**
- Node.js **20+**
- MySQL **8.x** running locally
- Google Chrome only if you want to run the Playwright UI check

### 1. Create the database and user

```sql
CREATE DATABASE aivoa_rca CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'aivoa'@'127.0.0.1' IDENTIFIED BY 'replace-with-your-password';
GRANT ALL PRIVILEGES ON aivoa_rca.* TO 'aivoa'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### 2. Configure the backend

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env` and set `DATABASE_URL`. URL-encode special characters in the password — for example `#` becomes `%23`:

```dotenv
DATABASE_URL=mysql+pymysql://aivoa:replace-with-your-password@127.0.0.1:3306/aivoa_rca?charset=utf8mb4
```

Set `GROQ_API_KEY` to a `gsk_...` key for live inference. Leave it empty to use the offline demo engine. Then install the backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 3. Build the frontend

```powershell
cd frontend
npm install
npm run build
```

### 4. Start the app

From the repository root:

```powershell
.\run.ps1
```

Open **http://127.0.0.1:8000**. FastAPI serves the built SPA, so the demo is one URL with no Vite process. Tables are created automatically and two historical investigations are seeded on first start.

### Frontend development mode

Run the API on port 8000, then:

```powershell
cd frontend
npm run dev
```

Open **http://127.0.0.1:5173**. The default CORS origins already allow this.

### Reset the demo

```powershell
.\reset-demo.ps1
```

This drops and recreates the four application tables, reseeds `RCA-2026-0003` (approved) and `RCA-2026-0004` (in review), and makes the next new record `RCA-2026-0005`. Run it before recording or before a fresh walkthrough.

---

## Deploy on Render

The repo includes a Render Blueprint (`render.yaml`) and a multi-stage `Dockerfile`. The Docker build compiles the React app with Node and serves it from FastAPI, so the whole product runs as one web service.

1. Push this repository to GitHub.
2. In the Render Dashboard choose **New → Blueprint**, connect the repo, and click **Apply**.
3. Render creates the `aivoa-rca` web service and the `aivoa-rca-db` Postgres database, and wires `DATABASE_URL` automatically.
4. Optionally set `GROQ_API_KEY` when prompted. Without it the app runs the demo engine.

Two free-tier limits to know about: the web service spins down after 15 minutes of inactivity (the next request is a cold start), and the free Postgres database expires **30 days** after creation. Upgrade the database before then, or point `DATABASE_URL` at another Postgres instance. The local MySQL workflow above is unchanged.

---

## Configuration

All backend settings live in `backend/.env`.

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy DSN — MySQL locally, `postgres://` on Render | local `aivoa_rca` |
| `GROQ_API_KEY` | Enables live Groq inference when non-empty | empty |
| `GROQ_MODEL` | Primary reasoning model | `openai/gpt-oss-120b` |
| `GROQ_FAST_MODEL` | Fast model for fishbone, CAPA, QA and chat passes | `openai/gpt-oss-20b` |
| `AI_PROVIDER` | `auto`, `groq`, or `mock` | `auto` |
| `CORS_ORIGINS` | Comma-separated dev origins | localhost/127.0.0.1:5173 |

`AI_PROVIDER=auto` selects Groq only when a key is present, otherwise the demo engine. The current provider is always visible in the dashboard AI-engine card and the copilot header.

---

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/sources/upload` | Upload PDF, `.eml`, or `.txt`; parse and store source text |
| `POST` | `/api/sources/text` | Store pasted text or email |
| `GET` | `/api/sources/{id}` | Retrieve a stored source |
| `POST` | `/api/ai/extract` | SSE intake graph: extract fields, evidence, gaps |
| `POST` | `/api/ai/analyze` | SSE analysis graph: 5 Whys, fishbone, causes, CAPA, review |
| `POST` | `/api/ai/chat` | Record-grounded Q&A |
| `POST` | `/api/ai/evidence-request` | Draft an email requesting missing evidence |
| `GET` | `/api/investigations` | List records with dashboard stats |
| `POST` | `/api/investigations` | Create and persist a record (assigns `RCA-YYYY-NNNN`) |
| `GET/PATCH/DELETE` | `/api/investigations/{id}` | Read, save/amend, delete |
| `POST` | `/api/investigations/{id}/signoff` | Validate readiness, e-sign, approve |
| `GET` | `/api/investigations/{id}/audit` | Audit trail |
| `GET` | `/api/meta/options` | Form options and provider status |
| `GET` | `/api/meta/samples` | Bundled sample documents |
| `GET` | `/api/health` | DB and AI provider status |

Interactive API docs: **http://127.0.0.1:8000/docs**.

---

## AI design and review guardrails

1. **Structured output, not prose.** Intake and each analysis step target a Pydantic schema. The provider extracts the JSON object, validates it, and makes one repair attempt if the model returns malformed JSON.
2. **Evidence before conclusion.** Every extracted field carries a confidence value, the source quote, and a locator. Ranked causes carry supporting evidence IDs, assumptions, and a falsification test.
3. **AI is advisory.** AI-generated causes start as `suggested`. Only an explicit reviewer action changes them to `accepted`; CAPA follows the same pattern.
4. **Two-step critique.** The analysis graph runs a fast QA-critic pass after CAPA and stores review issues separately, so the reviewer sees what the model itself flagged as weak.
5. **Traceable CAPA.** Every CAPA action is checked against the root-cause and gap IDs that actually exist. An invented reference is deterministically remapped to the closest valid cause or gap before the critic sees the record, and stale critic objections about repaired IDs or computed due dates are suppressed.
6. **Readiness is enforced server-side.** Sign-off returns `400` unless there is an accepted root cause, an accepted CAPA action, and three attestations. The UI cannot bypass this.
7. **Signature invalidation.** A post-signature edit clears the signature, returns the record to `in_review`, increments the version, and writes `approval.invalidated` to the audit trail.
8. **Transparent fallback.** With no key the UI says **Demo engine · add Groq key**; the demo engine is deterministic and never pretends to be live inference.

This is a product prototype. It is not a validated Part 11/Annex 11 system: authentication, server-side role enforcement, immutable storage/WORM, and a validated e-signature provider are production work, not claims made here.

---

## Verification

Backend smoke test (API + parsing + graphs):

```powershell
backend\.venv\Scripts\python.exe scripts\smoke.py
```

Production UI flow (Chrome + Playwright):

```powershell
$env:BASE_URL = "http://127.0.0.1:8000"
node scripts\ui-e2e.mjs
```

The UI check covers: load sample → extract → analyse → verify high-relevance evidence → confirm a cause → approve CAPA → edit provenance → save → sign off → audit trail → copilot chat → evidence email → dashboard. It works with either provider; with live Groq the analysis wait can be one to two minutes, so the timeouts adapt. It creates and signs a record; run `.\reset-demo.ps1` afterwards.

Type-check and production build:

```powershell
cd frontend
npm run build
```

---

## Repository map

```
backend/app
  main.py                 FastAPI app, health, SPA serving
  config.py               env settings and provider selection
  models.py               Investigation, Source, AiRun, AuditEvent
  seed.py                 two historical investigations
  ai/graph.py             LangGraph intake and analysis workflows
  ai/provider.py          Groq client + deterministic fallback, JSON repair
  ai/prompts.py           role, intake, 5 Whys, fishbone, cause, CAPA, QA, chat
  ai/schemas.py           structured output contracts
  services/shaping.py     provenance, gap merge/dedupe, payload shaping
  routers/                sources, AI streaming, investigations, meta
frontend/src
  pages/Workspace.tsx     three-column review workspace
  pages/Dashboard.tsx     investigation list, stats, QA queue
  components/workspace/   incident, product, evidence, RCA, CAPA, sign-off, audit
  components/copilot/     source intake, SSE stages, chat, evidence email
  store/                  Redux slices, thunks, typed hooks
scripts
  smoke.py                API/integration checks
  ui-e2e.mjs              full Playwright user journey
  reset_demo.py           database reset and reseed
samples                   synthetic deviation PDF, email and shift note
docs                      demo and code-walkthrough scripts
```

---

## Known limitations / next steps

- No OCR for scanned PDFs; text-based PDFs only.
- Single configured reviewer identity; no SSO or server-side role model.
- Audit events are append-only by application convention, not enforced by database grants.
- Sign-off is a prototype e-signature record, not a validated identity proof.
- Groq output is schema-validated but not clinically/pharmaceutically validated; every conclusion requires a qualified reviewer.
- Production hardening would add Alembic migrations, object storage for source files, background job retries, rate limits, and immutable audit storage.

---

## Assignment deliverables

- Product demo: `docs/DEMO_SCRIPT.md`
- Code walkthrough: `docs/CODE_WALKTHROUGH.md`
- Submission checklist: `docs/SUBMISSION_CHECKLIST.md`

No secrets, recordings, or assignment materials are committed to a public repository.
