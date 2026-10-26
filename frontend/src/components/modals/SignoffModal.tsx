import { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, FileSignature, Lock, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api";
import { CURRENT_USER } from "../../lib/payload";
import { cn } from "../../lib/format";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { investigationActions } from "../../store/investigationSlice";
import { uiActions } from "../../store/uiSlice";
import { Modal, Spinner } from "../ui";

const ATTESTATIONS = [
  {
    title: "Evidence reviewed",
    detail:
      "I reviewed the extracted evidence against the source document, corrected anything inaccurate and marked what I verified.",
  },
  {
    title: "Root cause supported",
    detail:
      "I confirm the selected root cause is supported by the evidence and is appropriately scoped for this deviation.",
  },
  {
    title: "CAPA adequate",
    detail:
      "I approve the CAPA actions, owners, due dates and effectiveness checks as recorded in this investigation.",
  },
];

export default function SignoffModal({
  open,
  onClose,
  onSigned,
}: {
  open: boolean;
  onClose: () => void;
  onSigned?: () => void;
}) {
  const dispatch = useAppDispatch();
  const { id, payload } = useAppSelector((state) => state.investigation);
  const [checked, setChecked] = useState<boolean[]>([false, false, false]);
  const [statement, setStatement] = useState("");
  const [meaning, setMeaning] = useState("Reviewed and approved the investigation and CAPA");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChecked([false, false, false]);
    setStatement("");
    setError(null);
    setSubmitting(false);
    setMeaning("Reviewed and approved the investigation and CAPA");
  }, [open]);

  const acceptedCauses = payload.root_causes.filter((cause) => cause.status === "accepted");
  const acceptedCapa = payload.capa.filter((item) => item.status === "accepted");
  const openGaps = payload.gaps.filter((gap) => gap.status === "open");
  const allChecked = checked.every(Boolean);

  async function submit() {
    if (!id || !allChecked) return;
    setSubmitting(true);
    setError(null);
    try {
      const detail = await api.signoff(id, {
        name: CURRENT_USER.name,
        role: CURRENT_USER.role,
        meaning,
        statement: statement.trim(),
        confirmations: ATTESTATIONS.map((item) => item.title),
      });
      dispatch(investigationActions.setSignoff(detail));
      dispatch(
        uiActions.pushToast({
          kind: "success",
          title: "Investigation signed and approved",
          message: `${detail.code} · ${detail.payload.signoff?.signature ?? ""}`,
        }),
      );
      onSigned?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The sign-off could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Electronic sign-off"
      subtitle="Confirm the review attestations and apply your electronic signature."
      width="max-w-xl"
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wide text-ink-400">Record</div>
            <div className="mt-0.5 font-mono text-[11px] font-semibold text-ink-800">{payload.code || "—"}</div>
          </div>
          <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wide text-ink-400">Confirmed causes</div>
            <div className="mt-0.5 text-[11px] font-semibold text-ink-800">
              {acceptedCauses.map((cause) => cause.id).join(", ") || "None"}
            </div>
          </div>
          <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wide text-ink-400">Approved CAPA</div>
            <div className="mt-0.5 text-[11px] font-semibold text-ink-800">
              {acceptedCapa.length} action{acceptedCapa.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {openGaps.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10.5px] leading-snug text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {openGaps.length} evidence gap{openGaps.length === 1 ? " is" : "s are"} still open. Signing confirms
              you accept the residual uncertainty — record the justification in the statement below.
            </span>
          </div>
        )}

        <div className="space-y-2">
          {ATTESTATIONS.map((item, index) => (
            <label
              key={item.title}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                checked[index] ? "border-accent-300 bg-accent-50/40" : "border-ink-200 bg-white hover:bg-ink-50/50",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 rounded border-ink-300 text-accent-700 focus:ring-accent-500"
                checked={checked[index]}
                onChange={(event) =>
                  setChecked((prev) => prev.map((value, i) => (i === index ? event.target.checked : value)))
                }
              />
              <span className="min-w-0">
                <span className="block text-[11.5px] font-semibold text-ink-900">{item.title}</span>
                <span className="mt-0.5 block text-[10.5px] leading-snug text-ink-500">{item.detail}</span>
              </span>
            </label>
          ))}
        </div>

        <div>
          <label className="label" htmlFor="signoff-meaning">
            Meaning of signature
          </label>
          <input
            id="signoff-meaning"
            className="input text-[12px]"
            value={meaning}
            onChange={(event) => setMeaning(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="signoff-statement">
            Reviewer statement <span className="font-normal normal-case text-ink-400">optional</span>
          </label>
          <textarea
            id="signoff-statement"
            className="textarea min-h-[62px] text-[12px]"
            placeholder="Any residual risk, condition of approval or justification for an open gap…"
            value={statement}
            onChange={(event) => setStatement(event.target.value)}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[10.5px] text-rose-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2.5">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600" />
          <p className="text-[10px] leading-snug text-ink-500">
            Signing as <span className="font-medium text-ink-800">{CURRENT_USER.name}</span> ({CURRENT_USER.role}).
            Your identity, the meaning of the signature, the attestations and a UTC timestamp are written to the
            audit trail. The signature is recorded against the approved version; saving a later amendment invalidates it and returns the record to review.
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-ink-100 pt-3">
          <div className="flex items-center gap-1.5 text-[9.5px] text-ink-400">
            <Lock className="h-3 w-3" />
            Part 11 style e-signature
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void submit()}
              disabled={!allChecked || submitting}
              title={!allChecked ? "Confirm all three attestations first" : undefined}
            >
              {submitting ? <Spinner className="h-3 w-3" /> : <FileSignature className="h-3 w-3" />}
              Sign & approve
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[9px] uppercase tracking-wide text-ink-300">
          <BadgeCheck className="h-3 w-3" />
          Signature recorded as ESIG-{payload.code || "RCA"}-XXXXXX
        </div>
      </div>
    </Modal>
  );
}
