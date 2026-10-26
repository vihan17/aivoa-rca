import { useState } from "react";
import {
  CalendarDays,
  Check,
  CircleSlash,
  Pencil,
  Plus,
  Sparkles,
  Target,
  UserRound,
  X,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { investigationActions } from "../../store/investigationSlice";
import { cn, formatDate, pluralize } from "../../lib/format";
import type { CapaAction } from "../../lib/types";
import { Field, PriorityBadge, TypeBadge } from "../ui";
import { Section } from "./Section";

function CapaCard({ item }: { item: CapaAction }) {
  const dispatch = useAppDispatch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);
  const accepted = item.status === "accepted";
  const rejected = item.status === "rejected";

  const apply = () => {
    dispatch(
      investigationActions.updateCapa({
        id: item.id,
        patch: {
          action: draft.action,
          explanation: draft.explanation,
          owner: draft.owner,
          due_date: draft.due_date,
          priority: draft.priority,
          effectiveness_check: draft.effectiveness_check,
          type: draft.type,
          root_cause_ref: draft.root_cause_ref,
        },
      }),
    );
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-3.5 transition-colors",
        accepted
          ? "border-accent-300 bg-accent-50/30"
          : rejected
            ? "border-ink-200 bg-ink-50/60 opacity-70"
            : "border-ink-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] font-semibold text-ink-400">{item.id}</span>
          <TypeBadge type={item.type} />
          <PriorityBadge priority={item.priority} />
          {item.root_cause_ref && <span className="chip">{item.root_cause_ref}</span>}
          {accepted && (
            <span className="badge border-accent-200 bg-accent-100 text-accent-800">
              <Check className="h-2.5 w-2.5" /> Approved
            </span>
          )}
        </div>
        {!accepted && (
          <button
            className="btn btn-ghost btn-sm px-1.5"
            onClick={() => {
              setDraft(item);
              setEditing((value) => !value);
            }}
            aria-label="Edit CAPA action"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            className="textarea min-h-[56px] text-[12px]"
            value={draft.action}
            onChange={(event) => setDraft({ ...draft, action: event.target.value })}
            aria-label="CAPA action"
          />
          <textarea
            className="textarea min-h-[44px] text-[11.5px]"
            value={draft.explanation}
            onChange={(event) => setDraft({ ...draft, explanation: event.target.value })}
            aria-label="CAPA explanation"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              className="input h-8 text-[11.5px]"
              value={draft.owner}
              onChange={(event) => setDraft({ ...draft, owner: event.target.value })}
              placeholder="Owner role"
              aria-label="CAPA owner"
            />
            <input
              type="date"
              className="input h-8 text-[11.5px]"
              value={draft.due_date}
              onChange={(event) => setDraft({ ...draft, due_date: event.target.value })}
              aria-label="Due date"
            />
            <select
              className="select h-8 text-[11.5px]"
              value={draft.priority}
              onChange={(event) => setDraft({ ...draft, priority: event.target.value as CapaAction["priority"] })}
              aria-label="Priority"
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
            <select
              className="select h-8 text-[11.5px]"
              value={draft.type}
              onChange={(event) => setDraft({ ...draft, type: event.target.value as CapaAction["type"] })}
              aria-label="CAPA type"
            >
              <option>Corrective</option>
              <option>Preventive</option>
            </select>
          </div>
          <textarea
            className="textarea min-h-[40px] text-[11.5px]"
            value={draft.effectiveness_check}
            onChange={(event) => setDraft({ ...draft, effectiveness_check: event.target.value })}
            placeholder="Effectiveness check"
            aria-label="Effectiveness check"
          />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={apply}>
              Apply
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-ink-900">
            {item.action || "New CAPA action — edit to define it."}
          </p>
          {item.explanation && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">{item.explanation}</p>
          )}
          <div className="mt-2.5 grid grid-cols-2 gap-2 text-[10.5px] sm:grid-cols-3">
            <div className="flex items-center gap-1.5 text-ink-500">
              <UserRound className="h-3 w-3 text-ink-400" />
              <span className="font-medium text-ink-700">{item.owner || "Owner TBD"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-ink-500">
              <CalendarDays className="h-3 w-3 text-ink-400" />
              <span className={cn(item.priority === "High" && "font-medium text-rose-600")}>
                {formatDate(item.due_date)}
              </span>
            </div>
            {item.root_cause_ref && (
              <div className="flex items-center gap-1.5 text-ink-500">
                <Target className="h-3 w-3 text-ink-400" />
                <span>{item.root_cause_ref}</span>
              </div>
            )}
          </div>
          {item.effectiveness_check && (
            <div className="mt-2 rounded-md border border-ink-200 bg-ink-50/50 px-2 py-1.5 text-[10.5px] leading-snug text-ink-600">
              <span className="font-semibold uppercase tracking-wide text-ink-400">Effectiveness check · </span>
              {item.effectiveness_check}
            </div>
          )}
        </>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-ink-100 pt-2.5">
        <span className="text-[10px] text-ink-400">
          {accepted ? "Included in the approved CAPA plan" : "Suggested action · reviewer decision required"}
        </span>
        <div className="flex items-center gap-1.5">
          {accepted || rejected ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => dispatch(investigationActions.resetCapa(item.id))}
            >
              <CircleSlash className="h-3 w-3" />
              Reopen
            </button>
          ) : (
            <>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => dispatch(investigationActions.acceptCapa(item.id))}
              >
                <Check className="h-3 w-3" />
                Approve
              </button>
              <button
                className="btn btn-ghost btn-sm text-ink-500 hover:text-rose-600"
                onClick={() => dispatch(investigationActions.rejectCapa(item.id))}
              >
                <X className="h-3 w-3" />
                Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CapaSection({ onRunAnalysis, running }: { onRunAnalysis: () => void; running: boolean }) {
  const dispatch = useAppDispatch();
  const payload = useAppSelector((state) => state.investigation.payload);
  const corrective = payload.capa.filter((item) => item.type === "Corrective").length;
  const preventive = payload.capa.filter((item) => item.type === "Preventive").length;
  const approved = payload.capa.filter((item) => item.status === "accepted").length;

  return (
    <Section
      id="capa"
      index="5"
      title="Corrective & preventive actions"
      description="Each action traces to a cause, with an owner, due date and a measurable effectiveness check."
      actions={
        <div className="flex items-center gap-2">
          {payload.capa.length > 0 && (
            <span className="hidden text-[10.5px] text-ink-400 sm:inline">
              {approved}/{payload.capa.length} approved
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => dispatch(investigationActions.addCapa())}>
            <Plus className="h-3 w-3" />
            Add action
          </button>
        </div>
      }
    >
      {payload.capa.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 px-5 py-9 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-ink-300" />
          <h3 className="mt-2 text-[13px] font-semibold text-ink-800">No CAPA proposed yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-[11.5px] text-ink-500">
            Run the RCA analysis and the copilot will propose corrective and preventive actions, each tied
            to a root cause.
          </p>
          <button className="btn btn-ai btn-sm mt-3" onClick={onRunAnalysis} disabled={running}>
            <Sparkles className="h-3 w-3" />
            Run RCA analysis
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-md bg-accent-50 px-2 py-1 font-medium text-accent-700">
              {corrective} corrective
            </span>
            <span className="rounded-md bg-sky-50 px-2 py-1 font-medium text-sky-700">
              {preventive} preventive
            </span>
            <span className="rounded-md bg-ink-50 px-2 py-1 text-ink-500">
              {pluralize(approved, "action")} approved
            </span>
            <span className="ml-auto text-[10.5px] text-ink-400">
              CAPA must address the confirmed root cause before sign-off
            </span>
          </div>

          {payload.capa.map((item) => (
            <CapaCard key={item.id} item={item} />
          ))}

          <Field label="RCA conclusion" field="conclusion" className="pt-1">
            <textarea
              className="textarea min-h-[78px] text-[12px]"
              value={payload.conclusion ?? ""}
              onChange={(event) =>
                dispatch(investigationActions.setField({ field: "conclusion", value: event.target.value }))
              }
              placeholder="Conclusion for the investigation record, including residual risk and disposition caveat."
            />
          </Field>
        </div>
      )}
    </Section>
  );
}
