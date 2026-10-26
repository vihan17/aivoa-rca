import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  ClipboardList,
  FileSearch,
  GitBranch,
  History,
  Lock,
  Package,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "../lib/api";
import type { InvestigationDetail, SectionId } from "../lib/types";
import { cn, pct, relativeTime } from "../lib/format";
import { useRcaActions } from "../hooks/useRcaActions";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { copilotActions } from "../store/copilotSlice";
import { investigationActions } from "../store/investigationSlice";
import { uiActions } from "../store/uiSlice";
import { Brand, Spinner, StatusBadge } from "../components/ui";
import CopilotPanel from "../components/copilot/CopilotPanel";
import IncidentSection from "../components/workspace/IncidentSection";
import ProductSection from "../components/workspace/ProductSection";
import EvidenceSection from "../components/workspace/EvidenceSection";
import RcaSection from "../components/workspace/RcaSection";
import CapaSection from "../components/workspace/CapaSection";
import SignoffSection from "../components/workspace/SignoffSection";
import AuditSection from "../components/workspace/AuditSection";
import SignoffModal from "../components/modals/SignoffModal";
import EmailModal from "../components/modals/EmailModal";

const SECTION_ORDER: SectionId[] = ["incident", "product", "evidence", "rca", "capa", "signoff", "audit"];

