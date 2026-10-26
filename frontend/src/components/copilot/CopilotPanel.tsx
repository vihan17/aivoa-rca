import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardType,
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  NotebookPen,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { api } from "../../lib/api";
import type { SampleDoc, SourceDoc, StageEvent } from "../../lib/types";
import { cn, pluralize } from "../../lib/format";
import { copilotActions } from "../../store/copilotSlice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { requestEvidenceEmail } from "../../store/thunks";
import { uiActions } from "../../store/uiSlice";
import { useRcaActions } from "../../hooks/useRcaActions";
import { Spinner } from "../ui";

const SAMPLE_ICON: Record<string, ReactNode> = {
  pdf: <FileText className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  text: <NotebookPen className="h-3.5 w-3.5" />,
};

function RunSteps({
  title,
  stages,
  running,
  error,
  open,
  onToggle,
}: {
  title: string;
  stages: StageEvent[];
  running: boolean;
  error?: string;
  open: boolean;
  onToggle: () => void;
}) {
  if (stages.length === 0 && !running && !error) return null;
  const expanded = running || open;

  return (
    <div className="mt-2.5 overflow-hidden rounded-lg border border-ink-200 bg-white">
      <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-500">
          {running ? <Spinner className="h-3 w-3 text-ai-600" /> : <CheckCircle2 className="h-3 w-3 text-accent-600" />}
          {title}
        </div>
        <button
          className="flex items-center gap-0.5 text-[9.5px] font-medium text-ink-400 hover:text-ink-700"
          onClick={onToggle}
          disabled={running}
        >
          {expanded ? "Hide steps" : "View steps"}
          {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        </button>
      </div>
      {expanded && (
        <div className="max-h-44 space-y-1.5 overflow-y-auto px-2.5 py-2">
          {stages.map((stage, index) => (
            <div key={`${stage.stage}-${index}`} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">
                {stage.status === "done" ? (
                  <CheckCircle2 className="h-3 w-3 text-accent-600" />
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin text-ai-600" />
                )}
              </span>
              <div className="min-w-0">
                <div className="text-[10.5px] font-medium leading-tight text-ink-700">{stage.label}</div>
                {stage.detail && (
                  <div className="mt-0.5 text-[9.5px] leading-snug text-ink-400">{stage.detail}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-1.5 border-t border-rose-100 bg-rose-50 px-2.5 py-1.5 text-[10px] leading-snug text-rose-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

function SourceTab({ onOpenRca }: { onOpenRca: () => void }) {
  const dispatch = useAppDispatch();
  const { extract, analyze } = useRcaActions();
  const {
    source,
    inputMode,
    pastedText,
    samples,
    dragOver,
    uploadError,
    intakeRun,
    analysisRun,
    emailLoading,
  } = useAppSelector((state) => state.copilot);
  const payload = useAppSelector((state) => state.investigation.payload);
  const gaps = payload.gaps.filter((gap) => gap.status === "open");
  const [uploading, setUploading] = useState(false);
  const [sampleBusy, setSampleBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [analysisStepsOpen, setAnalysisStepsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const intakeDone = intakeRun.status === "done";
  const analysisDone = analysisRun.status === "done";
  const intakeRunning = intakeRun.status === "running";
  const analysisRunning = analysisRun.status === "running";

  async function ingest(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      dispatch(copilotActions.setUploadError("File is larger than 15 MB."));
      return;
    }
    setUploading(true);
    dispatch(copilotActions.setUploadError(null));
    try {
      const doc = await api.uploadSource(file);
      dispatch(copilotActions.setSource(doc));
      dispatch(
        uiActions.pushToast({
          kind: "success",
          title: "Source added",
          message: `${file.name} · ${doc.meta.chars ?? 0} characters read.`,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read this file.";
      dispatch(copilotActions.setUploadError(message));
    } finally {
      setUploading(false);
    }
  }

  async function loadSample(sample: SampleDoc) {
    setSampleBusy(sample.id);
    dispatch(copilotActions.setUploadError(null));
    try {
      const doc = await api.pasteSource(sample.text, sample.name);
      dispatch(copilotActions.setSource(doc));
      dispatch(
        uiActions.pushToast({
          kind: "success",
          title: "Sample loaded",
          message: `${sample.name} is ready to extract.`,
        }),
      );
    } catch (error) {
      dispatch(
        copilotActions.setUploadError(error instanceof Error ? error.message : "Could not load the sample."),
      );
    } finally {
      setSampleBusy(null);
    }
  }

  async function usePastedText() {
    if (pastedText.trim().length < 20) return;
    setUploading(true);
    dispatch(copilotActions.setUploadError(null));
    try {
      const doc = await api.pasteSource(pastedText);
      dispatch(copilotActions.setSource(doc));
      dispatch(uiActions.pushToast({ kind: "success", title: "Text added as the source document" }));
    } catch (error) {
      dispatch(
        copilotActions.setUploadError(error instanceof Error ? error.message : "Could not read the pasted text."),
      );
    } finally {
      setUploading(false);
    }
  }

  if (!source) {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-2.5 flex rounded-lg border border-ink-200 bg-white p-0.5">
          {[
            { id: "upload" as const, label: "Upload file", icon: <UploadCloud className="h-3 w-3" /> },
            { id: "paste" as const, label: "Paste text / email", icon: <ClipboardType className="h-3 w-3" /> },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => dispatch(copilotActions.setInputMode(mode.id))}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition",
                inputMode === mode.id
                  ? "bg-ink-900 text-white shadow-sm"
                  : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
              )}
            >
              {mode.icon}
              {mode.label}
            </button>
          ))}
        </div>

        {inputMode === "upload" ? (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              dispatch(copilotActions.setDragOver(true));
            }}
            onDragLeave={() => dispatch(copilotActions.setDragOver(false))}
            onDrop={(event) => {
              event.preventDefault();
              dispatch(copilotActions.setDragOver(false));
              const file = event.dataTransfer.files?.[0];
              if (file) void ingest(file);
            }}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors",
              dragOver
                ? "border-accent-400 bg-accent-50"
                : "border-ink-200 bg-gradient-to-b from-ink-50/70 to-white hover:border-accent-300 hover:bg-accent-50/30",
            )}
          >
            <div className="grid h-9 w-9 place-items-center rounded-full border border-ink-200 bg-white shadow-sm">
              {uploading ? <Spinner className="h-4 w-4 text-accent-600" /> : <UploadCloud className="h-4 w-4 text-ink-400" />}
            </div>
            <p className="mt-2 text-[12px] font-medium text-ink-800">
              {uploading ? "Reading the document…" : "Drop the source document"}
            </p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-ink-500">
              PDF deviation report, .eml email or .txt note
            </p>
            <button
              className="btn btn-secondary btn-sm mt-2.5"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              Browse files
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.eml,.txt,.md,application/pdf,message/rfc822,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void ingest(file);
                event.target.value = "";
              }}
            />
            <p className="mt-2 text-[9px] uppercase tracking-wide text-ink-400">Up to 15 MB · stored with the record</p>
          </div>
        ) : (
          <div className="rounded-xl border border-ink-200 bg-white p-2.5">
            <textarea
              className="textarea min-h-[150px] border-0 bg-transparent p-1 text-[11.5px] focus:ring-0"
              placeholder={
                "Paste the deviation report text, or the full email including From / Subject / body…"
              }
              value={pastedText}
              onChange={(event) => dispatch(copilotActions.setPastedText(event.target.value))}
            />
            <div className="mt-1.5 flex items-center justify-between border-t border-ink-100 pt-2">
              <span className="text-[9.5px] text-ink-400">{pastedText.length.toLocaleString()} characters</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => void usePastedText()}
                disabled={pastedText.trim().length < 20 || uploading}
              >
                {uploading ? <Spinner className="h-3 w-3" /> : <ClipboardType className="h-3 w-3" />}
                Use this text
              </button>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[10.5px] leading-snug text-rose-700">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="flex-1">{uploadError}</span>
            <button onClick={() => dispatch(copilotActions.setUploadError(null))} aria-label="Dismiss">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">
              Or try a sample
            </span>
            <span className="text-[9px] text-ink-400">realistic API deviation</span>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {samples.map((sample) => (
              <div
                key={sample.id}
                className="group flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-2.5 py-2 transition-colors hover:border-accent-300 hover:bg-accent-50/30"
              >
                <div
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-md border",
                    sample.kind === "pdf"
                      ? "border-rose-100 bg-rose-50 text-rose-600"
                      : sample.kind === "email"
                        ? "border-sky-100 bg-sky-50 text-sky-600"
                        : "border-amber-100 bg-amber-50 text-amber-600",
                  )}
                >
                  {SAMPLE_ICON[sample.kind]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-ink-800">{sample.name}</div>
                  <div className="truncate text-[9.5px] text-ink-400">{sample.subtitle}</div>
                </div>
                <button
                  className="btn btn-secondary btn-sm px-2 py-1 text-[10px] opacity-90"
                  onClick={() => void loadSample(sample)}
                  disabled={sampleBusy !== null}
                >
                  {sampleBusy === sample.id ? <Spinner className="h-2.5 w-2.5" /> : "Use"}
                </button>
                {sample.pdf && (
                  <a
                    href={api.sampleFileUrl(sample.id)}
                    className="btn btn-ghost btn-sm px-1 py-1 text-ink-400 hover:text-ink-700"
                    title="Download the PDF to try the upload path"
                    download
                  >
                    <Download className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 px-0.5 text-[9px] leading-snug text-ink-400">
            The sample PDF can be downloaded and dropped onto the upload area to demonstrate document parsing.
          </p>
        </div>
      </div>
    );
  }

  const meta = source.meta as { pages?: number; chars?: number; subject?: string };
  const kindLabel = source.kind === "pdf" ? "PDF document" : source.kind === "email" ? "Email" : "Text note";
  const sourceName = source.filename || (source.kind === "email" ? "Pasted email" : "Pasted text");
  const metaBits = [
    kindLabel,
    meta.pages ? pluralize(meta.pages, "page") : null,
    meta.chars ? `${meta.chars.toLocaleString()} chars` : null,
  ].filter(Boolean);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      <div className="rounded-lg border border-ink-200 bg-white">
        <div className="flex items-start gap-2 p-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-ink-200 bg-ink-50 text-ink-500">
            {source.kind === "email" ? <Mail className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11.5px] font-medium text-ink-900">{sourceName}</div>
            <div className="mt-0.5 text-[9.5px] text-ink-400">{metaBits.join(" · ")}</div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              className="btn btn-ghost btn-sm px-1 py-1 text-ink-400"
              onClick={() => setPreview((value) => !value)}
              title={preview ? "Hide text" : "Preview extracted text"}
            >
              {preview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
            <button
              className="btn btn-ghost btn-sm px-1 py-1 text-ink-400 hover:text-rose-600"
              onClick={() => dispatch(copilotActions.clearSource())}
              title="Remove source"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        {preview && (
          <div className="max-h-40 overflow-y-auto border-t border-ink-100 bg-ink-50/50 px-2.5 py-2">
            <pre className="whitespace-pre-wrap font-sans text-[9.5px] leading-relaxed text-ink-600">
              {source.text.slice(0, 1800)}
              {source.text.length > 1800 ? "\n…" : ""}
            </pre>
          </div>
        )}
      </div>

      <div className="mt-3">
        {!intakeDone ? (
          <>
            <button
              className="btn btn-ai w-full"
              onClick={() => void extract()}
              disabled={intakeRunning}
            >
              {intakeRunning ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {intakeRunning ? "Reading the document…" : "Extract & fill investigation"}
            </button>
            <p className="mt-1.5 text-center text-[9.5px] leading-snug text-ink-400">
              Reads the document, fills ~21 fields, extracts evidence and flags missing information.
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-accent-200 bg-accent-50/50 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Investigation populated
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[
                [intakeRun.stats?.fields ?? 0, "fields"],
                [intakeRun.stats?.evidence ?? 0, "evidence"],
                [intakeRun.stats?.gaps ?? 0, "gaps"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-md border border-accent-200/70 bg-white px-1.5 py-1.5 text-center">
                  <div className="text-[14px] font-semibold leading-none text-ink-900">{value}</div>
                  <div className="mt-0.5 text-[8.5px] uppercase tracking-wide text-ink-400">{label}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[9.5px] leading-snug text-ink-500">
              AI values are marked with confidence and a source quote. Edit anything that is wrong.
            </p>
          </div>
        )}

        <RunSteps
          title="Extraction run"
          stages={intakeRun.stages}
          running={intakeRunning}
          error={intakeRun.error}
          open={stepsOpen}
          onToggle={() => setStepsOpen((value) => !value)}
        />
        {intakeDone && (
          <button
            className="mt-1.5 text-[9.5px] font-medium text-ink-400 hover:text-ink-600"
            onClick={() => void extract()}
          >
            Re-extract from this source
          </button>
        )}
      </div>

      {intakeDone && (
        <div className="mt-3 border-t border-ink-100 pt-3">
          {!analysisDone ? (
            <>
              <button className="btn btn-ai w-full" onClick={() => void analyze()} disabled={analysisRunning}>
                {analysisRunning ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {analysisRunning ? "Building the causal chain…" : "Build root cause analysis"}
              </button>
              <p className="mt-1.5 text-center text-[9.5px] leading-snug text-ink-400">
                5 Whys · 6M fishbone · ranked causes · missing evidence · CAPA · QA critique
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-ai-200 bg-ai-50/40 p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ai-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  Analysis ready
                </div>
                {(payload.review?.issues?.length ?? 0) > 0 && (
                  <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-amber-700">
                    {payload.review?.issues?.length} issues
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {[
                  [analysisRun.stats?.whys ?? 0, "Whys"],
                  [analysisRun.stats?.fishbone ?? 0, "factors"],
                  [analysisRun.stats?.causes ?? 0, "causes"],
                  [analysisRun.stats?.capa ?? 0, "CAPA"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-md border border-ai-200/70 bg-white px-1 py-1.5 text-center">
                    <div className="text-[13px] font-semibold leading-none text-ink-900">{value}</div>
                    <div className="mt-0.5 text-[8px] uppercase tracking-wide text-ink-400">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                <button className="btn btn-primary btn-sm flex-1" onClick={onOpenRca}>
                  Review causes
                  <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => void analyze()}
                  disabled={analysisRunning}
                  title="Re-run the analysis"
                >
                  {analysisRunning ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                </button>
              </div>
            </div>
          )}

          <RunSteps
            title="Analysis run"
            stages={analysisRun.stages}
            running={analysisRunning}
            error={analysisRun.error}
            open={analysisStepsOpen}
            onToggle={() => setAnalysisStepsOpen((value) => !value)}
          />

          {gaps.length > 0 && (
            <button
              className="mt-2.5 flex w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-2 text-left transition hover:bg-amber-50"
              onClick={() => dispatch(requestEvidenceEmail())}
              disabled={emailLoading}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-amber-800">
                {emailLoading ? <Spinner className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                {pluralize(gaps.length, "open evidence gap")} — draft the request
              </span>
              <ArrowRight className="h-3 w-3 text-amber-600" />
            </button>
          )}
        </div>
      )}

      <p className="mt-3 px-0.5 text-[9px] leading-relaxed text-ink-400">
        Files are parsed server-side and the extracted text is stored with the investigation. Nothing is sent
        to a model unless a Groq key is configured.
      </p>
    </div>
  );
}

function AssistantTab() {
  const dispatch = useAppDispatch();
  const { messages, chatPending, emailLoading } = useAppSelector((state) => state.copilot);
  const payload = useAppSelector((state) => state.investigation.payload);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const gaps = payload.gaps.filter((gap) => gap.status === "open");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, chatPending]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || chatPending) return;
    setInput("");
    dispatch(copilotActions.addMessage({ role: "user", content: text }));
    dispatch(copilotActions.setChatPending(true));
    try {
      const history = messages
        .filter((message) => message.id !== "welcome")
        .slice(-8)
        .map((message) => ({ ...message }));
      const response = await api.chat(text, payload, history);
      dispatch(copilotActions.addMessage({ role: "assistant", content: response.answer }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The copilot is unavailable.";
      dispatch(
        copilotActions.addMessage({
          role: "assistant",
          content: `I could not answer that just now. ${message}`,
        }),
      );
      dispatch(uiActions.pushToast({ kind: "error", title: "Copilot unavailable", message }));
    } finally {
      dispatch(copilotActions.setChatPending(false));
    }
  }

  const suggestions = [
    { label: "What evidence is missing?", send: "What evidence is still missing, and why does it matter?" },
    {
      label: "Challenge the leading cause",
      send: "Challenge the leading root cause. What alternative explanation fits the evidence?",
    },
    { label: "Explain the CAPA logic", send: "Explain how each proposed CAPA action addresses the root cause." },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.map((message) =>
          message.role === "assistant" ? (
            <div key={message.id} className="flex gap-2">
              <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ai-100 text-ai-700">
                <Sparkles className="h-3 w-3" />
              </div>
              <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-ink-200 bg-white px-2.5 py-2 shadow-sm">
                <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-ink-700">
                  {message.content}
                </div>
              </div>
            </div>
          ) : (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[86%] rounded-xl rounded-tr-sm bg-ink-900 px-2.5 py-2 text-[11px] leading-relaxed text-white">
                {message.content}
              </div>
            </div>
          ),
        )}
        {chatPending && (
          <div className="flex gap-2">
            <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ai-100 text-ai-700">
              <Sparkles className="h-3 w-3" />
            </div>
            <div className="flex items-center gap-1 rounded-xl rounded-tl-sm border border-ink-200 bg-white px-3 py-2.5">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="h-1 w-1 animate-pulse-dot rounded-full bg-ink-400"
                  style={{ animationDelay: `${dot * 160}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-ink-100 px-3 pb-2 pt-2">
        <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              onClick={() => void send(suggestion.send)}
              className="shrink-0 rounded-full border border-ink-200 bg-white px-2 py-1 text-[9.5px] font-medium text-ink-600 transition hover:border-ai-300 hover:bg-ai-50 hover:text-ai-700"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-1.5">
          <textarea
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            placeholder="Ask about the evidence, cause or CAPA…"
            className="input max-h-24 min-h-[34px] resize-none py-2 text-[11.5px]"
          />
          <button
            className="btn btn-primary h-[34px] w-[34px] shrink-0 p-0"
            onClick={() => void send(input)}
            disabled={!input.trim() || chatPending}
            aria-label="Send question"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          {gaps.length > 0 ? (
            <button
              className="flex items-center gap-1 text-[9px] font-medium text-amber-700 hover:text-amber-800"
              onClick={() => dispatch(requestEvidenceEmail())}
              disabled={emailLoading}
            >
              {emailLoading ? <Spinner className="h-2.5 w-2.5" /> : <Mail className="h-2.5 w-2.5" />}
              Draft the evidence request email
            </button>
          ) : (
            <span className="text-[9px] text-ink-400">Context: current investigation record</span>
          )}
          <span className="text-[8.5px] uppercase tracking-wide text-ink-300">Enter to send</span>
        </div>
      </div>
    </div>
  );
}

export default function CopilotPanel({ onClose, onOpenRca }: { onClose: () => void; onOpenRca: () => void }) {
  const dispatch = useAppDispatch();
  const { tab, provider, analysisRun, intakeRun } = useAppSelector((state) => state.copilot);
  const busy = analysisRun.status === "running" || intakeRun.status === "running";

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="relative border-b border-ink-200 bg-gradient-to-r from-ai-50 via-white to-white px-3 py-2.5">
        {busy && (
          <div className="absolute inset-x-0 top-0 h-0.5 animate-shimmer bg-gradient-to-r from-ai-300 via-ai-600 to-ai-300 bg-[length:200%_100%]" />
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-ai-600 text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[12px] font-semibold leading-tight text-ink-900">RCA Copilot</div>
              <div className="mt-0.5 flex items-center gap-1 text-[9px] text-ink-400">
                <span className={cn("h-1.5 w-1.5 rounded-full", provider?.live ? "bg-accent-500" : "bg-amber-400")} />
                {provider?.live ? provider.model : "Demo engine"}
                <span className="text-ink-300">· LangGraph</span>
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm px-1.5" onClick={onClose} aria-label="Close copilot">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex border-b border-ink-200 px-3">
        {[
          { id: "source" as const, label: "Source document", icon: <FileText className="h-3 w-3" /> },
          { id: "assistant" as const, label: "Ask copilot", icon: <MessageSquare className="h-3 w-3" /> },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => dispatch(copilotActions.setTab(item.id))}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors",
              tab === item.id ? "text-ai-700" : "text-ink-400 hover:text-ink-700",
            )}
          >
            {item.icon}
            {item.label}
            {tab === item.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ai-600" />}
          </button>
        ))}
      </div>

      {tab === "source" ? <SourceTab onOpenRca={onOpenRca} /> : <AssistantTab />}

      <div className="flex items-center gap-1.5 border-t border-ink-200 bg-ink-50/60 px-3 py-2 text-[9px] leading-snug text-ink-400">
        <ShieldCheck className="h-3 w-3 shrink-0 text-accent-600" />
        AI output is advisory. A qualified reviewer confirms every cause and action.
      </div>
    </div>
  );
}
