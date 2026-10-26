import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../lib/api";
import type { InvestigationListItem, InvestigationStats } from "../lib/types";

interface InvestigationsState {
  items: InvestigationListItem[];
  stats: InvestigationStats;
  loading: boolean;
  error: string | null;
}

const emptyStats: InvestigationStats = { total: 0, open: 0, approved: 0, open_gaps: 0, ai_runs: 0 };

const initialState: InvestigationsState = {
  items: [],
  stats: emptyStats,
  loading: false,
  error: null,
};

export const fetchInvestigations = createAsyncThunk("investigations/fetch", async () => {
  return api.listInvestigations();
});

const slice = createSlice({
  name: "investigations",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvestigations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInvestigations.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.stats = action.payload.stats;
      })
      .addCase(fetchInvestigations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Could not load investigations.";
      });
  },
});

export const investigationsActions = slice.actions;
export default slice.reducer;
