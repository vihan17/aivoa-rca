import { useState } from "react";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  Boxes,
  Check,
  ClipboardList,
  Gauge,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Stethoscope,
  Thermometer,
  UserRound,
  X,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { investigationActions } from "../../store/investigationSlice";
import { cn, confidenceTone, pct, pluralize } from "../../lib/format";
import type { FishboneCategory, RootCause } from "../../lib/types";
import { ConfidenceBar } from "../ui";
import { Section } from "./Section";

const CATEGORY_ICON: Record<string, ReactNode> = {
  Man: <UserRound className="h-3.5 w-3.5" />,
  Machine: <Gauge className="h-3.5 w-3.5" />,
  Material: <Boxes className="h-3.5 w-3.5" />,
  Method: <ClipboardList className="h-3.5 w-3.5" />,
  Measurement: <Thermometer className="h-3.5 w-3.5" />,
  Environment: <Stethoscope className="h-3.5 w-3.5" />,
};

const CATEGORY_TONE: Record<string, string> = {
  Man: "border-sky-200 bg-sky-50 text-sky-700",
  Machine: "border-violet-200 bg-violet-50 text-violet-700",
  Material: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Method: "border-amber-200 bg-amber-50 text-amber-700",
  Measurement: "border-rose-200 bg-rose-50 text-rose-700",
  Environment: "border-teal-200 bg-teal-50 text-teal-700",
};

function EvidenceChips({ ids }: { ids: string[] }) {
  const evidence = useAppSelector((state) => state.investigation.payload.evidence);
  const items = ids
    .map((id) => evidence.find((ev) => ev.id === id))
    .filter((ev): ev is NonNullable<typeof ev> => Boolean(ev));
  if (!items.length) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9.5px] font-medium text-rose-600">
        no evidence linked
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.slice(0, 4).map((item) => (
        <button
          key={item.id}
          className="chip transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700"
          title={item.quote || item.label}
          onClick={() => document.getElementById("section-evidence")?.scrollIntoView({ behavior: "smooth" })}
        >
          {item.id}
        </button>
      ))}
      {items.length > 4 && <span className="text-[10px] text-ink-400">+{items.length - 4}</span>}
    </div>
  );
}