export default function Workspace() {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const investigation = useAppSelector((state) => state.investigation);
  const copilotOpen = useAppSelector((state) => state.ui.copilotOpen);
  const analysisRunning = useAppSelector((state) => state.copilot.analysisRun.status === "running");
  const { analyze } = useRcaActions();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("incident");
  const [signoffOpen, setSignoffOpen] = useState(false);

  const {
    id,
    code,
    status,
    payload,
    provenance,
    aiMeta,
    audit,
    dirty,
    saving,
    loading,
    savedAt,
    error,
    sourceId,
  } = investigation;

  const signed = status === "approved" || Boolean(payload.signoff?.signature);
  const acceptedCauses = payload.root_causes.filter((cause) => cause.status === "accepted");
  const acceptedCapa = payload.capa.filter((item) => item.status === "accepted");
  const openGaps = payload.gaps.filter((gap) => gap.status === "open");

  async function refreshAudit(target?: string | null) {
    const key = target ?? id;
    if (!key) return;
    try {
      const response = await api.audit(key);
      dispatch(investigationActions.setAudit(response.items));
    } catch {
      /* audit refresh is best effort */
    }
  }

  useEffect(() => {
    if (!routeId) {
      dispatch(investigationActions.reset());
      dispatch(copilotActions.resetCopilot());
      setActiveSection("incident");
      scrollRef.current?.scrollTo({ top: 0 });
      return;
    }
    if (id === routeId) return;

    let cancelled = false;
    dispatch(investigationActions.loadStart());
    dispatch(copilotActions.resetCopilot());
    (async () => {
      try {
        const detail = await api.getInvestigation(routeId);
        if (cancelled) return;
        dispatch(investigationActions.loadSuccess(detail));
        try {
          const events = await api.audit(routeId);
          if (!cancelled) dispatch(investigationActions.setAudit(events.items));
        } catch {
          /* no audit yet */
        }
      } catch (loadError) {
        if (cancelled) return;
        dispatch(
          investigationActions.loadError(
            loadError instanceof Error ? loadError.message : "Could not load this investigation.",
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, dispatch]);

  async function handleSave(options?: { silent?: boolean }): Promise<InvestigationDetail | null> {
    if (saving) return null;
    dispatch(investigationActions.saveStart());
    try {
      const body = {
        payload: { ...payload, status },
        provenance,
        ai_meta: aiMeta,
      };
      const detail = id
        ? await api.updateInvestigation(id, body)
        : await api.createInvestigation({ ...body, source_id: sourceId ?? undefined });
      dispatch(investigationActions.saveSuccess(detail));
      if (!id) navigate(`/investigations/${detail.id}`, { replace: true });
      void refreshAudit(detail.id);
      if (!options?.silent) {
        dispatch(
          uiActions.pushToast({
            kind: "success",
            title: `${detail.code} saved`,
            message: `Version ${detail.version} · every change is in the audit trail.`,
          }),
        );
      }
      if (signed && detail.status !== "approved") {
        dispatch(
          uiActions.pushToast({
            kind: "info",
            title: "Signature invalidated",
            message: "The record was amended and has returned to QA review.",
          }),
        );
      }
      return detail;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "The record could not be saved.";
      dispatch(investigationActions.saveError(message));
      dispatch(uiActions.pushToast({ kind: "error", title: "Could not save", message }));
      return null;
    }
  }

  async function handleSignoff() {
    if (signed) return;
    if (id) {
      setSignoffOpen(true);
      return;
    }
    const detail = await handleSave({ silent: true });
    if (detail) setSignoffOpen(true);
  }

  function scrollToSection(section: SectionId) {
    const element = document.getElementById(`section-${section}`);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(section);
  }

  function handleScroll() {
    const root = scrollRef.current;
    if (!root) return;
    const threshold = root.getBoundingClientRect().top + 120;
    let current: SectionId = "incident";
    for (const section of SECTION_ORDER) {
      const element = document.getElementById(`section-${section}`);
      if (element && element.getBoundingClientRect().top <= threshold) current = section;
    }
    setActiveSection(current);
  }

  const steps = [
    {
      id: "incident" as SectionId,
      label: "Incident",
      icon: ClipboardList,
      complete: Boolean(payload.title.trim() && payload.description.trim()),
    },
    {
      id: "product" as SectionId,
      label: "Product & impact",
      icon: Package,
      complete: Boolean(payload.product_name.trim() && payload.batch_number.trim()),
    },
    {
      id: "evidence" as SectionId,
      label: "Evidence",
      icon: FileSearch,
      complete: payload.evidence.length > 0,
      meta: payload.evidence.length ? String(payload.evidence.length) : undefined,
    },
    {
      id: "rca" as SectionId,
      label: "Root cause",
      icon: GitBranch,
      complete: acceptedCauses.length > 0,
      meta: payload.root_causes.length ? String(payload.root_causes.length) : undefined,
    },
    {
      id: "capa" as SectionId,
      label: "CAPA",
      icon: ClipboardCheck,
      complete: acceptedCapa.length > 0,
      meta: payload.capa.length ? String(payload.capa.length) : undefined,
    },
    {
      id: "signoff" as SectionId,
      label: "Sign-off",
      icon: PenLine,
      complete: signed,
      meta: openGaps.length ? String(openGaps.length) : undefined,
    },
    {
      id: "audit" as SectionId,
      label: "Audit trail",
      icon: History,
      complete: audit.length > 0,
      meta: audit.length ? String(audit.length) : undefined,
    },
  ];

  const readinessSteps = steps.slice(0, 6);
  const completed = readinessSteps.filter((step) => step.complete).length;
  const readiness = completed / readinessSteps.length;

  const showNewBanner = !id && !payload.title.trim() && payload.evidence.length === 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-50">
      <header className="z-30 flex h-[60px] shrink-0 items-center gap-2.5 border-b border-ink-200 bg-white px-3 sm:gap-3 sm:px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2 rounded-md px-0.5 py-1 hover:opacity-80">
          <Brand compact />
          <span className="hidden text-[14px] font-semibold tracking-tight text-ink-900 sm:block">AIVOA</span>
        </Link>
        <span className="hidden h-6 w-px bg-ink-200 sm:block" />
        <div className="hidden min-w-0 shrink-0 items-center gap-1 text-[11px] text-ink-400 md:flex">
          <Link to="/" className="rounded px-1 py-0.5 hover:bg-ink-50 hover:text-ink-700">
            Investigations
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-mono text-[10px] text-ink-600">{code || "New"}</span>
        </div>

        <div className="min-w-0 flex-1 pl-1">
          <div className="truncate text-[12.5px] font-semibold text-ink-900">
            {payload.title || (id ? "Untitled investigation" : "New RCA investigation")}
          </div>
          <div className="hidden truncate text-[9.5px] text-ink-400 sm:block">
            {payload.product_name || "No product assigned"}
            {payload.batch_number ? ` · ${payload.batch_number}` : ""}
            {payload.source_kind ? ` · source: ${payload.source_kind}` : ""}
          </div>
        </div>

        <div className="hidden items-center gap-2 text-[10px] text-ink-400 lg:flex">
          {dirty ? (
            <span className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Unsaved
            </span>
          ) : savedAt ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-accent-500" />
              Saved {relativeTime(savedAt)}
            </span>
          ) : null}
        </div>

        <div className="hidden sm:block">
          <StatusBadge status={status} />
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => void handleSave()}
          disabled={saving}
          title="Save a new version and write to the audit trail"
        >
          {saving ? <Spinner className="h-3 w-3" /> : <Save className="h-3 w-3" />}
          <span className="hidden sm:inline">{saving ? "Saving…" : "Save"}</span>
        </button>

        {signed ? (
          <button
            className="btn btn-sm border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100"
            onClick={() => scrollToSection("signoff")}
          >
            <Lock className="h-3 w-3" />
            <span className="hidden sm:inline">Signed</span>
          </button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void handleSignoff()}
            disabled={acceptedCauses.length === 0 || acceptedCapa.length === 0}
            title={
              acceptedCauses.length === 0
                ? "Confirm a root cause first"
                : acceptedCapa.length === 0
                  ? "Approve a CAPA action first"
                  : "Review and apply the electronic signature"
            }
          >
            <PenLine className="h-3 w-3" />
            <span className="hidden sm:inline">Sign off</span>
          </button>
        )}

        <button
          className={cn("btn btn-sm px-2", copilotOpen ? "btn-ghost" : "btn-secondary")}
          onClick={() => dispatch(uiActions.toggleCopilot())}
          title={copilotOpen ? "Hide the copilot" : "Show the copilot"}
        >
          {copilotOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[196px] shrink-0 flex-col border-r border-ink-200 bg-white lg:flex">
          <div className="px-3 pb-1.5 pt-4 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Record sections
          </div>
          <nav className="space-y-0.5 px-2">
            {steps.map((step) => {
              const Icon = step.icon;
              const active = activeSection === step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => scrollToSection(step.id)}
                  className={cn(
                    "nav-rail-item items-center",
                    active
                      ? "bg-accent-50 text-accent-900"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      active ? "text-accent-700" : step.complete ? "text-accent-600" : "text-ink-400",
                    )}
                  />
                  <span className={cn("flex-1 truncate", active && "font-medium")}>{step.label}</span>
                  {step.meta && (
                    <span
                      className={cn(
                        "rounded px-1 py-0.5 text-[8px] font-semibold",
                        step.id === "signoff" && openGaps.length > 0
                          ? "bg-amber-100 text-amber-700"
                          : "bg-ink-100 text-ink-500",
                      )}
                    >
                      {step.meta}
                    </span>
                  )}
                  {step.complete ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-accent-600" />
                  ) : (
                    <Circle className="h-3 w-3 shrink-0 text-ink-200" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mx-3 mt-4 rounded-lg border border-ink-200 bg-ink-50/60 p-2.5">
            <div className="flex items-center justify-between text-[9.5px]">
              <span className="font-medium text-ink-600">Record readiness</span>
              <span className="font-semibold text-accent-700">{pct(readiness)}</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-200">
              <div
                className="h-full rounded-full bg-accent-600 transition-all duration-300"
                style={{ width: pct(readiness) }}
              />
            </div>
            <p className="mt-1.5 text-[9px] leading-snug text-ink-400">
              {completed} of {readinessSteps.length} sections complete. Sign-off needs a confirmed cause and an
              approved CAPA.
            </p>
          </div>

          <div className="mt-auto border-t border-ink-100 p-3">
            <div className="flex items-center gap-1.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              <ShieldCheck className="h-3 w-3 text-accent-600" />
              Part 11 style controls
            </div>
            <p className="mt-1 text-[9px] leading-snug text-ink-400">
              Identity, meaning and attestations are captured. Amending a signed record invalidates the signature.
            </p>
            {aiMeta.provider && (
              <div className="mt-2 flex items-center gap-1 rounded border border-ink-200 bg-white px-1.5 py-1 font-mono text-[8.5px] text-ink-500">
                <Sparkles className="h-2.5 w-2.5 text-ai-500" />
                {String(aiMeta.provider)} · {String(aiMeta.model ?? "")}
              </div>
            )}
          </div>
        </aside>

        <main
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative min-w-0 flex-1 overflow-y-auto bg-ink-50"
        >
          <div className="mx-auto max-w-[880px] px-4 py-4 sm:px-5">
            {showNewBanner && (
              <div className="mb-3 flex items-start gap-3 rounded-xl border border-ai-200 bg-gradient-to-r from-ai-50 via-white to-white px-4 py-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ai-600 text-white shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-ink-900">Start with the source document</div>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-ink-500">
                    Upload the deviation report, load a sample email or paste the text in the copilot. The
                    extraction fills this form — nothing is confirmed until you review it.
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-1 text-[9px] text-ink-400 sm:flex">
                  <span className="rounded border border-ink-200 bg-white px-1.5 py-0.5">1 · ingest</span>
                  <ChevronRight className="h-2.5 w-2.5" />
                  <span className="rounded border border-ink-200 bg-white px-1.5 py-0.5">2 · review</span>
                  <ChevronRight className="h-2.5 w-2.5" />
                  <span className="rounded border border-ink-200 bg-white px-1.5 py-0.5">3 · sign</span>
                </div>
              </div>
            )}

            {signed && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-[10.5px] leading-snug text-accent-800">
                <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                This record is approved and signed. Editing and saving an amendment invalidates the signature and
                returns the record to QA review as a new version.
              </div>
            )}

            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">Could not load this investigation</div>
                  <div className="mt-0.5 text-[10px]">{error}</div>
                </div>
                <button className="btn btn-secondary btn-sm border-rose-200" onClick={() => navigate("/")}>
                  Back
                </button>
              </div>
            )}

            <div className="space-y-4 pb-8">
              <IncidentSection />
              <ProductSection />
              <EvidenceSection />
              <RcaSection onRunAnalysis={() => void analyze()} running={analysisRunning} />
              <CapaSection onRunAnalysis={() => void analyze()} running={analysisRunning} />
              <SignoffSection onSignoff={() => void handleSignoff()} />
              <AuditSection onRefresh={() => void refreshAudit()} />

              <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1 text-[9px] text-ink-400">
                <span>
                  AIVOA Quality Intelligence · RCA module · {code || "unsaved draft"}
                  {payload.source_kind ? ` · source ${payload.source_kind}` : ""}
                </span>
                <span>
                  {savedAt ? `Last saved ${relativeTime(savedAt)}` : "Not saved yet"} · review before sign-off
                </span>
              </footer>
            </div>
          </div>

          {loading && (
            <div className="absolute inset-0 z-20 flex items-start justify-center bg-ink-50/70 pt-24 backdrop-blur-[1px]">
              <div className="card flex items-center gap-2.5 px-4 py-3 text-[12px] text-ink-600">
                <Spinner className="text-accent-600" />
                Loading investigation…
              </div>
            </div>
          )}
        </main>

        {copilotOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-ink-900/20 backdrop-blur-[1px] xl:hidden"
              onClick={() => dispatch(uiActions.toggleCopilot(false))}
            />
            <aside className="fixed bottom-0 right-0 top-[60px] z-40 flex w-[392px] max-w-full border-l border-ink-200 bg-white shadow-panel xl:static xl:h-full xl:w-[392px] xl:shrink-0 xl:shadow-none">
              <CopilotPanel
                onClose={() => dispatch(uiActions.toggleCopilot(false))}
                onOpenRca={() => scrollToSection("rca")}
              />
            </aside>
          </>
        )}
      </div>

      <SignoffModal open={signoffOpen} onClose={() => setSignoffOpen(false)} onSigned={() => void refreshAudit()} />
      <EmailModal />
    </div>
  );
}
