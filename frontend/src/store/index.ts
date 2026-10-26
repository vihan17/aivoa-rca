import { configureStore } from "@reduxjs/toolkit";
import investigation from "./investigationSlice";
import copilot from "./copilotSlice";
import investigations from "./investigationsSlice";
import ui from "./uiSlice";

export const store = configureStore({
  reducer: { investigation, copilot, investigations, ui },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
