import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { uiActions } from "../store/uiSlice";
import type { ProvenanceEntry, Status } from "../lib/types";
import { cn, confidenceTone, pct, STATUS_META } from "../lib/format";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent-700 shadow-sm">
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden>
          <path
            d="M8 22V11.2L16 6l8 5.2V22l-8 5-8-5Z"
            stroke="#CCFBF1"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="16" r="2.6" fill="#5EEAD4" />
          <path
            d="M16 13.4v-2.6M16 18.6v2.6M13.6 14.8l-2.4-1.4M18.4 14.8l2.4-1.4M13.6 17.2l-2.4 1.4M18.4 17.2l2.4 1.4"
            stroke="#5EEAD4"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-ink-900">AIVOA</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-400">
            Quality Intelligence
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        meta.className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function AiBadge({
  entry,
  className,
}: {
  entry?: ProvenanceEntry;
  className?: string;
}) {
  if (!entry) return null;
  const isAi = entry.source === "ai";
  return (
    <span
      className={cn(
        "group relative inline-flex cursor-help items-center gap-1 rounded border px-1 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide",
        isAi
          ? "border-ai-200 bg-ai-50 text-ai-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
        className,
      )}
    >
      {isAi ? <Sparkles className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}
      {isAi ? `AI ${pct(entry.confidence)}` : "Edited"}
      {isAi && (entry.quote || entry.ref) && (
        <span className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 hidden w-64 rounded-lg border border-ink-200 bg-white p-2.5 text-left text-[11px] font-normal normal-case tracking-normal text-ink-600 shadow-lift group-hover:block">
          {entry.quote && <span className="block italic leading-snug">“{entry.quote}”</span>}
          {entry.ref && <span className="mt-1 block text-[10px] text-ink-400">{entry.ref}</span>}
        </span>
      )}
    </span>
  );
}

export function Field({
  label,
  field,
  children,
  hint,
  className,
  optional,
}: {
  label: string;
  field?: string;
  children: ReactNode;
  hint?: string;
  className?: string;
  optional?: boolean;
}) {
  const entry = useAppSelector((state) => (field ? state.investigation.provenance[field] : undefined));
  const ai = entry?.source === "ai";
  return (
    <div
      className={cn(
        "min-w-0",
        ai && "[&_input]:border-l-2 [&_input]:border-l-ai-300 [&_textarea]:border-l-2 [&_textarea]:border-l-ai-300 [&_select]:border-l-2 [&_select]:border-l-ai-300",
        entry?.source === "human" &&
          !ai &&
          "[&_input]:border-l-2 [&_input]:border-l-amber-300 [&_textarea]:border-l-2 [&_textarea]:border-l-amber-300 [&_select]:border-l-2 [&_select]:border-l-amber-300",
        className,
      )}
    >
      <div className="label">
        <span>{label}</span>
        {optional && <span className="text-[9.5px] font-normal normal-case text-ink-400">optional</span>}
        {field && <AiBadge entry={entry} />}
        {hint && (
          <span className="group relative ml-auto inline-flex cursor-help text-ink-400" aria-label={hint}>
            <Info className="h-3 w-3" />
            <span className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 hidden w-56 rounded-lg border border-ink-200 bg-white p-2 text-[11px] font-normal normal-case tracking-normal text-ink-600 shadow-lift group-hover:block">
              {hint}
            </span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function ConfidenceBar({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const tone = confidenceTone(value);
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-1.5 w-16 overflow-hidden rounded-full", tone.bg)}>
        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: pct(value) }} />
      </div>
      {showLabel && <span className={cn("text-[11px] font-semibold tabular-nums", tone.text)}>{pct(value)}</span>}
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const tones: Record<string, string> = {
    High: "border-rose-200 bg-rose-50 text-rose-700",
    Medium: "border-amber-200 bg-amber-50 text-amber-700",
    Low: "border-ink-200 bg-ink-50 text-ink-600",
  };
  return (
    <span className={cn("badge", tones[priority] ?? tones.Low)}>{priority}</span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "badge",
        type === "Corrective"
          ? "border-accent-200 bg-accent-50 text-accent-700"
          : "border-sky-200 bg-sky-50 text-sky-700",
      )}
    >
      {type === "Corrective" ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
      {type}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full animate-fade-up rounded-2xl border border-ink-200 bg-white shadow-panel",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-ink-500">{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-sm -mr-1" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function ToastItem({ toast }: { toast: { id: string; kind: string; title: string; message?: string } }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const timer = window.setTimeout(() => dispatch(uiActions.dismissToast(toast.id)), 4500);
    return () => window.clearTimeout(timer);
  }, [dispatch, toast.id]);

  const icon =
    toast.kind === "success" ? (
      <CheckCircle2 className="h-4 w-4 text-accent-600" />
    ) : toast.kind === "error" ? (
      <AlertTriangle className="h-4 w-4 text-rose-500" />
    ) : (
      <Info className="h-4 w-4 text-sky-500" />
    );

  return (
    <div className="pointer-events-auto flex w-[330px] animate-fade-up items-start gap-3 rounded-xl border border-ink-200 bg-white p-3.5 shadow-lift">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-ink-900">{toast.title}</div>
        {toast.message && <div className="mt-0.5 text-[11.5px] leading-snug text-ink-500">{toast.message}</div>}
      </div>
      <button
        onClick={() => dispatch(uiActions.dismissToast(toast.id))}
        className="text-ink-400 transition hover:text-ink-700"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastHost() {
  const toasts = useAppSelector((state) => state.ui.toasts);
  return (
    <div className="pointer-events-none fixed bottom-5 left-5 z-[60] flex w-[350px] max-w-[calc(100vw-40px)] flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
