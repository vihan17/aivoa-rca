"""End-to-end smoke test for the RCA API (run against a live server)."""
from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:8000")
ROOT = Path(__file__).resolve().parent.parent


def read_sse(client: httpx.Client, url: str, payload: dict) -> dict:
    stages = []
    result = None
    with client.stream("POST", url, json=payload, timeout=300) as response:
        response.raise_for_status()
        event = None
        for line in response.iter_lines():
            if line.startswith("event:"):
                event = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                data = json.loads(line.split(":", 1)[1].strip())
                if event == "stage":
                    stages.append((data["stage"], data["status"], data.get("detail", "")))
                elif event == "result":
                    result = data
                elif event == "error":
                    raise RuntimeError(data.get("message"))
    print(f"  {len(stages)} stage events, final stages:")
    for stage in stages[-4:]:
        print(f"    {stage[0]:10} {stage[1]:8} {stage[2][:70]}")
    return result or {}


def main() -> None:
    client = httpx.Client(base_url=BASE, timeout=300)
    health = client.get("/api/health").json()
    print("health:", health["status"], health["ai"]["provider"])

    sample = (ROOT / "samples" / "deviation-report.txt").read_text(encoding="utf-8")
    source = client.post("/api/sources/text", json={"text": sample, "label": "Deviation report"}).json()
    print(f"source: {source['id'][:8]} kind={source['kind']} chars={source['meta'].get('chars')}")

    print("extract:")
    intake = read_sse(client, "/api/ai/extract", {"source_id": source["id"]})
    payload = intake["payload"]
    print(
        "  fields:",
        payload.get("batch_number"),
        "|",
        payload.get("product_name"),
        "| evidence:",
        len(payload.get("evidence", [])),
        "| gaps:",
        len(payload.get("gaps", [])),
        "| confidence:",
        intake["provenance"].get("batch_number", {}).get("confidence"),
    )

    print("analyze:")
    analysis = read_sse(client, "/api/ai/analyze", {"payload": payload})
    payload = analysis["payload"]
    print(
        "  whys:",
        len(payload.get("five_whys", [])),
        "| fishbone:",
        len(payload.get("fishbone", [])),
        "| root causes:",
        len(payload.get("root_causes", [])),
        "| capa:",
        len(payload.get("capa", [])),
    )
    for cause in payload.get("root_causes", []):
        print(f"    {cause['id']} {cause['confidence']:.2f} {cause['statement'][:80]}")

    valid_refs = {cause["id"] for cause in payload.get("root_causes", [])}
    valid_refs |= {gap["id"] for gap in payload.get("gaps", [])}
    bad_refs = [
        action["id"]
        for action in payload.get("capa", [])
        if action.get("root_cause_ref") and action["root_cause_ref"] not in valid_refs
    ]
    print("  capa references valid:", not bad_refs)
    if bad_refs:
        raise SystemExit(f"CAPA actions with invalid references: {bad_refs}")

    # accept a cause + a capa, then save
    payload["root_causes"][0]["status"] = "accepted"
    payload["capa"][0]["status"] = "accepted"
    created = client.post(
        "/api/investigations",
        json={"payload": payload, "provenance": analysis["provenance"], "ai_meta": intake["meta"], "source_id": source["id"]},
    ).json()
    print("created:", created["code"], created["id"][:8], "status:", created["status"])

    updated = client.get(f"/api/investigations/{created['id']}").json()
    print("  reloaded evidence:", len(updated["payload"]["evidence"]), "root causes:", len(updated["payload"]["root_causes"]))

    signoff = client.post(
        f"/api/investigations/{created['id']}/signoff",
        json={
            "name": "Dr. Meera Krishnan",
            "role": "QA Head, Unit 2",
            "meaning": "Reviewed and approved the investigation and CAPA",
            "confirmations": ["a", "b", "c"],
        },
    )
    print("signoff:", signoff.status_code, signoff.json().get("status"))

    audit = client.get(f"/api/investigations/{created['id']}/audit").json()["items"]
    print("audit events:", len(audit), [a["action"] for a in audit[:6]])

    chat = client.post(
        "/api/ai/chat",
        json={"question": "What evidence is still missing?", "payload": payload, "history": []},
    ).json()
    print("chat:", chat["answer"][:140].replace("\n", " "))

    email = client.post(
        "/api/ai/evidence-request",
        json={"gaps": payload["gaps"][:3], "context": {"code": created["code"]}},
    ).json()
    print("email draft chars:", len(email["email"]))


if __name__ == "__main__":
    main()
