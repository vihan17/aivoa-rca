"""Reset the demo database to the two seeded historical investigations.

Deletes all runtime records and re-runs the seed. Safe to use while the API is
running; the next investigation will be numbered RCA-2026-0005.

Usage (from the repository root):
    backend\\.venv\\Scripts\\python.exe scripts\\reset_demo.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import delete, func, select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models import AiRun, AuditEvent, Investigation, Source, User  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        # Child rows first. Audit events also cascade from investigations, but
        # deleting explicitly keeps the reset deterministic.
        db.execute(delete(AuditEvent))
        db.execute(delete(Source))
        db.execute(delete(AiRun))
        db.execute(delete(Investigation))
        db.execute(delete(User))
        db.commit()
    finally:
        db.close()

    seed_if_empty()

    db = SessionLocal()
    try:
        records = db.scalars(select(Investigation).order_by(Investigation.code)).all()
        audits = db.scalar(select(func.count()).select_from(AuditEvent)) or 0
        runs = db.scalar(select(func.count()).select_from(AiRun)) or 0
        sources = db.scalar(select(func.count()).select_from(Source)) or 0

        latest = db.scalar(select(func.max(Investigation.code)))
        next_code = "RCA-2026-0001"
        if latest:
            prefix, _, sequence = latest.rpartition("-")
            try:
                next_code = f"{prefix}-{int(sequence) + 1:04d}"
            except ValueError:
                pass

        print("Demo reset complete.")
        for record in records:
            print(f"  {record.code}  {record.status:10}  {record.title[:64]}")
        print(f"  ai_runs={runs}  audit_events={audits}  sources={sources}")
        print(f"  next new record: {next_code}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
