import type {
  AuditEvent,
  ChatMessage,
  InvestigationDetail,
  InvestigationListItem,
  InvestigationStats,
  Options,
  Payload,
  ProviderInfo,
  SampleDoc,
  SourceDoc,
  StageEvent,
} from "./types";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) return data.detail.map((d: { msg?: string }) => d.msg).join(", ");
    return JSON.stringify(data);
  } catch {
    return response.statusText || `Request failed (${response.status})`;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(await readError(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  options: () => request<Options>("/api/meta/options"),
  samples: () => request<{ items: SampleDoc[] }>("/api/meta/samples"),
  sampleFileUrl: (id: string) => `/api/meta/samples/${id}/file`,

  listInvestigations: () =>
    request<{ items: InvestigationListItem[]; stats: InvestigationStats }>("/api/investigations"),
  getInvestigation: (id: string) => request<InvestigationDetail>(`/api/investigations/${id}`),
  createInvestigation: (body: {
    payload: Payload;
    provenance: Record<string, unknown>;
    ai_meta: Record<string, unknown>;
    source_id?: string | null;
  }) =>
    request<InvestigationDetail>("/api/investigations", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),
  updateInvestigation: (
    id: string,
    body: { payload: Payload; provenance: Record<string, unknown>; ai_meta: Record<string, unknown> },
  ) =>
    request<InvestigationDetail>(`/api/investigations/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),
  signoff: (
    id: string,
    body: { name: string; role: string; meaning: string; statement: string; confirmations: string[] },
  ) =>
    request<InvestigationDetail>(`/api/investigations/${id}/signoff`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),
  audit: (id: string) => request<{ items: AuditEvent[] }>(`/api/investigations/${id}/audit`),

  uploadSource: async (file: File): Promise<SourceDoc> => {
    const form = new FormData();
    form.append("file", file);
    return request<SourceDoc>("/api/sources/upload", { method: "POST", body: form });
  },
  pasteSource: (text: string, label?: string) =>
    request<SourceDoc>("/api/sources/text", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ text, label }),
    }),

  chat: (question: string, payload: Payload, history: ChatMessage[]) =>
    request<{ answer: string; provider: ProviderInfo }>("/api/ai/chat", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        question,
        payload,
        history: history.map((m) => ({ role: m.role, content: m.content })),
      }),
    }),
  evidenceRequest: (gaps: Payload["gaps"], context: Record<string, unknown>) =>
    request<{ email: string; provider: ProviderInfo }>("/api/ai/evidence-request", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ gaps, context }),
    }),
};

interface StreamHandlers {
  onStage?: (stage: StageEvent) => void;
  onResult?: (data: unknown) => void;
  onOpen?: () => void;
}

async function postStream(path: string, body: unknown, handlers: StreamHandlers): Promise<void> {
  const response = await fetch(path, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readError(response));
  if (!response.body) throw new Error("Streaming is not supported by this browser.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (raw: string) => {
    if (!raw.trim()) return;
    let event = "message";
    const data: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (!data.length) return;
    const parsed = JSON.parse(data.join("\n")) as Record<string, unknown>;
    if (event === "open") handlers.onOpen?.();
    else if (event === "stage") handlers.onStage?.(parsed as unknown as StageEvent);
    else if (event === "result") handlers.onResult?.(parsed);
    else if (event === "error") {
      throw new Error(String(parsed.message || "The AI run failed."));
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index = buffer.indexOf("\n\n");
    while (index >= 0) {
      const chunk = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      dispatch(chunk);
      index = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) dispatch(buffer);
}

export const ai = {
  extract: (sourceId: string, investigationId: string | null, handlers: StreamHandlers) =>
    postStream("/api/ai/extract", { source_id: sourceId, investigation_id: investigationId }, handlers),
  analyze: (payload: Payload, investigationId: string | null, handlers: StreamHandlers) =>
    postStream("/api/ai/analyze", { payload, investigation_id: investigationId }, handlers),
};
