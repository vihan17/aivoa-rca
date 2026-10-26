import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  FileSearch,
  FolderOpen,
  Plus,
  Search,
  Sparkles,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchInvestigations } from "../store/investigationsSlice";
import { Brand, StatusBadge } from "../components/ui";
import { cn, formatDate, relativeTime, truncate } from "../lib/format";
import type { InvestigationListItem } from "../lib/types";

type Filter = "all" | "open" | "approved";

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  tone: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-400">{label}</div>
          <div className="stat-value mt-2">{value}</div>
          <div className="mt-1 text-[11.5px] text-ink-500">{hint}</div>
        </div>
        <div className={cn("grid h-9 w-9 place-items-center rounded-lg border", tone)}>{icon}</div>
      </div>
    </div>
  );
}

function InvestigationRow({ item }: { item: InvestigationListItem }) {
  const navigate = useNavigate();
  const accepted = item.leading_cause.status === "accepted";
  return (
    <button
      onClick={() => navigate(`/investigations/${item.id}`)}
      className="group grid w-full grid-cols-[1fr_96px_84px_72px_82px_92px] items-center gap-3 border-b border-ink-100 px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-ink-50/70"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] font-medium text-ink-400">{item.code}</span>
          {item.classification && (
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                item.classification === "Critical"
                  ? "text-rose-600"
                  : item.classification === "Major"
                    ? "text-amber-600"
                    : "text-ink-500",
              )}
            >
              {item.classification}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[13px] font-medium text-ink-900 group-hover:text-accent-800">
          {item.title}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-ink-500">
          {item.product_name || "Unassigned product"} · {item.batch_number || "no batch"}
        </div>
      </div>
      <div>
        <StatusBadge status={item.status} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-ink-400">Evidence</div>
        <div className="text-[12.5px] font-medium text-ink-700">{item.counts.evidence} items</div>
      </div>
      <div>
        <div className="text-[11px] text-ink-400">CAPA</div>
        <div className="text-[12.5px] font-medium text-ink-700">{item.counts.capa}</div>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-ink-400">{accepted ? "Confirmed" : "Leading cause"}</div>
        <div className={cn("text-[12.5px] font-semibold", accepted ? "text-accent-700" : "text-amber-700")}>
          {Math.round((item.leading_cause.confidence || 0) * 100)}%
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-ink-400">
        <span>{relativeTime(item.updated_at)}</span>
        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </button>
  );
}

