import type { ReactNode } from "react";
import { cn } from "../../lib/format";
import { useAppSelector } from "../../store/hooks";

export function CompletionDot({ complete }: { complete: boolean }) {
  return (
    <span
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[9px] font-semibold",
        complete
          ? "border-accent-200 bg-accent-50 text-accent-700"
          : "border-ink-200 bg-white text-ink-300",
      )}
    >
      {complete ? "✓" : ""}
    </span>
  );
}

export function Section({
  id,
  index,
  title,
  description,
  actions,
  children,
  tone = "default",
}: {
  id: string;
  index: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "default" | "ai";
}) {
  const stale = useAppSelector((state) => state.investigation.analysisStale);
  return (
    <section id={`section-${id}`} className={cn("section-card", tone === "ai" && "border-ai-200/80")}>
      <div
        className={cn(
          "section-head",
          tone === "ai" && "border-ai-100 bg-gradient-to-r from-ai-50/70 via-white to-white",
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10.5px] font-semibold",
              tone === "ai" ? "bg-ai-600 text-white" : "bg-ink-900 text-white",
            )}
          >
            {index}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-semibold tracking-tight text-ink-900">{title}</h2>
              {tone === "ai" && (
                <span className="rounded border border-ai-200 bg-ai-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ai-700">
                  Copilot
                </span>
              )}
              {stale && id === "rca" && (
                <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                  Source changed
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">{description}</p>
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="section-body">{children}</div>
    </section>
  );
}
