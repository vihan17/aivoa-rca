import { useState } from "react";
import {
  CheckCheck,
  CheckCircle2,
  Circle,
  FileText,
  Mail,
  Pencil,
  Plus,
  Quote,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { investigationActions } from "../../store/investigationSlice";
import { requestEvidenceEmail } from "../../store/thunks";
import { cn, pluralize } from "../../lib/format";
import type { EvidenceItem } from "../../lib/types";
import { PriorityBadge } from "../ui";
import { Section } from "./Section";

const KIND_TONE: Record<string, string> = {
  "Batch record": "border-sky-200 bg-sky-50 text-sky-700",
  "Lab result": "border-violet-200 bg-violet-50 text-violet-700",
  "Calibration record": "border-rose-200 bg-rose-50 text-rose-700",
  "Equipment log": "border-amber-200 bg-amber-50 text-amber-700",
  SOP: "border-ink-200 bg-ink-50 text-ink-600",
  "Change control": "border-accent-200 bg-accent-50 text-accent-700",
  "Training record": "border-indigo-200 bg-indigo-50 text-indigo-700",
};

function EvidenceRow({ item }: { item: EvidenceItem }) {
  const dispatch = useAppDispatch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);

  const update = (patch: Partial<EvidenceItem>) => {
    dispatch(investigationActions.updateEvidence({ id: item.id, patch }));
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-3 transition-colors",
        item.verified ? "border-accent-200/80" : "border-ink-200",
      )}
    >
      {editing ? (
        <div className="space-y-2">
          <input
            className="input h-8 text-[12px]"
            value={draft.label}
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
            aria-label="Evidence label"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              className="input h-8 text-[11.5px]"
              value={draft.kind}
              onChange={(event) => setDraft({ ...draft, kind: event.target.value })}
              aria-label="Evidence type"
            />
            <input
              className="input h-8 text-[11.5px]"
              value={draft.source_ref}
              onChange={(event) => setDraft({ ...draft, source_ref: event.target.value })}
              aria-label="Source reference"
            />
            <select
              className="select h-8 text-[11.5px]"
              value={draft.relevance}
              onChange={(event) => setDraft({ ...draft, relevance: event.target.value as EvidenceItem["relevance"] })}
              aria-label="Relevance"
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
          <textarea
            className="textarea min-h-[60px] text-[11.5px]"
            value={draft.quote}
            onChange={(event) => setDraft({ ...draft, quote: event.target.value })}
            aria-label="Evidence quote"
          />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                update(draft);
                setEditing(false);
              }}
            >
              Apply changes
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <span className="mt-0.5 font-mono text-[10px] font-semibold text-ink-400">{item.id}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-medium text-ink-900">{item.label || "Untitled evidence"}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "badge",
                      KIND_TONE[item.kind] ?? "border-ink-200 bg-ink-50 text-ink-600",
                    )}
                  >
                    {item.kind || "Document"}
                  </span>
                  {item.source_ref && <span className="chip">{item.source_ref}</span>}
                  <span
                    className={cn(
                      "text-[10px] font-medium uppercase tracking-wide",
                      item.relevance === "High"
                        ? "text-rose-600"
                        : item.relevance === "Medium"
                          ? "text-amber-600"
                          : "text-ink-400",
                    )}
                  >
                    {item.relevance}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() =>
                    dispatch(investigationActions.toggleEvidenceVerified({ id: item.id, value: !item.verified }))
                  }
                  className={cn(
                    "btn btn-sm gap-1",
                    item.verified
                      ? "border-accent-200 bg-accent-50 text-accent-700"
                      : "border-ink-200 bg-white text-ink-500 hover:bg-ink-50",
                  )}
                  title={item.verified ? "Verified against the source" : "Mark as verified against the source"}
                >
                  {item.verified ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                  {item.verified ? "Verified" : "Verify"}
                </button>
                <button
                  className="btn btn-ghost btn-sm px-1.5"
                  onClick={() => {
                    setDraft(item);
                    setEditing(true);
                  }}
                  aria-label="Edit evidence"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            </div>
            {item.quote && (
              <blockquote className="mt-2 flex gap-1.5 border-l-2 border-ink-200 pl-2.5 text-[11.5px] leading-relaxed text-ink-600">
                <Quote className="mt-0.5 h-3 w-3 shrink-0 text-ink-300" />
                <span className="italic">{item.quote}</span>
              </blockquote>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EvidenceSection() {
  const dispatch = useAppDispatch();
  const payload = useAppSelector((state) => state.investigation.payload);
  const total = payload.evidence.length;
  const verified = payload.evidence.filter((ev) => ev.verified).length;
  const openGaps = payload.gaps.filter((gap) => gap.status === "open");
  const highRelevance = payload.evidence.filter((ev) => ev.relevance === "High").length;

  return (
    <Section
      id="evidence"
      index="3"
      title="Evidence & missing information"
      description="Every fact the copilot used, with its source. Flag what is still missing before a cause is confirmed."
      actions={
        <div className="flex items-center gap-2">
          <span className="hidden text-[10.5px] text-ink-400 sm:inline">
            {verified}/{total} verified
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => dispatch(investigationActions.addEvidence())}>
            <Plus className="h-3 w-3" />
            Add evidence
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
          <span className="inline-flex items-center gap-1 rounded-md bg-ink-50 px-2 py-1">
            <FileText className="h-3 w-3 text-ink-400" />
            {pluralize(total, "record")} reviewed
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-rose-700">
            {highRelevance} high relevance
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-amber-700">
            <TriangleAlert className="h-3 w-3" />
            {openGaps.length} open {openGaps.length === 1 ? "gap" : "gaps"}
          </span>
          {highRelevance > 0 && (
            <button
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-[10px] font-medium text-ink-600 transition hover:border-accent-300 hover:text-accent-700"
              onClick={() => dispatch(investigationActions.verifyHighRelevance())}
              title="Mark every high-relevance record as checked against its source"
            >
              <CheckCheck className="h-3 w-3" />
              Verify high relevance
            </button>
          )}
        </div>

        {total === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50/40 px-4 py-8 text-center">
            <FileText className="mx-auto h-5 w-5 text-ink-300" />
            <p className="mt-2 text-[12.5px] font-medium text-ink-700">No evidence yet</p>
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              Use the copilot to extract records from the source document.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {payload.evidence.map((item) => (
              <EvidenceRow key={item.id} item={item} />
            ))}
          </div>
        )}

        <div className="!mt-5 rounded-lg border border-amber-200/70 bg-amber-50/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-900">
                <TriangleAlert className="h-3.5 w-3.5" />
                Missing evidence & information
              </div>
              <p className="mt-0.5 text-[11px] text-amber-800/80">
                The copilot flags what a GMP investigator would request before sign-off.
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
              onClick={() => dispatch(requestEvidenceEmail())}
              disabled={openGaps.length === 0}
            >
              <Mail className="h-3 w-3" />
              Draft evidence request
            </button>
          </div>

          {payload.gaps.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-amber-200 bg-white/60 px-3 py-4 text-center text-[11.5px] text-ink-500">
              No gaps flagged yet. Run the RCA analysis to test the evidence set.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {payload.gaps.map((gap) => (
                <div
                  key={gap.id}
                  className={cn(
                    "rounded-lg border bg-white p-3",
                    gap.status === "open" ? "border-amber-200/80" : "border-ink-200 opacity-80",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 font-mono text-[9.5px] text-ink-400">{gap.id}</span>
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium leading-snug text-ink-800">
                          {gap.item || "New evidence request"}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-snug text-ink-500">{gap.why_needed}</div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-400">
                          <PriorityBadge priority={gap.priority} />
                          {gap.request_from && <span>Request from {gap.request_from}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <select
                        className={cn(
                          "select h-7 w-[100px] text-[10.5px]",
                          gap.status === "open" && "border-amber-200 bg-amber-50/50",
                        )}
                        value={gap.status}
                        onChange={(event) =>
                          dispatch(
                            investigationActions.setGapStatus({
                              id: gap.id,
                              status: event.target.value as typeof gap.status,
                            }),
                          )
                        }
                        aria-label="Gap status"
                      >
                        <option value="open">Open</option>
                        <option value="requested">Requested</option>
                        <option value="resolved">Resolved</option>
                      </select>
                      <button
                        className="btn btn-ghost btn-sm px-1.5"
                        title="Draft an email for this gap"
                        onClick={() => dispatch(requestEvidenceEmail())}
                      >
                        <Send className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
