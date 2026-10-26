import {
  BadgeCheck,
  Circle,
  CircleAlert,
  FileCheck2,
  Lock,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAppSelector } from "../../store/hooks";
import { formatDate, pluralize } from "../../lib/format";
import { CURRENT_USER } from "../../lib/payload";
import { Section } from "./Section";

function ReadinessItem({
  state,
  title,
  detail,
}: {
  state: "ok" | "warn" | "pending";
  title: string;
  detail: string;
}) {
  const icon =
    state === "ok" ? (
      <BadgeCheck className="h-4 w-4 text-accent-600" />
    ) : state === "warn" ? (
      <CircleAlert className="h-4 w-4 text-amber-500" />
    ) : (
      <Circle className="h-4 w-4 text-ink-300" />
    );
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-ink-200 bg-white px-3 py-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11.5px] font-medium text-ink-800">{title}</div>
        <div className="mt-0.5 text-[10.5px] leading-snug text-ink-500">{detail}</div>
      </div>
    </div>
  );
}

export default function SignoffSection({
  onSignoff,
}: {
  onSignoff: () => void;
}) {
  const { id, status, payload, provenance, aiMeta } = useAppSelector((state) => state.investigation);
  const signed = Boolean(payload.signoff?.signature) || status === "approved";
  const signoff = payload.signoff;
  const rcAccepted = payload.root_causes.filter((cause) => cause.status === "accepted");
  const capaAccepted = payload.capa.filter((item) => item.status === "accepted");
  const verified = payload.evidence.filter((item) => item.verified).length;
  const unverifiedHigh = payload.evidence.filter((item) => item.relevance === "High" && !item.verified).length;
  const openGaps = payload.gaps.filter((gap) => gap.status === "open").length;
  const aiValues = Object.values(provenance).filter((entry) => entry.source === "ai").length;
  const canSign = rcAccepted.length > 0 && capaAccepted.length > 0 && !signed;

  const disabledReason =
    rcAccepted.length === 0
      ? "Confirm at least one root cause."
      : capaAccepted.length === 0
        ? "Approve at least one CAPA action."
        : null;

  return (
    <Section
      id="signoff"
      index="6"
      title="Review & electronic sign-off"
      description="A qualified reviewer confirms the AI-assisted content before the electronic signature is applied."
      actions={
        signed ? (
          <span className="badge border-accent-200 bg-accent-50 text-accent-700">
            <Lock className="h-2.5 w-2.5" /> Signed
          </span>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={onSignoff} disabled={!canSign} title={disabledReason ?? undefined}>
            <PenLine className="h-3 w-3" />
            Sign off
          </button>
        )
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-2">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-400">
            <FileCheck2 className="h-3 w-3" />
            Reviewer readiness
          </div>
          <ReadinessItem
            state={id ? "ok" : "warn"}
            title="Record saved"
            detail={id ? `${payload.code || "RCA"} is persisted with version control and an audit event.` : "Not saved yet — saving is part of the sign-off step."}
          />
          <ReadinessItem
            state={rcAccepted.length > 0 ? "ok" : "pending"}
            title="Root cause confirmed"
            detail={
              rcAccepted.length > 0
                ? `${pluralize(rcAccepted.length, "cause")} confirmed by a reviewer: ${rcAccepted
                    .map((cause) => cause.id)
                    .join(", ")}.`
                : "The copilot's causes remain hypotheses until confirmed."
            }
          />
          <ReadinessItem
            state={capaAccepted.length > 0 ? "ok" : "pending"}
            title="CAPA approved"
            detail={
              capaAccepted.length > 0
                ? `${pluralize(capaAccepted.length, "action")} approved with owners and effectiveness checks.`
                : "Approve the corrective and preventive actions."
            }
          />
          <ReadinessItem
            state={verified === payload.evidence.length && payload.evidence.length > 0 ? "ok" : "warn"}
            title="Evidence reviewed"
            detail={
              payload.evidence.length === 0
                ? "No evidence linked to the record."
                : verified === payload.evidence.length
                  ? `All ${pluralize(payload.evidence.length, "evidence item")} marked verified.`
                  : unverifiedHigh > 0
                    ? `${verified} of ${payload.evidence.length} verified. ${pluralize(unverifiedHigh, "high-relevance item")} still to check against the source.`
                    : `${verified} of ${payload.evidence.length} verified. All high-relevance items checked; the rest are medium or low relevance.`
            }
          />
          <ReadinessItem
            state={openGaps === 0 ? "ok" : "warn"}
            title="Open evidence gaps"
            detail={
              openGaps === 0
                ? "No open gaps. All requested information is resolved."
                : `${pluralize(openGaps, "gap")} still open. Sign-off is possible, but the gap and its justification should be documented.`
            }
          />
          {aiValues > 0 && (
            <p className="px-1 pt-0.5 text-[10.5px] leading-snug text-ink-400">
              <Sparkles className="mr-1 inline h-3 w-3 text-ai-500" />
              {aiValues} fields still carry an AI provenance marker
              {aiMeta.provider ? ` (${aiMeta.provider})` : ""}. Editing a field changes its marker to “Edited”.
            </p>
          )}
        </div>

        {signed && signoff ? (
          <div className="overflow-hidden rounded-xl border border-accent-200 bg-gradient-to-br from-accent-50 to-white">
            <div className="flex items-center justify-between border-b border-accent-200/70 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-accent-600 text-white">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11.5px] font-semibold text-accent-900">Electronic signature</div>
                  <div className="text-[9.5px] uppercase tracking-wide text-accent-700/80">
                    Applied to this record
                  </div>
                </div>
              </div>
              <span className="font-mono text-[10px] font-semibold text-accent-800">{signoff.signature}</span>
            </div>
            <div className="space-y-2.5 px-4 py-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[9.5px] uppercase tracking-wide text-ink-400">Signed by</div>
                  <div className="text-[12px] font-medium text-ink-900">{signoff.name}</div>
                  <div className="text-[10.5px] text-ink-500">{signoff.role}</div>
                </div>
                <div>
                  <div className="text-[9.5px] uppercase tracking-wide text-ink-400">Signed on</div>
                  <div className="text-[12px] font-medium text-ink-900">{formatDate(signoff.signed_at)}</div>
                  <div className="text-[10.5px] text-ink-500">Approved record</div>
                </div>
              </div>
              <div>
                <div className="text-[9.5px] uppercase tracking-wide text-ink-400">Meaning of signature</div>
                <div className="text-[11px] leading-snug text-ink-700">{signoff.meaning}</div>
              </div>
              {signoff.statement && (
                <blockquote className="rounded-md border border-accent-200/70 bg-white/80 px-2.5 py-2 text-[10.5px] italic leading-snug text-ink-600">
                  “{signoff.statement}”
                </blockquote>
              )}
              {signoff.confirmations && signoff.confirmations.length > 0 && (
                <div>
                  <div className="text-[9.5px] uppercase tracking-wide text-ink-400">Attestations</div>
                  <ul className="mt-1 space-y-1">
                    {signoff.confirmations.map((item) => (
                      <li key={item} className="flex items-start gap-1.5 text-[10.5px] leading-snug text-ink-600">
                        <BadgeCheck className="mt-0.5 h-3 w-3 shrink-0 text-accent-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-start gap-1.5 border-t border-accent-200/70 bg-white/70 px-4 py-2 text-[10px] leading-snug text-ink-500">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" />
              Signature applied. Any saved amendment invalidates it, returns the record to review and
              increments the version.
            </div>
          </div>
        ) : (
          <div className="flex flex-col rounded-xl border border-ink-200 bg-white">
            <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-ink-900 text-[10px] font-semibold text-white">
                {CURRENT_USER.initials}
              </div>
              <div>
                <div className="text-[11.5px] font-semibold text-ink-900">Signing as {CURRENT_USER.name}</div>
                <div className="text-[10px] text-ink-500">{CURRENT_USER.role}</div>
              </div>
            </div>
            <div className="flex flex-1 flex-col px-4 py-3.5">
              <p className="text-[11.5px] leading-relaxed text-ink-600">
                The electronic signature certifies that you reviewed the extracted evidence, the confirmed
                root cause and the CAPA. You will countersign three attestations in the next step.
              </p>
              <div className="mt-3 space-y-1.5 rounded-lg bg-ink-50 p-2.5 text-[10.5px] text-ink-500">
                <div className="flex items-center gap-1.5">
                  <BadgeCheck className="h-3 w-3 text-accent-600" />
                  21 CFR Part 11 style identity and meaning capture
                </div>
                <div className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-ink-400" />
                  Amendments require a new review and signature
                </div>
              </div>
              <button className="btn btn-primary mt-4 w-full" onClick={onSignoff} disabled={!canSign} title={disabledReason ?? undefined}>
                <PenLine className="h-3.5 w-3.5" />
                Review & sign off
              </button>
              {disabledReason && (
                <p className="mt-2 text-center text-[10.5px] text-amber-600">{disabledReason}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
