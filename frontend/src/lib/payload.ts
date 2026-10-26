import type { Payload } from "./types";

export const blankPayload = (): Payload => ({
  code: "",
  status: "draft",
  title: "",
  description: "",
  deviation_type: "Unplanned",
  classification: "Major",
  date_occurred: "",
  date_detected: "",
  reported_by: "",
  site_area: "",
  department: "",
  product_name: "",
  product_code: "",
  batch_number: "",
  batch_size: "",
  process_stage: "",
  equipment: "",
  immediate_action: "",
  impact_assessment: "",
  investigation_scope: "",
  rca_method: "5 Whys + Fishbone (6M)",
  source_summary: "",
  summary: "",
  conclusion: "",
  source_kind: "",
  team: [],
  evidence: [],
  five_whys: [],
  fishbone: [],
  root_causes: [],
  gaps: [],
  capa: [],
  review: {},
});

export const CURRENT_USER = {
  name: "Dr. Meera Krishnan",
  role: "QA Head, Unit 2",
  initials: "MK",
};

export const FISHBONE_META: Record<
  string,
  { label: string; hint: string; tone: string }
> = {
  Man: { label: "Man", hint: "People, training, behaviour", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  Machine: {
    label: "Machine",
    hint: "Equipment, sensors, utilities",
    tone: "bg-violet-50 text-violet-700 border-violet-200",
  },
  Material: {
    label: "Material",
    hint: "Inputs, excipients, solvents",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  Method: {
    label: "Method",
    hint: "Procedures, controls, validation",
    tone: "bg-amber-50 text-amber-700 border-amber-200",
  },
  Measurement: {
    label: "Measurement",
    hint: "Calibration, analytics, data",
    tone: "bg-rose-50 text-rose-700 border-rose-200",
  },
  Environment: {
    label: "Environment",
    hint: "Facility, humidity, contamination",
    tone: "bg-teal-50 text-teal-700 border-teal-200",
  },
};