function WhyCard({ index }: { index: number }) {
  const dispatch = useAppDispatch();
  const why = useAppSelector((state) => state.investigation.payload.five_whys[index]);
  if (!why) return null;
  const tone = confidenceTone(why.confidence);
  return (
    <div className="relative pl-9">
      <div
        className={cn(
          "absolute left-0 top-1 grid h-6 w-6 place-items-center rounded-full border text-[10px] font-semibold",
          why.verified
            ? "border-accent-300 bg-accent-600 text-white"
            : "border-ink-200 bg-white text-ink-600",
        )}
      >
        {why.verified ? <Check className="h-3 w-3" /> : why.level}
      </div>
      <div
        className={cn(
          "rounded-lg border bg-white p-3 transition-colors",
          why.verified ? "border-accent-200" : "border-ink-200",
        )}
      >
        <div className="flex items-start gap-2">
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] font-semibold text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-0"
            value={why.question}
            onChange={(event) =>
              dispatch(investigationActions.setWhy({ index, patch: { question: event.target.value } }))
            }
            aria-label={`Why ${why.level} question`}
          />
          <span className={cn("shrink-0 text-[10px] font-semibold tabular-nums", tone.text)}>
            {pct(why.confidence)}
          </span>
        </div>
        <textarea
          spellCheck={false}
          className="mt-1.5 w-full resize-none rounded-md border border-transparent bg-transparent px-0 py-1 text-[12px] leading-relaxed text-ink-600 placeholder:text-ink-400 hover:border-ink-100 hover:bg-ink-50/40 focus:border-ink-200 focus:bg-white focus:outline-none focus:ring-0"
          rows={Math.max(2, Math.ceil(why.answer.length / 92))}
          value={why.answer}
          placeholder="Answer with the next causal step…"
          onChange={(event) =>
            dispatch(investigationActions.setWhy({ index, patch: { answer: event.target.value } }))
          }
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <ConfidenceBar value={why.confidence} showLabel={false} />
            <EvidenceChips ids={why.evidence} />
          </div>
          <div className="flex items-center gap-1">
            <button
              className={cn(
                "btn btn-sm px-1.5",
                why.verified
                  ? "border-accent-200 bg-accent-50 text-accent-700"
                  : "border-transparent text-ink-400 hover:bg-ink-100 hover:text-ink-700",
              )}
              onClick={() => dispatch(investigationActions.toggleWhyVerified(index))}
              title="Mark this causal step as verified by the reviewer"
            >
              <BadgeCheck className="h-3 w-3" />
              {why.verified ? "Verified" : "Verify"}
            </button>
            <button
              className="btn btn-ghost btn-sm px-1.5 text-ink-400 hover:text-rose-600"
              onClick={() => dispatch(investigationActions.removeWhy(index))}
              aria-label="Remove why"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RootCauseCard({ cause, emphasis }: { cause: RootCause; emphasis?: boolean }) {
  const dispatch = useAppDispatch();
  const evidence = useAppSelector((state) => state.investigation.payload.evidence);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ statement: cause.statement, rationale: cause.rationale });

  const evidenceCount = cause.evidence.filter((id) => evidence.some((ev) => ev.id === id)).length;
  const accepted = cause.status === "accepted";
  const rejected = cause.status === "rejected";
  const tone = confidenceTone(cause.confidence);

  return (
    <div
      className={cn(
        "rounded-lg border p-3.5 transition-colors",
        accepted
          ? "border-accent-300 bg-accent-50/40 shadow-sm"
          : rejected || cause.ruled_out
            ? "border-ink-200 bg-ink-50/60 opacity-75"
            : emphasis
              ? "border-ai-200 bg-white"
              : "border-ink-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[10px] font-semibold text-ink-400">{cause.id}</span>
          <span className="badge border-ink-200 bg-ink-50 text-ink-600">{cause.category}</span>
          {cause.ruled_out && (
            <span className="badge border-ink-200 bg-ink-100 text-ink-500">Ruled out</span>
          )}
          {accepted && (
            <span className="badge border-accent-200 bg-accent-100 text-accent-800">
              <BadgeCheck className="h-2.5 w-2.5" /> Confirmed
            </span>
          )}
          {rejected && !cause.ruled_out && (
            <span className="badge border-rose-200 bg-rose-50 text-rose-600">Rejected</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ConfidenceBar value={cause.confidence} />
          {!accepted && (
            <button
              className="btn btn-ghost btn-sm px-1.5"
              onClick={() => {
                setDraft({ statement: cause.statement, rationale: cause.rationale });
                setEditing((value) => !value);
              }}
              aria-label="Edit root cause"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            className="textarea min-h-[64px] text-[12px]"
            value={draft.statement}
            onChange={(event) => setDraft({ ...draft, statement: event.target.value })}
            aria-label="Root cause statement"
          />
          <textarea
            className="textarea min-h-[52px] text-[11.5px]"
            value={draft.rationale}
            onChange={(event) => setDraft({ ...draft, rationale: event.target.value })}
            aria-label="Root cause rationale"
          />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                dispatch(
                  investigationActions.updateRootCause({
                    id: cause.id,
                    patch: { statement: draft.statement, rationale: draft.rationale },
                  }),
                );
                setEditing(false);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-ink-900">{cause.statement}</p>
      )}

      {!editing && cause.rationale && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">{cause.rationale}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <EvidenceChips ids={cause.evidence} />
        <span className={cn("text-[10px]", tone.text)}>{evidenceCount} linked records</span>
      </div>

      {cause.falsification && !cause.ruled_out && (
        <p className="mt-2 rounded-md bg-ink-50 px-2 py-1.5 text-[10.5px] leading-snug text-ink-500">
          <span className="font-semibold text-ink-600">Would be disproved by:</span> {cause.falsification}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-2.5">
        <div className="text-[10.5px] text-ink-400">
          {accepted ? (
            <span className="inline-flex items-center gap-1 text-accent-700">
              <BadgeCheck className="h-3 w-3" />
              Confirmed by {cause.confirmed_by || "reviewer"}
              {cause.confirmed_at ? ` · ${cause.confirmed_at}` : ""}
            </span>
          ) : (
            <span>AI hypothesis · reviewer confirmation required</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {accepted ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => dispatch(investigationActions.resetRootCause(cause.id))}
            >
              Reopen
            </button>
          ) : (
            <>
              <button
                className="btn btn-primary btn-sm"
                disabled={cause.ruled_out || evidenceCount === 0}
                title={
                  cause.ruled_out
                    ? "Ruled-out hypotheses cannot be confirmed"
                    : evidenceCount === 0
                      ? "Link evidence before confirming a cause"
                      : "Confirm this root cause"
                }
                onClick={() => dispatch(investigationActions.acceptRootCause({ id: cause.id }))}
              >
                <Check className="h-3 w-3" />
                Confirm as root cause
              </button>
              <button
                className="btn btn-ghost btn-sm text-ink-500 hover:text-rose-600"
                onClick={() => dispatch(investigationActions.rejectRootCause(cause.id))}
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RcaSection({
  onRunAnalysis,
  running,
}: {
  onRunAnalysis: () => void;
  running: boolean;
}) {
  const dispatch = useAppDispatch();
  const payload = useAppSelector((state) => state.investigation.payload);
  const analysisStale = useAppSelector((state) => state.investigation.analysisStale);
  const hasAnalysis = payload.five_whys.length > 0 || payload.root_causes.length > 0;
  const categories: FishboneCategory[] = ["Man", "Machine", "Material", "Method", "Measurement", "Environment"];
  const accepted = payload.root_causes.filter((cause) => cause.status === "accepted").length;
  const reviewIssues = payload.review?.issues ?? [];

  return (
    <Section
      id="rca"
      index="4"
      title="Root cause analysis"
      description="5 Whys and a 6M fishbone, with ranked hypotheses. Nothing is a root cause until a qualified reviewer confirms it."
      tone="ai"
      actions={
        <div className="flex items-center gap-2">
          {hasAnalysis && (
            <button className="btn btn-secondary btn-sm" onClick={onRunAnalysis} disabled={running}>
              <RefreshCw className={cn("h-3 w-3", running && "animate-spin")} />
              Re-run
            </button>
          )}
          {!hasAnalysis && (
            <button className="btn btn-ai btn-sm" onClick={onRunAnalysis} disabled={running}>
              <Sparkles className="h-3 w-3" />
              Run RCA analysis
            </button>
          )}
        </div>
      }
    >
      {analysisStale && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11.5px] text-amber-800">
          <span>The source was refreshed after this analysis. Re-run to keep the causal chain aligned.</span>
          <button className="btn btn-secondary btn-sm border-amber-200 bg-white text-amber-800" onClick={onRunAnalysis}>
            Re-run
          </button>
        </div>
      )}

      {running && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-ai-200 bg-ai-50/60 px-3 py-2.5 text-[11.5px] text-ai-800">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          Copilot is building the causal chain. Progress is shown in the panel on the right.
        </div>
      )}

      {!hasAnalysis ? (
        <div className="rounded-xl border border-dashed border-ai-200 bg-gradient-to-br from-ai-50/70 to-white px-5 py-8 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-ai-100">
            <Sparkles className="h-4 w-4 text-ai-700" />
          </div>
          <h3 className="mt-3 text-[13px] font-semibold text-ink-900">No analysis yet</h3>
          <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-ink-500">
            The copilot will test the evidence using 5 Whys and a 6M fishbone, rank root-cause hypotheses
            with citations, list missing evidence, and draft CAPA for review.
          </p>
          <button className="btn btn-ai mt-4" onClick={onRunAnalysis} disabled={running}>
            <Sparkles className="h-3.5 w-3.5" />
            Run RCA analysis
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [payload.five_whys.length, "5 Whys levels"],
              [payload.fishbone.length, "fishbone factors"],
              [payload.root_causes.length, "ranked causes"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-lg border border-ink-200 bg-white px-3 py-2">
                <div className="text-[17px] font-semibold leading-none text-ink-900">{value}</div>
                <div className="mt-1 text-[10.5px] uppercase tracking-wide text-ink-400">{label}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[12.5px] font-semibold text-ink-900">5 Whys causal chain</h3>
              <span className="text-[10.5px] text-ink-400">
                {accepted > 0 ? `${accepted} cause confirmed` : "Edit any step; verify what the evidence supports"}
              </span>
            </div>
            <div className="relative space-y-2">
              {payload.five_whys.map((why, index) => (
                <WhyCard key={`${why.level}-${index}`} index={index} />
              ))}
            </div>
            <button
              className="btn btn-secondary btn-sm ml-9 mt-2"
              onClick={() => dispatch(investigationActions.addWhy())}
            >
              <Plus className="h-3 w-3" />
              Add why
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[12.5px] font-semibold text-ink-900">Fishbone · 6M</h3>
              <span className="text-[10.5px] text-ink-400">Confirm or dismiss each contributing factor</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map((category) => {
                const factors = payload.fishbone.filter((factor) => factor.category === category);
                return (
                  <div key={category} className="rounded-lg border border-ink-200 bg-white p-2.5">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                          CATEGORY_TONE[category],
                        )}
                      >
                        {CATEGORY_ICON[category]}
                        {category}
                      </span>
                      <span className="text-[9.5px] text-ink-400">{factors.length}</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {factors.length === 0 && (
                        <p className="rounded border border-dashed border-ink-200 px-2 py-3 text-center text-[10.5px] text-ink-400">
                          No factors identified
                        </p>
                      )}
                      {factors.map((factor) => (
                        <div
                          key={factor.id}
                          className={cn(
                            "rounded-md border px-2 py-1.5 transition-colors",
                            factor.status === "confirmed"
                              ? "border-accent-200 bg-accent-50/50"
                              : factor.status === "dismissed"
                                ? "border-ink-200 bg-ink-50 opacity-55"
                                : "border-ink-200 bg-ink-50/30",
                          )}
                        >
                          <div
                            className={cn(
                              "text-[11px] font-medium leading-snug text-ink-800",
                              factor.status === "dismissed" && "line-through",
                            )}
                          >
                            {factor.factor}
                          </div>
                          {factor.rationale && (
                            <div className="mt-0.5 text-[10px] leading-snug text-ink-500">{factor.rationale}</div>
                          )}
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <EvidenceChips ids={factor.evidence} />
                            <div className="flex items-center gap-0.5">
                              <button
                                className={cn(
                                  "rounded p-1 transition",
                                  factor.status === "confirmed"
                                    ? "bg-accent-600 text-white"
                                    : "text-ink-400 hover:bg-accent-50 hover:text-accent-700",
                                )}
                                title="Confirm contributing factor"
                                onClick={() =>
                                  dispatch(
                                    investigationActions.setFishboneStatus({
                                      id: factor.id,
                                      status: factor.status === "confirmed" ? "suggested" : "confirmed",
                                    }),
                                  )
                                }
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <button
                                className={cn(
                                  "rounded p-1 transition",
                                  factor.status === "dismissed"
                                    ? "bg-ink-700 text-white"
                                    : "text-ink-400 hover:bg-rose-50 hover:text-rose-600",
                                )}
                                title="Dismiss contributing factor"
                                onClick={() =>
                                  dispatch(
                                    investigationActions.setFishboneStatus({
                                      id: factor.id,
                                      status: factor.status === "dismissed" ? "suggested" : "dismissed",
                                    }),
                                  )
                                }
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[12.5px] font-semibold text-ink-900">Root cause candidates</h3>
              <span className="text-[10.5px] text-ink-400">Ranked by evidence strength</span>
            </div>
            <div className="space-y-2">
              {payload.root_causes.map((cause, index) => (
                <RootCauseCard key={cause.id} cause={cause} emphasis={index === 0} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-ink-200 bg-white p-3">
            <h3 className="text-[12px] font-semibold text-ink-900">Causal summary for the record</h3>
            <textarea
              className="textarea mt-2 min-h-[86px] text-[12px]"
              value={payload.summary ?? ""}
              onChange={(event) =>
                dispatch(investigationActions.setField({ field: "summary", value: event.target.value }))
              }
            />
          </div>

          {(payload.review?.issues?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-ai-600" />
                  <h3 className="text-[12px] font-semibold text-ink-900">Independent QA critique</h3>
                </div>
                <span
                  className={cn(
                    "badge",
                    payload.review?.verdict === "pass"
                      ? "border-accent-200 bg-accent-50 text-accent-700"
                      : "border-amber-200 bg-amber-50 text-amber-700",
                  )}
                >
                  {payload.review?.verdict === "pass" ? "Pass" : "Needs review"}
                </span>
              </div>
              <div className="mt-2 space-y-2">
                {reviewIssues.map((issue, index) => (
                  <div key={index} className="rounded-md border border-ink-200 bg-white p-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "badge",
                          issue.severity === "High"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : issue.severity === "Medium"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-ink-200 bg-ink-50 text-ink-600",
                        )}
                      >
                        {issue.severity}
                      </span>
                      <span className="text-[11.5px] font-medium text-ink-800">{issue.issue}</span>
                    </div>
                    <p className="mt-1 text-[10.5px] leading-snug text-ink-500">{issue.recommendation}</p>
                  </div>
                ))}
              </div>
              {payload.review?.notes && (
                <p className="mt-2 text-[10.5px] italic leading-snug text-ink-500">{payload.review.notes}</p>
              )}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
