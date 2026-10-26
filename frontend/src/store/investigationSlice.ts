import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  AiMeta,
  AuditEvent,
  CapaAction,
  EvidenceItem,
  Gap,
  InvestigationDetail,
  Payload,
  Provenance,
  Review,
  RootCause,
  Status,
  WhyStep,
} from "../lib/types";
import { blankPayload, CURRENT_USER } from "../lib/payload";

export type EditableField = Exclude<
  keyof Payload,
  | "code"
  | "status"
  | "team"
  | "evidence"
  | "five_whys"
  | "fishbone"
  | "root_causes"
  | "gaps"
  | "capa"
  | "review"
  | "signoff"
  | "source_kind"
>;

export interface InvestigationState {
  id: string | null;
  code: string;
  status: Status;
  payload: Payload;
  provenance: Provenance;
  aiMeta: AiMeta;
  audit: AuditEvent[];
  sourceId: string | null;
  dirty: boolean;
  saving: boolean;
  loading: boolean;
  savedAt: string | null;
  error: string | null;
  analysisStale: boolean;
  startedAt: string;
}

const now = () => new Date().toISOString();

export const initialInvestigationState = (): InvestigationState => ({
  id: null,
  code: "",
  status: "draft",
  payload: blankPayload(),
  provenance: {},
  aiMeta: {},
  audit: [],
  sourceId: null,
  dirty: false,
  saving: false,
  loading: false,
  savedAt: null,
  error: null,
  analysisStale: false,
  startedAt: now(),
});

const markHuman = (state: InvestigationState, key: string) => {
  state.provenance[key] = { source: "human", confidence: 1, at: now() };
  state.dirty = true;
};

const touch = (state: InvestigationState) => {
  state.dirty = true;
};

function nextId(prefix: string, items: { id: string }[]): string {
  const used = new Set(items.map((item) => item.id));
  let index = items.length + 1;
  while (used.has(`${prefix}-${String(index).padStart(2, "0")}`)) index += 1;
  return `${prefix}-${String(index).padStart(2, "0")}`;
}

