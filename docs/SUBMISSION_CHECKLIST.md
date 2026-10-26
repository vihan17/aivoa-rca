# Submission checklist

Deadline: **25 October 2026**. Submit through **https://forms.gle/5rLhrBMGeprAqJiB9**.

---

## 1. Final technical check

- [ ] `cd frontend; npm run build` passes with no TypeScript errors.
- [ ] Backend is running at **http://127.0.0.1:8000** and the dashboard loads.
- [ ] Provider badge is correct: **Demo engine · add Groq key**, or **Groq live** if a key was added.
- [ ] `.\reset-demo.ps1` restores exactly two records: `RCA-2026-0003` approved and `RCA-2026-0004` in review.
- [ ] The next new record is `RCA-2026-0005`.
- [ ] Full UI flow has been run at least once since the last code change: extract → analyse → confirm cause → approve CAPA → save → sign off → audit.
- [ ] No console errors or failed API requests during the final run.
- [ ] Live Groq was verified end-to-end: the sample extracts (typically ~19 fields, ~15 evidence, ~5 intake gaps) and analysis returns a signable record; exact counts may vary.
- [ ] If a Groq key was added, the key is only in `backend\.env`, which is excluded from the archive and videos.
- [ ] No `.env`, API key, screenshot, recording, or assignment PDF is inside the code archive.

## 2. Record the two videos

- [ ] Product demo, **5–8 minutes**, using `docs/DEMO_SCRIPT.md`.
- [ ] Code walkthrough, **5–10 minutes**, using `docs/CODE_WALKTHROUGH.md`.
- [ ] Both videos have clear audio, 1080p or better, and no notifications or personal files on screen.
- [ ] The demo clearly states that the AI output is advisory and the reviewer is accountable.
- [ ] The demo shows the human confirmation step, the sign-off gate, and the audit trail.
- [ ] The walkthrough shows the LangGraph stages, the schema contracts, provenance, and the sign-off enforcement.
- [ ] Videos are uploaded to YouTube (unlisted) or Google Drive with link sharing enabled.
- [ ] Links play in an incognito window.
- [ ] Run `.\reset-demo.ps1` after recording so the repository is in the clean starting state.

## 3. Package the code

```powershell
.\package-submission.ps1
```

This writes `release\aivoa-rca-submission.zip` and excludes `.env`, `.venv`, `node_modules`, `__pycache__`, and `artifacts`.

- [ ] Archive exists and is a reasonable size (a few MB, not hundreds).
- [ ] Inspect the archive: it contains `README.md`, `backend`, `frontend` (including `dist`), `samples`, `scripts`, and `docs`.
- [ ] It does **not** contain `backend\.env`, `node_modules`, `.venv`, screenshots, or videos.
- [ ] Upload the archive to Google Drive or Dropbox with link sharing enabled.
- [ ] Do not upload the project, source, videos, assignment files, screenshots, samples, or materials to GitHub or any public repository.

## 4. Submit the form

Have ready:

- [ ] Product demo video link.
- [ ] Code walkthrough video link.
- [ ] Code archive link (or upload, if the form supports it).
- [ ] A short note that the app runs with either the deterministic demo engine or a Groq key, and that the README contains the setup steps.

Suggested short description:

> AI-assisted RCA module for an API manufacturer: PDF/email/text intake, LangGraph extraction of fields and evidence, 5 Whys + 6M fishbone, ranked causes with evidence and falsification tests, missing-evidence gaps, CAPA with effectiveness checks, reviewer confirmation, Part 11-style e-signature and audit trail. React + Redux frontend, FastAPI backend, MySQL, LangGraph + Groq. A deterministic demo engine keeps the full workflow testable without a key and is labelled in the UI.

- [ ] Form submitted before the deadline.
- [ ] Confirmation screenshot or email saved.

---

## If something breaks during recording

1. Stop the recording.
2. Check the backend terminal for the traceback; do not show the terminal on camera.
3. If the database is in a bad state, run `.\reset-demo.ps1` and start over.
4. If the port is occupied, close the old process or restart the machine; `.\run.ps1` refuses to start on a busy port rather than silently serving the wrong app.
5. If Groq inference fails, switch to the demo engine by clearing `GROQ_API_KEY` and restarting the API. Say on camera that the demo engine is being used.
