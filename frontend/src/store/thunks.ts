import { api } from "../lib/api";
import { copilotActions } from "./copilotSlice";
import type { AppDispatch, RootState } from "./index";
import { uiActions } from "./uiSlice";

type GetState = () => RootState;

export const requestEvidenceEmail =
  () => async (dispatch: AppDispatch, getState: GetState) => {
    const state = getState();
    const gaps = state.investigation.payload.gaps.filter((gap) => gap.status === "open");
    if (!gaps.length) {
      dispatch(
        uiActions.pushToast({
          kind: "info",
          title: "No open evidence gaps",
          message: "Everything the copilot flagged has been requested or resolved.",
        }),
      );
      return;
    }
    dispatch(copilotActions.setEmailLoading(true));
    try {
      const response = await api.evidenceRequest(gaps, {
        code: state.investigation.code || "Draft investigation",
        title: state.investigation.payload.title,
        product_name: state.investigation.payload.product_name,
        batch_number: state.investigation.payload.batch_number,
      });
      dispatch(copilotActions.setEmailDraft(response.email));
    } catch (error) {
      dispatch(copilotActions.setEmailLoading(false));
      dispatch(
        uiActions.pushToast({
          kind: "error",
          title: "Could not draft the email",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
  };