const slice = createSlice({
  name: "investigation",
  initialState: initialInvestigationState(),
  reducers: {
    reset() {
      return initialInvestigationState();
    },
    loadStart(state) {
      state.loading = true;
      state.error = null;
    },
    loadSuccess(state, action: PayloadAction<InvestigationDetail>) {
      const detail = action.payload;
      state.id = detail.id;
      state.code = detail.code;
      state.status = detail.status;
      state.payload = { ...blankPayload(), ...detail.payload, status: detail.status };
      state.provenance = detail.provenance ?? {};
      state.aiMeta = detail.ai_meta ?? {};
      state.dirty = false;
      state.loading = false;
      state.savedAt = detail.updated_at;
      state.analysisStale = false;
    },
    loadError(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    setField(state, action: PayloadAction<{ field: EditableField; value: string }>) {
      const { field, value } = action.payload;
      if ((state.payload as unknown as Record<string, string>)[field] === value) return;
      (state.payload as unknown as Record<string, string>)[field] = value;
      markHuman(state, field);
    },
    setTeam(state, action: PayloadAction<Payload["team"]>) {
      state.payload.team = action.payload;
      markHuman(state, "team");
    },
    setStatus(state, action: PayloadAction<Status>) {
      state.status = action.payload;
      state.payload.status = action.payload;
      touch(state);
    },

    // ---- evidence -----------------------------------------------------------
    toggleEvidenceVerified(state, action: PayloadAction<{ id: string; value: boolean }>) {
      const item = state.payload.evidence.find((ev) => ev.id === action.payload.id);
      if (!item) return;
      item.verified = action.payload.value;
      markHuman(state, "evidence");
    },
    verifyHighRelevance(state) {
      let changed = false;
      state.payload.evidence.forEach((ev) => {
        if (ev.relevance === "High" && !ev.verified) {
          ev.verified = true;
          changed = true;
        }
      });
      if (changed) markHuman(state, "evidence");
    },
    updateEvidence(state, action: PayloadAction<{ id: string; patch: Partial<EvidenceItem> }>) {
      const index = state.payload.evidence.findIndex((ev) => ev.id === action.payload.id);
      if (index === -1) return;
      state.payload.evidence[index] = { ...state.payload.evidence[index], ...action.payload.patch };
      markHuman(state, "evidence");
    },
    addEvidence(state) {
      state.payload.evidence.push({
        id: nextId("EV", state.payload.evidence),
        label: "New evidence",
        kind: "Other",
        source_ref: "",
        quote: "",
        relevance: "Medium",
        verified: false,
        origin: "human",
      });
      markHuman(state, "evidence");
    },
    removeEvidence(state, action: PayloadAction<string>) {
      state.payload.evidence = state.payload.evidence.filter((ev) => ev.id !== action.payload);
      markHuman(state, "evidence");
    },

    // ---- 5 Whys -------------------------------------------------------------
    setWhy(state, action: PayloadAction<{ index: number; patch: Partial<WhyStep> }>) {
      const why = state.payload.five_whys[action.payload.index];
      if (!why) return;
      Object.assign(why, action.payload.patch, { origin: "human" });
      markHuman(state, "five_whys");
    },
    toggleWhyVerified(state, action: PayloadAction<number>) {
      const why = state.payload.five_whys[action.payload];
      if (!why) return;
      why.verified = !why.verified;
      markHuman(state, "five_whys");
    },
    addWhy(state) {
      const level = state.payload.five_whys.length + 1;
      state.payload.five_whys.push({
        level,
        question: "Why did this occur?",
        answer: "",
        evidence: [],
        confidence: 0.5,
        verified: false,
        origin: "human",
      });
      markHuman(state, "five_whys");
    },
    removeWhy(state, action: PayloadAction<number>) {
      state.payload.five_whys.splice(action.payload, 1);
      state.payload.five_whys.forEach((why, index) => (why.level = index + 1));
      markHuman(state, "five_whys");
    },

    // ---- fishbone -----------------------------------------------------------
    setFishboneStatus(state, action: PayloadAction<{ id: string; status: "suggested" | "confirmed" | "dismissed" }>) {
      const factor = state.payload.fishbone.find((f) => f.id === action.payload.id);
      if (!factor) return;
      factor.status = action.payload.status;
      markHuman(state, "fishbone");
    },
    addFishboneFactor(state, action: PayloadAction<{ category: string; factor: string }>) {
      state.payload.fishbone.push({
        id: nextId("FB", state.payload.fishbone),
        category: action.payload.category as never,
        factor: action.payload.factor,
        rationale: "",
        evidence: [],
        status: "suggested",
        origin: "human",
      });
      markHuman(state, "fishbone");
    },

    // ---- root causes --------------------------------------------------------
    acceptRootCause(state, action: PayloadAction<{ id: string; actor?: string; note?: string }>) {
      const cause = state.payload.root_causes.find((c) => c.id === action.payload.id);
      if (!cause) return;
      cause.status = "accepted";
      cause.confirmed_by = action.payload.actor || CURRENT_USER.name;
      cause.confirmed_at = new Date().toISOString().slice(0, 10);
      if (action.payload.note) cause.confirmed_note = action.payload.note;
      markHuman(state, "root_causes");
    },
    rejectRootCause(state, action: PayloadAction<string>) {
      const cause = state.payload.root_causes.find((c) => c.id === action.payload);
      if (!cause) return;
      cause.status = "rejected";
      cause.confirmed_by = "";
      cause.confirmed_at = "";
      markHuman(state, "root_causes");
    },
    resetRootCause(state, action: PayloadAction<string>) {
      const cause = state.payload.root_causes.find((c) => c.id === action.payload);
      if (!cause) return;
      cause.status = "suggested";
      cause.confirmed_by = "";
      cause.confirmed_at = "";
      markHuman(state, "root_causes");
    },
    updateRootCause(state, action: PayloadAction<{ id: string; patch: Partial<RootCause> }>) {
      const cause = state.payload.root_causes.find((c) => c.id === action.payload.id);
      if (!cause) return;
      Object.assign(cause, action.payload.patch, { origin: "human" });
      markHuman(state, "root_causes");
    },

    // ---- gaps ---------------------------------------------------------------
    setGapStatus(state, action: PayloadAction<{ id: string; status: Gap["status"] }>) {
      const gap = state.payload.gaps.find((g) => g.id === action.payload.id);
      if (!gap) return;
      gap.status = action.payload.status;
      markHuman(state, "gaps");
    },
    addGap(state) {
      state.payload.gaps.push({
        id: nextId("GAP", state.payload.gaps),
        item: "",
        why_needed: "",
        request_from: "",
        priority: "Medium",
        status: "open",
        origin: "human",
      });
      markHuman(state, "gaps");
    },

    // ---- CAPA ---------------------------------------------------------------
    acceptCapa(state, action: PayloadAction<string>) {
      const item = state.payload.capa.find((c) => c.id === action.payload);
      if (!item) return;
      item.status = "accepted";
      markHuman(state, "capa");
    },
    rejectCapa(state, action: PayloadAction<string>) {
      const item = state.payload.capa.find((c) => c.id === action.payload);
      if (!item) return;
      item.status = "rejected";
      markHuman(state, "capa");
    },
    resetCapa(state, action: PayloadAction<string>) {
      const item = state.payload.capa.find((c) => c.id === action.payload);
      if (!item) return;
      item.status = "suggested";
      markHuman(state, "capa");
    },
    updateCapa(state, action: PayloadAction<{ id: string; patch: Partial<CapaAction> }>) {
      const item = state.payload.capa.find((c) => c.id === action.payload.id);
      if (!item) return;
      Object.assign(item, action.payload.patch, { origin: "human" });
      markHuman(state, "capa");
    },
    addCapa(state) {
      const due = new Date();
      due.setDate(due.getDate() + 30);
      state.payload.capa.push({
        id: nextId("CA", state.payload.capa),
        type: "Preventive",
        action: "",
        explanation: "",
        owner: "",
        due_date: due.toISOString().slice(0, 10),
        priority: "Medium",
        root_cause_ref: "",
        effectiveness_check: "",
        status: "suggested",
        origin: "human",
      });
      markHuman(state, "capa");
    },
    removeCapa(state, action: PayloadAction<string>) {
      state.payload.capa = state.payload.capa.filter((c) => c.id !== action.payload);
      markHuman(state, "capa");
    },

    // ---- AI application -----------------------------------------------------
    applyIntake(
      state,
      action: PayloadAction<{
        payload: Payload;
        provenance: Provenance;
        meta: AiMeta;
        sourceId: string;
      }>,
    ) {
      const hadAnalysis = state.payload.five_whys.length > 0 || state.payload.capa.length > 0;
      state.payload = {
        ...state.payload,
        ...action.payload.payload,
        status: state.status,
        signoff: state.payload.signoff,
      };
      state.provenance = { ...state.provenance, ...action.payload.provenance };
      state.aiMeta = { ...state.aiMeta, ...action.payload.meta };
      state.sourceId = action.payload.sourceId;
      state.analysisStale = hadAnalysis;
      state.dirty = true;
    },
    applyAnalysis(
      state,
      action: PayloadAction<{ payload: Payload; provenance: Provenance; review?: Review }>,
    ) {
      state.payload = {
        ...action.payload.payload,
        status: state.status,
        signoff: state.payload.signoff,
      };
      if (action.payload.review) state.payload.review = action.payload.review;
      state.provenance = { ...state.provenance, ...action.payload.provenance };
      state.analysisStale = false;
      state.dirty = true;
    },
    setReview(state, action: PayloadAction<Review>) {
      state.payload.review = action.payload;
    },
    setAiMeta(state, action: PayloadAction<AiMeta>) {
      state.aiMeta = { ...state.aiMeta, ...action.payload };
    },
    setSourceId(state, action: PayloadAction<string | null>) {
      state.sourceId = action.payload;
    },

    // ---- persistence --------------------------------------------------------
    saveStart(state) {
      state.saving = true;
      state.error = null;
    },
    saveSuccess(state, action: PayloadAction<InvestigationDetail>) {
      const detail = action.payload;
      state.id = detail.id;
      state.code = detail.code;
      state.status = detail.status;
      state.payload = { ...state.payload, ...detail.payload, status: detail.status };
      state.provenance = detail.provenance ?? state.provenance;
      state.saving = false;
      state.dirty = false;
      state.savedAt = detail.updated_at;
      state.analysisStale = false;
    },
    saveError(state, action: PayloadAction<string>) {
      state.saving = false;
      state.error = action.payload;
    },
    setAudit(state, action: PayloadAction<AuditEvent[]>) {
      state.audit = action.payload;
    },
    setSignoff(state, action: PayloadAction<InvestigationDetail>) {
      const detail = action.payload;
      state.status = "approved";
      state.payload = { ...detail.payload, status: "approved" };
      state.provenance = detail.provenance ?? state.provenance;
      state.savedAt = detail.updated_at;
      state.dirty = false;
    },
    markDirty(state) {
      state.dirty = true;
    },
  },
});

export const investigationActions = slice.actions;
export default slice.reducer;
