import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";
import type {
  ChatMessage,
  InputMode,
  ProviderInfo,
  RunState,
  SampleDoc,
  SourceDoc,
  StageEvent,
} from "../lib/types";

type RunKind = "intake" | "analysis";

export interface CopilotState {
  tab: "source" | "assistant";
  inputMode: InputMode;
  source: SourceDoc | null;
  pastedText: string;
  samples: SampleDoc[];
  samplesLoading: boolean;
  dragOver: boolean;
  uploadError: string | null;
  intakeRun: RunState;
  analysisRun: RunState;
  messages: ChatMessage[];
  chatPending: boolean;
  emailDraft: string | null;
  emailLoading: boolean;
  emailOpen: boolean;
  provider: ProviderInfo | null;
}

const emptyRun = (): RunState => ({ status: "idle", stages: [] });

const initialState: CopilotState = {
  tab: "source",
  inputMode: "upload",
  source: null,
  pastedText: "",
  samples: [],
  samplesLoading: false,
  dragOver: false,
  uploadError: null,
  intakeRun: emptyRun(),
  analysisRun: emptyRun(),
  messages: [
    {
      id: "welcome",
      role: "assistant",
      content:
        "Add a deviation report, email or pasted note and I will populate the investigation record, extract the evidence and flag what is missing. You can then ask me to test a root cause or draft the CAPA.",
    },
  ],
  chatPending: false,
  emailDraft: null,
  emailLoading: false,
  emailOpen: false,
  provider: null,
};

function applyStage(run: RunState, event: StageEvent) {
  const index = run.stages.findIndex((stage) => stage.stage === event.stage);
  if (index >= 0) {
    run.stages[index] = { ...run.stages[index], ...event };
  } else {
    run.stages.push(event);
  }
}

const slice = createSlice({
  name: "copilot",
  initialState,
  reducers: {
    setTab(state, action: PayloadAction<"source" | "assistant">) {
      state.tab = action.payload;
    },
    setInputMode(state, action: PayloadAction<InputMode>) {
      state.inputMode = action.payload;
    },
    setPastedText(state, action: PayloadAction<string>) {
      state.pastedText = action.payload;
    },
    setSamples(state, action: PayloadAction<SampleDoc[]>) {
      state.samples = action.payload;
      state.samplesLoading = false;
    },
    setProvider(state, action: PayloadAction<ProviderInfo>) {
      state.provider = action.payload;
    },
    setSource(state, action: PayloadAction<SourceDoc>) {
      state.source = action.payload;
      state.uploadError = null;
      state.pastedText = "";
    },
    clearSource(state) {
      state.source = null;
      state.intakeRun = emptyRun();
      state.analysisRun = emptyRun();
    },
    setDragOver(state, action: PayloadAction<boolean>) {
      state.dragOver = action.payload;
    },
    setUploadError(state, action: PayloadAction<string | null>) {
      state.uploadError = action.payload;
    },
    startRun(state, action: PayloadAction<RunKind>) {
      const run = action.payload === "intake" ? state.intakeRun : state.analysisRun;
      run.status = "running";
      run.stages = [];
      run.error = undefined;
      run.stats = undefined;
      if (action.payload === "intake") state.tab = "source";
    },
    receiveStage(state, action: PayloadAction<{ kind: RunKind; event: StageEvent }>) {
      const run = action.payload.kind === "intake" ? state.intakeRun : state.analysisRun;
      applyStage(run, action.payload.event);
    },
    finishRun(state, action: PayloadAction<{ kind: RunKind; stats: Record<string, number> }>) {
      const run = action.payload.kind === "intake" ? state.intakeRun : state.analysisRun;
      run.status = "done";
      run.stats = action.payload.stats;
      run.stages = run.stages.map((stage) =>
        stage.status === "running" ? { ...stage, status: "done" } : stage,
      );
    },
    failRun(state, action: PayloadAction<{ kind: RunKind; error: string }>) {
      const run = action.payload.kind === "intake" ? state.intakeRun : state.analysisRun;
      run.status = "error";
      run.error = action.payload.error;
    },
    addMessage(state, action: PayloadAction<{ role: "user" | "assistant"; content: string }>) {
      state.messages.push({ id: nanoid(), ...action.payload });
    },
    setChatPending(state, action: PayloadAction<boolean>) {
      state.chatPending = action.payload;
    },
    setEmailDraft(state, action: PayloadAction<string | null>) {
      state.emailDraft = action.payload;
      state.emailLoading = false;
      state.emailOpen = Boolean(action.payload);
    },
    setEmailOpen(state, action: PayloadAction<boolean>) {
      state.emailOpen = action.payload;
      if (!action.payload) state.emailDraft = null;
    },
    setEmailLoading(state, action: PayloadAction<boolean>) {
      state.emailLoading = action.payload;
    },
    resetCopilot() {
      return { ...initialState, messages: initialState.messages };
    },
  },
});

export const copilotActions = slice.actions;
export default slice.reducer;

