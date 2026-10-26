export type Status = "draft" | "in_review" | "approved" | "closed";
export type Classification = "Critical" | "Major" | "Minor";
export type Priority = "High" | "Medium" | "Low";
export type FishboneCategory =
  | "Man"
  | "Machine"
  | "Material"
  | "Method"
  | "Measurement"
  | "Environment";
export type Decision = "suggested" | "accepted" | "rejected";

export interface EvidenceItem {
  id: string;
  label: string;
  kind: string;
  source_ref: string;
  quote: string;
  relevance: "High" | "Medium" | "Low";
  verified?: boolean;
  origin?: "ai" | "human";
}

export interface WhyStep {
  level: number;
  question: string;
  answer: string;
  evidence: string[];
  confidence: number;
  verified?: boolean;
  origin?: "ai" | "human";
}

export interface FishboneFactor {
  id: string;
  category: FishboneCategory;
  factor: string;
  rationale: string;
  evidence: string[];
  status: "suggested" | "confirmed" | "dismissed";
  origin?: "ai" | "human";
}

export interface RootCause {
  id: string;
  statement: string;
  category: string;
  confidence: number;
  rationale: string;
  evidence: string[];
  falsification: string;
  ruled_out: boolean;
  status: Decision;
  origin?: "ai" | "human";
  confirmed_by?: string;
  confirmed_at?: string;
  confirmed_note?: string;
}

export interface Gap {
  id: string;
  item: string;
  why_needed: string;
  request_from: string;
  priority: Priority;
  status: "open" | "requested" | "resolved";
  origin?: "ai" | "human";
}

export interface CapaAction {
  id: string;
  type: "Corrective" | "Preventive";
  action: string;
  explanation: string;
  owner: string;
  due_in_days?: number;
  due_date: string;
  priority: Priority;
  root_cause_ref: string;
  effectiveness_check: string;
  status: Decision;
  origin?: "ai" | "human";
}

export interface TeamMember {
  name: string;
  role: string;
}

export interface Signoff {
  name: string;
  role: string;
  meaning: string;
  statement?: string;
  confirmations?: string[];
  signature: string;
  signed_at: string;
}

export interface ReviewIssue {
  severity: Priority;
  issue: string;
  recommendation: string;
}

export interface Review {
  verdict?: "pass" | "needs_review";
  issues?: ReviewIssue[];
  notes?: string;
}

export interface Payload {
  code: string;
  status: Status;
  title: string;
  description: string;
  deviation_type: "Unplanned" | "Planned" | string;
  classification: Classification | string;
  date_occurred: string;
  date_detected: string;
  reported_by: string;
  site_area: string;
  department: string;
  product_name: string;
  product_code: string;
  batch_number: string;
  batch_size: string;
  process_stage: string;
  equipment: string;
  immediate_action: string;
  impact_assessment: string;
  investigation_scope: string;
  rca_method: string;
  source_summary: string;
  summary: string;
  conclusion: string;
  source_kind?: string;
  team: TeamMember[];
  evidence: EvidenceItem[];
  five_whys: WhyStep[];
  fishbone: FishboneFactor[];
  root_causes: RootCause[];
  gaps: Gap[];
  capa: CapaAction[];
  review?: Review;
  signoff?: Signoff;
}

export interface ProvenanceEntry {
  source: "ai" | "human";
  confidence: number;
  quote?: string;
  ref?: string;
  at?: string;
}

export type Provenance = Record<string, ProvenanceEntry>;

export interface AiMeta {
  provider?: string;
  model?: string;
  live?: boolean;
  document_type?: string;
  generated_at?: string;
  source_kind?: string;
  [key: string]: unknown;
}

export interface InvestigationListItem {
  id: string;
  code: string;
  title: string;
  status: Status;
  product_name: string | null;
  batch_number: string | null;
  classification: Classification | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  version: number;
  source_kind: string | null;
  counts: { evidence: number; root_causes: number; capa: number; open_gaps: number };
  leading_cause: { statement: string; confidence: number; status: string };
  signoff: Signoff | Record<string, never>;
}

export interface InvestigationDetail extends InvestigationListItem {
  payload: Payload;
  provenance: Provenance;
  ai_meta: AiMeta;
}

export interface InvestigationStats {
  total: number;
  open: number;
  approved: number;
  open_gaps: number;
  ai_runs: number;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  detail: Record<string, unknown>;
  at: string;
}

export interface ProviderInfo {
  provider: string;
  model: string;
  live: boolean;
  mode?: string;
  fallback_reason?: string | null;
}

export interface Options {
  classifications: string[];
  deviation_types: string[];
  statuses: string[];
  capa_types: string[];
  priorities: string[];
  fishbone_categories: FishboneCategory[];
  rca_methods: string[];
  current_user: { name: string; role: string; initials: string };
  ai: ProviderInfo;
}

export interface SampleDoc {
  id: string;
  name: string;
  subtitle: string;
  kind: "pdf" | "email" | "text";
  file: string;
  pdf?: string;
  eml?: string;
  description: string;
  text: string;
  available: boolean;
}

export interface SourceDoc {
  id: string;
  kind: "pdf" | "email" | "text" | string;
  filename: string | null;
  text: string;
  meta: Record<string, unknown>;
  created_at?: string;
}

export interface StageEvent {
  stage: string;
  label: string;
  status: "running" | "done" | "error";
  detail?: string;
}

export interface RunState {
  status: "idle" | "running" | "done" | "error";
  stages: StageEvent[];
  error?: string;
  stats?: Record<string, number>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export type InputMode = "upload" | "paste" | "email";

export type SectionId =
  | "incident"
  | "product"
  | "evidence"
  | "rca"
  | "capa"
  | "signoff"
  | "audit";