export default function Dashboard() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, stats, loading, error } = useAppSelector((state) => state.investigations);
  const provider = useAppSelector((state) => state.copilot.provider);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    dispatch(fetchInvestigations());
  }, [dispatch]);

  const filtered = useMemo(() => {
    const byFilter =
      filter === "all"
        ? items
        : filter === "open"
          ? items.filter((item) => item.status === "draft" || item.status === "in_review")
          : items.filter((item) => item.status === "approved" || item.status === "closed");
    if (!query.trim()) return byFilter;
    const q = query.toLowerCase();
    return byFilter.filter((item) =>
      [item.title, item.code, item.product_name, item.batch_number].some((value) =>
        (value || "").toLowerCase().includes(q),
      ),
    );
  }, [items, filter, query]);

  const reviewQueue = items.filter((item) => item.status === "in_review");
  const counts = {
    all: items.length,
    open: items.filter((i) => i.status === "draft" || i.status === "in_review").length,
    approved: items.filter((i) => i.status === "approved" || i.status === "closed").length,
  };

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-6">
          <Link to="/" className="shrink-0">
            <Brand />
          </Link>
          <div className="h-7 w-px bg-ink-200" />
          <nav className="flex items-center gap-1 text-[12.5px]">
            <span className="rounded-md bg-ink-100 px-2.5 py-1.5 font-medium text-ink-800">
              Investigations
            </span>
            <span className="cursor-default px-2.5 py-1.5 text-ink-400" title="Out of scope for this module">
              CAPA tracking
            </span>
            <span className="cursor-default px-2.5 py-1.5 text-ink-400" title="Out of scope for this module">
              Analytics
            </span>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] text-ink-600 md:flex">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  provider?.live ? "bg-accent-500" : "bg-amber-400",
                )}
              />
              {provider?.live ? `Groq · ${provider.model}` : "Demo engine · add Groq key"}
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-ink-900 text-[11px] font-semibold text-white">
              MK
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-6 pb-14 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-700">
              Quality management · API manufacturing
            </div>
            <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink-900">
              Root cause investigations
            </h1>
            <p className="mt-1 max-w-xl text-[13px] text-ink-500">
              Turn a deviation report into a reviewed RCA record: extracted evidence, a 5&nbsp;Whys chain,
              ranked causes, missing-evidence checks and CAPA — with a qualified person in control.
            </p>
          </div>
          <button className="btn btn-primary h-10 px-4" onClick={() => navigate("/new")}>
            <Plus className="h-4 w-4" />
            New investigation
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<FolderOpen className="h-4 w-4 text-accent-700" />}
            label="Open investigations"
            value={stats.open}
            hint="Draft or in QA review"
            tone="border-accent-100 bg-accent-50"
          />
          <StatCard
            icon={<Timer className="h-4 w-4 text-amber-600" />}
            label="Awaiting review"
            value={reviewQueue.length}
            hint="Investigations with a QA decision pending"
            tone="border-amber-100 bg-amber-50"
          />
          <StatCard
            icon={<TriangleAlert className="h-4 w-4 text-rose-500" />}
            label="Open evidence gaps"
            value={stats.open_gaps}
            hint="Items to request before sign-off"
            tone="border-rose-100 bg-rose-50"
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4 text-ai-600" />}
            label="AI runs logged"
            value={stats.ai_runs}
            hint="Every copilot step is recorded in the audit trail"
            tone="border-ai-100 bg-ai-50"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-3.5">
              <h2 className="text-[13.5px] font-semibold text-ink-900">Investigations</h2>
              <div className="ml-2 flex items-center gap-0.5 rounded-lg bg-ink-100 p-0.5">
                {(["all", "open", "approved"] as Filter[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11.5px] font-medium capitalize transition",
                      filter === key ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
                    )}
                  >
                    {key} <span className="ml-0.5 text-ink-400">{counts[key]}</span>
                  </button>
                ))}
              </div>
              <div className="relative ml-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search batch, product, code"
                  className="input h-8 w-56 pl-8 text-[12px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_96px_84px_72px_82px_92px] gap-3 border-b border-ink-100 bg-ink-50/60 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-400">
              <div>Investigation</div>
              <div>Status</div>
              <div>Evidence</div>
              <div>CAPA</div>
              <div>Cause</div>
              <div className="text-right">Updated</div>
            </div>

            {loading && items.length === 0 ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-14 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="px-5 py-10 text-center">
                <p className="text-[13px] font-medium text-rose-600">{error}</p>
                <p className="mt-1 text-[12px] text-ink-500">
                  Check that the FastAPI service is running on port 8000.
                </p>
                <button className="btn btn-secondary btn-sm mt-3" onClick={() => dispatch(fetchInvestigations())}>
                  Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-ink-100">
                  <FileSearch className="h-5 w-5 text-ink-400" />
                </div>
                <h3 className="mt-3 text-[14px] font-semibold text-ink-900">No investigations here yet</h3>
                <p className="mt-1 max-w-xs text-[12px] text-ink-500">
                  Start from a deviation report, an email escalation or pasted notes. The copilot fills the
                  record; you confirm it.
                </p>
                <button className="btn btn-primary btn-sm mt-4" onClick={() => navigate("/new")}>
                  <Plus className="h-3.5 w-3.5" />
                  New investigation
                </button>
              </div>
            ) : (
              filtered.map((item) => <InvestigationRow key={item.id} item={item} />)
            )}
          </section>

          <aside className="space-y-4">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-accent-700" />
                  <h2 className="text-[13px] font-semibold text-ink-900">QA review queue</h2>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">
                  {reviewQueue.length}
                </span>
              </div>
              {reviewQueue.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-ink-500">
                  Nothing waiting for review. Approved records stay immutable.
                </p>
              ) : (
                reviewQueue.map((item) => (
                  <Link
                    key={item.id}
                    to={`/investigations/${item.id}`}
                    className="group block border-b border-ink-100 px-4 py-3 last:border-b-0 hover:bg-ink-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-ink-400">{item.code}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-accent-600" />
                    </div>
                    <div className="mt-0.5 text-[12px] font-medium leading-snug text-ink-800">
                      {truncate(item.title, 62)}
                    </div>
                    <div className="mt-1 text-[10.5px] text-ink-400">
                      {item.batch_number} · updated {relativeTime(item.updated_at)}
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-ai-600" />
                <h2 className="text-[13px] font-semibold text-ink-900">AI engine</h2>
              </div>
              <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] text-ink-500">Provider</span>
                  <span className="text-[11.5px] font-semibold text-ink-800">
                    {provider?.live ? "Groq" : "Demo engine"}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-4">
                  <span className="text-[11.5px] text-ink-500">Model</span>
                  <span className="truncate font-mono text-[10.5px] text-ink-700">{provider?.model ?? "—"}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11.5px] text-ink-500">Inference</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-medium",
                      provider?.live ? "text-accent-700" : "text-amber-700",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", provider?.live ? "bg-accent-500" : "bg-amber-400")} />
                    {provider?.live ? "Live" : "Offline"}
                  </span>
                </div>
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-ink-500">
                {provider?.live
                  ? "LangGraph orchestrates Groq for extraction, 5 Whys, fishbone, root-cause synthesis, CAPA and an independent QA critique."
                  : "Deterministic demo responses keep the workflow testable. Set GROQ_API_KEY in backend/.env for live inference."}
              </p>
            </div>

            <div className="card p-4">
              <h2 className="text-[13px] font-semibold text-ink-900">How the flow works</h2>
              <ol className="mt-3 space-y-3">
                {[
                  ["Ingest", "PDF, email or pasted deviation record is turned into evidence."],
                  ["Propose", "LangGraph builds the 5 Whys, 6M fishbone, causes and CAPA."],
                  ["Confirm", "QA edits, confirms causes and signs electronically."],
                ].map(([title, copy], index) => (
                  <li key={title} className="flex gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-ink-200 bg-ink-50 text-[10px] font-semibold text-ink-600">
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-[11.5px] font-semibold text-ink-800">{title}</div>
                      <div className="text-[11px] leading-snug text-ink-500">{copy}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>

        <footer className="mt-8 flex items-center justify-between text-[10.5px] text-ink-400">
          <span>AIVOA Quality Intelligence · RCA module · 21 CFR Part 11 style audit trail</span>
          <span>Records last refreshed {formatDate(new Date().toISOString())}</span>
        </footer>
      </main>
    </div>
  );
}
