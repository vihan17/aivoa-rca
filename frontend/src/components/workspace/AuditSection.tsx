import {
  BadgeCheck,
  CircleDot,
  ClipboardCheck,
  FilePlus2,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAppSelector } from "../../store/hooks";
import type { ReactNode } from "react";
import { cn, formatDateTime } from "../../lib/format";
import type { AuditEvent } from "../../lib/types";
import { Section } from "./Section";

const ACTION_META: Record<string, { label: string; tone: string; icon: ReactNode }> = {
  created: {
    label: "Investigation created",
    tone: "border-ink-200 bg-white text-ink-600",
    icon: <FilePlus2 className="h-3 w-3" />,
  },
  "ai.extraction": {
    label: "Copilot extraction",
    tone: "border-ai-200 bg-ai-50 text-ai-700",
    icon: <Sparkles className="h-3 w-3" />,
  },
  "ai.analysis": {
    label: "Copilot root cause analysis",
    tone: "border-ai-200 bg-ai-50 text-ai-700",
    icon: <Sparkles className="h-3 w-3" />,
  },
  saved: {
    label: "Draft saved",
    tone: "border-sky-200 bg-sky-50 text-sky-700",
    icon: <Save className="h-3 w-3" />,
  },
  "root_cause.confirmed": {
    label: "Root cause confirmed",
    tone: "border-accent-200 bg-accent-50 text-accent-700",
    icon: <BadgeCheck className="h-3 w-3" />,
  },
  "capa.approved": {
    label: "CAPA approved",
    tone: "border-accent-200 bg-accent-50 text-accent-700",
    icon: <ClipboardCheck className="h-3 w-3" />,
  },
  signed: {
    label: "Electronic signature applied",
    tone: "border-accent-300 bg-accent-100 text-accent-900",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  "approval.invalidated": {
    label: "Signature invalidated",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    icon: <ShieldAlert className="h-3 w-3" />,
  },
};

function detailLines(event: AuditEvent): ReactNode {
  const detail = event.detail as Record<string, unknown>;
  const action = event.action;

  if (action === "created") {
    const source = (detail.source as { kind?: string } | undefined)?.kind;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <span className="chip">source · {source || "manual"}</span>
        {Boolean(detail.ai_provider) && <span className="chip">provider · {String(detail.ai_provider)}</span>}
      </div>
    );
  }

  if (action.startsWith("ai.")) {
    const provider = detail.provider as { provider?: string; model?: string } | undefined;
    const summary = (detail.summary as Record<string, number> | undefined) ?? {};
    return (
      <div className="mt-1.5">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(summary).map(([key, value]) => (
            <span key={key} className="chip">
              {key.replace(/_/g, " ")} · {value}
            </span>
          ))}
          {Boolean(detail.latency_ms) && <span className="chip">{String(detail.latency_ms)} ms</span>}
        </div>
        {provider?.provider && (
          <div className="mt-1 font-mono text-[9.5px] text-ink-400">
            {provider.provider} · {provider.model}
          </div>
        )}
      </div>
    );
  }

  if (action === "saved") {
    const changed = (detail.changed as string[] | undefined) ?? [];
    const causes = (detail.accepted_root_causes as string[] | undefined) ?? [];
    const capa = (detail.accepted_capa as string[] | undefined) ?? [];
    return (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <span className="chip">{changed.length} sections changed</span>
        {causes.length > 0 && <span className="chip">causes · {causes.join(", ")}</span>}
        {capa.length > 0 && <span className="chip">CAPA · {capa.join(", ")}</span>}
      </div>
    );
  }

  if (action === "signed") {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="chip border-accent-200 bg-accent-50 text-accent-700">
          {String(detail.signature || "")}
        </span>
        <span className="text-[10.5px] text-ink-500">{String(detail.meaning || "")}</span>
      </div>
    );
  }

  if (action === "approval.invalidated") {
    return (
      <div className="mt-1.5 text-[10.5px] text-amber-700">
        {String(detail.reason || "")} · status {String(detail.new_status || "in_review")}
      </div>
    );
  }

  if (action === "root_cause.confirmed" || action === "capa.approved") {
    const ids = (detail.ids as string[] | undefined) ?? [];
    return (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <span key={id} className="chip">
            {id}
          </span>
        ))}
      </div>
    );
  }

  return null;
}

export default function AuditSection({ onRefresh }: { onRefresh: () => void }) {
  const { audit, id, dirty } = useAppSelector((state) => state.investigation);

  return (
    <Section
      id="audit"
      index="7"
      title="Audit trail"
      description="Append-only record of who changed what, every copilot run, every confirmation and the signature."
      actions={
        <button className="btn btn-secondary btn-sm" onClick={onRefresh} disabled={!id}>
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      }
    >
      {!id ? (
        <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50/40 px-4 py-8 text-center">
          <CircleDot className="mx-auto h-5 w-5 text-ink-300" />
          <p className="mt-2 text-[12px] font-medium text-ink-700">The audit trail starts when the record is saved</p>
          <p className="mt-0.5 text-[11px] text-ink-500">
            Sign-off events, field changes and AI runs are appended automatically.
          </p>
        </div>
      ) : audit.length === 0 ? (
        <p className="px-2 py-6 text-center text-[12px] text-ink-500">No events recorded yet.</p>
      ) : (
        <>
          {dirty && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10.5px] text-amber-800">
              Unsaved changes are not yet in the audit trail. Save to create a new versioned event.
            </div>
          )}
          <ol className="relative space-y-0">
            {audit.map((event, index) => {
              const meta = ACTION_META[event.action] ?? {
                label: event.action,
                tone: "border-ink-200 bg-white text-ink-600",
                icon: <CircleDot className="h-3 w-3" />,
              };
              return (
                <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < audit.length - 1 && (
                    <span className="absolute left-[11px] top-7 h-[calc(100%-14px)] w-px bg-ink-200" />
                  )}
                  <span className="relative z-10 mt-0.5 grid h-[23px] w-[23px] shrink-0 place-items-center rounded-full border border-ink-200 bg-white">
                    <span
                      className={cn(
                        "grid h-[17px] w-[17px] place-items-center rounded-full border",
                        meta.tone,
                      )}
                    >
                      {meta.icon}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="text-[11.5px] font-semibold text-ink-800">{meta.label}</div>
                      <div className="font-mono text-[9.5px] text-ink-400">{formatDateTime(event.at)}</div>
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-ink-500">by {event.actor}</div>
                    {detailLines(event)}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-[9.5px] leading-snug text-ink-400">
            Events are append-only. Approved records cannot be edited without invalidating the signature and
            creating a new review cycle.
          </p>
        </>
      )}
    </Section>
  );
}
