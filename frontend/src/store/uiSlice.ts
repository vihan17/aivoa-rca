import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";

export interface Toast {
  id: string;
  kind: "success" | "error" | "info";
  title: string;
  message?: string;
}

interface UiState {
  toasts: Toast[];
  copilotOpen: boolean;
  shortcutsOpen: boolean;
}

const initialState: UiState = {
  toasts: [],
  copilotOpen: true,
  shortcutsOpen: false,
};

const slice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    pushToast(state, action: PayloadAction<Omit<Toast, "id">>) {
      state.toasts.push({ id: nanoid(), ...action.payload });
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
    toggleCopilot(state, action: PayloadAction<boolean | undefined>) {
      state.copilotOpen = action.payload ?? !state.copilotOpen;
    },
    setShortcutsOpen(state, action: PayloadAction<boolean>) {
      state.shortcutsOpen = action.payload;
    },
  },
});

export const uiActions = slice.actions;
export default slice.reducer;
