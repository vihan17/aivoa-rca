import { ShieldAlert } from "lucide-react";
import type { ChangeEvent } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { investigationActions } from "../../store/investigationSlice";
import { Field } from "../ui";
import { Section } from "./Section";

export default function ProductSection() {
  const dispatch = useAppDispatch();
  const payload = useAppSelector((state) => state.investigation.payload);
  const set = (field: Parameters<typeof investigationActions.setField>[0]["field"]) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => dispatch(investigationActions.setField({ field, value: event.target.value }));

  return (
    <Section
      id="product"
      index="2"
      title="Product, batch & impact"
      description="Material context, containment already taken and the scope of the investigation."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Product" field="product_name" className="lg:col-span-2">
            <input
              className="input"
              value={payload.product_name ?? ""}
              onChange={set("product_name")}
              placeholder="API name and grade"
            />
          </Field>
          <Field label="Material code" field="product_code">
            <input className="input" value={payload.product_code ?? ""} onChange={set("product_code")} />
          </Field>
          <Field label="Batch / lot number" field="batch_number">
            <input className="input font-mono text-[12.5px]" value={payload.batch_number ?? ""} onChange={set("batch_number")} />
          </Field>
          <Field label="Batch size" field="batch_size">
            <input className="input" value={payload.batch_size ?? ""} onChange={set("batch_size")} />
          </Field>
          <Field label="Process stage" field="process_stage">
            <input className="input" value={payload.process_stage ?? ""} onChange={set("process_stage")} />
          </Field>
          <Field label="Equipment / asset" field="equipment" className="sm:col-span-2">
            <input className="input" value={payload.equipment ?? ""} onChange={set("equipment")} />
          </Field>
        </div>

        <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            <ShieldAlert className="h-3 w-3" />
            Containment
          </div>
          <Field label="Immediate action taken" field="immediate_action" className="mt-2">
            <textarea
              className="textarea min-h-[68px] border-amber-200/70 bg-white/80"
              value={payload.immediate_action ?? ""}
              onChange={set("immediate_action")}
              placeholder="Quarantine, hold, line stop, retain samples"
            />
          </Field>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Impact assessment"
            field="impact_assessment"
            hint="Product quality, patient exposure, other batches and regulatory reportability."
          >
            <textarea
              className="textarea min-h-[92px]"
              value={payload.impact_assessment ?? ""}
              onChange={set("impact_assessment")}
            />
          </Field>
          <Field
            label="Investigation scope"
            field="investigation_scope"
            hint="State explicitly whether other batches, products or instruments are in scope."
          >
            <textarea
              className="textarea min-h-[92px]"
              value={payload.investigation_scope ?? ""}
              onChange={set("investigation_scope")}
            />
          </Field>
        </div>
      </div>
    </Section>
  );
}
