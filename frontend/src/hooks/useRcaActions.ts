import { useCallback } from "react";
import { ai } from "../lib/api";
import type { AiMeta, Payload, ProviderInfo, Provenance, Review } from "../lib/types";
import { copilotActions } from "../store/copilotSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { investigationActions } from "../store/investigationSlice";
import { uiActions } from "../store/uiSlice";

const FIELD_KEYS: (keyof Payload)[] = [
  "title",
  "description",
  "deviation_type",
  "classification",
  "date_occurred",
  "date_detected",
  "reported_by",
  "site_area",
  "department",
  "product_name",
  "product_code",
  "batch_number",
  "batch_size",
  "process_stage",
  "equipment",
  "immediate_action",
  "impact_assessment",
  "investigation_scope",
  "source_summary",
  "summary",
  "conclusion",
];

interface ExtractResult {
  payload: Payload;
  provenance: Provenance;
  meta: AiMeta;
  provider: ProviderInfo;
}

interface AnalyzeResult {
  payload: Payload;
  provenance: Provenance;
  review: Review;
  provider: ProviderInfo;
}

export function useRcaActions() {
  const dispatch = useAppDispatch();
  const source = useAppSelector((state) => state.copilot.source);
  const payload = useAppSelector((state) => state.investigation.payload);
  const id = useAppSelector((state) => state.investigation.id);

  const extract = useCallback(
    async (overrideSourceId?: string) => {
      const sourceId = overrideSourceId ?? source?.id;
      if (!sourceId) {
        dispatch(
          uiActions.pushToast({
            kind: "info",
            title: "Add a source first",
            message: "Upload a PDF, .eml or paste the deviation text.",
          }),
        );
        return;
      }
      dispatch(uiActions.toggleCopilot(true));
      dispatch(copilotActions.setTab("source"));
      dispatch(copilotActions.startRun("intake"));
      const captured: { value: ExtractResult | null } = { value: null };
      try {
        await ai.extract(sourceId, id, {
          onStage: (stage) => dispatch(copilotActions.receiveStage({ kind: "intake", event: stage })),
          onResult: (data) => {
            captured.value = data as ExtractResult;
          },
        });
        if (!captured.value) throw new Error("The copilot finished without returning an extraction.");
        const value = captured.value;
        const fields = FIELD_KEYS.filter((key) => {
          const candidate = value.payload[key];
          return typeof candidate === "string" && candidate.trim().length > 0;
        }).length;
        dispatch(
          investigationActions.applyIntake({
            payload: value.payload,
            provenance: value.provenance ?? {},
            meta: {
              ...value.meta,
              provider: value.provider?.provider,
              model: value.provider?.model,
              live: value.provider?.live,
            },
            sourceId,
          }),
        );
        if (value.provider) dispatch(copilotActions.setProvider(value.provider));
        dispatch(
          copilotActions.finishRun({
            kind: "intake",
            stats: {
              fields,
              evidence: value.payload.evidence?.length ?? 0,
              gaps: value.payload.gaps?.length ?? 0,
            },
          }),
        );
        dispatch(
          uiActions.pushToast({
            kind: "success",
            title: "Investigation populated",
            message: `${fields} fields · ${value.payload.evidence?.length ?? 0} evidence items · ${
              value.payload.gaps?.length ?? 0
            } gaps. Review every AI value before confirming.`,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "The extraction failed.";
        dispatch(copilotActions.failRun({ kind: "intake", error: message }));
        dispatch(
          uiActions.pushToast({ kind: "error", title: "Extraction failed", message }),
        );
      }
    },
    [dispatch, id, source?.id],
  );

  const analyze = useCallback(async () => {
    if (!payload.description.trim() && payload.evidence.length === 0) {
      dispatch(
        uiActions.pushToast({
          kind: "info",
          title: "Not enough content to analyse",
          message: "Add a description or extract the source document first.",
        }),
      );
      return;
    }
    dispatch(uiActions.toggleCopilot(true));
    dispatch(copilotActions.setTab("source"));
    dispatch(copilotActions.startRun("analysis"));
    const captured: { value: AnalyzeResult | null } = { value: null };
    try {
      await ai.analyze(payload, id, {
        onStage: (stage) => dispatch(copilotActions.receiveStage({ kind: "analysis", event: stage })),
        onResult: (data) => {
          captured.value = data as AnalyzeResult;
        },
      });
      if (!captured.value) throw new Error("The copilot finished without returning an analysis.");
      const value = captured.value;
      dispatch(
        investigationActions.applyAnalysis({
          payload: value.payload,
          provenance: value.provenance ?? {},
          review: value.review,
        }),
      );
      if (value.provider) dispatch(copilotActions.setProvider(value.provider));
      dispatch(
        copilotActions.finishRun({
          kind: "analysis",
          stats: {
            whys: value.payload.five_whys?.length ?? 0,
            fishbone: value.payload.fishbone?.length ?? 0,
            causes: value.payload.root_causes?.length ?? 0,
            capa: value.payload.capa?.length ?? 0,
          },
        }),
      );
      dispatch(
        uiActions.pushToast({
          kind: "success",
          title: "RCA analysis complete",
          message: `${value.payload.five_whys?.length ?? 0} Whys, ${
            value.payload.root_causes?.length ?? 0
          } causes and ${value.payload.capa?.length ?? 0} CAPA actions drafted. Confirm the cause yourself.`,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The analysis failed.";
      dispatch(copilotActions.failRun({ kind: "analysis", error: message }));
      dispatch(uiActions.pushToast({ kind: "error", title: "Analysis failed", message }));
    }
  }, [dispatch, id, payload]);

  return { extract, analyze };
}
