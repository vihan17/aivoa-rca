import { Sparkles } from "lucide-react";
import type { ChangeEvent } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { investigationActions } from "../../store/investigationSlice";
import { Field } from "../ui";
import { Section } from "./Section";

export default function IncidentSection() {
  const dispatch = useAppDispatch();
  const payload = useAppSelector((state) => state.investigation.payload);
  const set = (field: Parameters<typeof investigationActions.setField>[0]["field"]) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => dispatch(investigationActions.setField({ field, value: event.target.value }));

  return (
    <Section
      id="incident"
      index="1"
      title="Incident identification"
      description="What happened, when it was detected and how the deviation is classified."
      actions={
        payload.code ? (
          <span className="font-mono text-[10.5px] text-ink-400">{payload.code}</span>
        ) : (
          <span className="rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-[10px] font-medium text-ink-500">
            Unsaved
          </span>
        )
      }
    >
      <div className="space-y-4">
        {payload.source_summary && (
          <div className="flex gap-2.5 rounded-lg border border-ai-100 bg-ai-50/50 p-3">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai-600" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-ai-700">
                Copilot summary of the source
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-700">{payload.source_summary}</p>
            </div>
          </div>
        )}

        <Field label="Deviation title" field="title">
          <input
            className="input"
            spellCheck={false}
            value={payload.title ?? ""}
            onChange={set("title")}
            placeholder="e.g. OOS impurity in Atorvastatin Calcium batch AT-24118"
          />
        </Field>

        <Field
          label="Description"
          field="description"
          hint="Facts, measured values and limits. The copilot quotes this when it builds the causal chain."
        >
          <textarea
            className="textarea min-h-[104px]"
            value={payload.description ?? ""}
            onChange={set("description")}
            placeholder="Describe the deviation, including batch, equipment, measured result and specification."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Deviation type" field="deviation_type">
            <select className="select" value={payload.deviation_type ?? "Unplanned"} onChange={set("deviation_type")}>
              <option value="Unplanned">Unplanned</option>
              <option value="Planned">Planned</option>
            </select>
          </Field>
          <Field
            label="Classification"
            field="classification"
            hint="Critical: patient/regulatory impact. Major: product quality impact. Minor: no product impact."
          >
            <select className="select" value={payload.classification ?? "Major"} onChange={set("classification")}>
              <option value="Critical">Critical</option>
              <option value="Major">Major</option>
              <option value="Minor">Minor</option>
            </select>
          </Field>
          <Field label="Department" field="department">
            <input className="input" value={payload.department ?? ""} onChange={set("department")} />
          </Field>
          <Field label="Date of occurrence" field="date_occurred">
            <input type="date" className="input" value={payload.date_occurred ?? ""} onChange={set("date_occurred")} />
          </Field>
          <Field label="Date detected" field="date_detected">
            <input type="date" className="input" value={payload.date_detected ?? ""} onChange={set("date_detected")} />
          </Field>
          <Field label="Reported by" field="reported_by">
            <input className="input" value={payload.reported_by ?? ""} onChange={set("reported_by")} />
          </Field>
          <Field label="Site / area" field="site_area" className="sm:col-span-2 lg:col-span-3">
            <input className="input" value={payload.site_area ?? ""} onChange={set("site_area")} />
          </Field>
        </div>
      </div>
    </Section>
  );
}
