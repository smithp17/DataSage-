import axios from "axios";
import { DatasetMeta, ChartSpec, SQLResult, ColumnProfile } from "@/types";

const http = axios.create({ baseURL: "/api" });

// ── Upload ────────────────────────────────────────────────────
export async function uploadDataset(file: File): Promise<DatasetMeta> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await http.post<DatasetMeta>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ── Datasets list ─────────────────────────────────────────────
export async function listDatasets(): Promise<{ dataset_id: string; filename: string }[]> {
  const { data } = await http.get("/datasets");
  return data;
}

export async function deleteDataset(id: string): Promise<void> {
  await http.delete(`/dataset/${id}`);
}

// ── Data preview ──────────────────────────────────────────────
export async function getPreview(id: string, page = 1, pageSize = 100) {
  const { data } = await http.get(`/dataset/${id}/preview`, {
    params: { page, page_size: pageSize },
  });
  return data as {
    columns:     { name: string; dtype: string }[];
    rows:        Record<string, unknown>[];
    total_rows:  number;
    page:        number;
    total_pages: number;
  };
}

// ── Column profile ────────────────────────────────────────────
export async function getFullProfile(id: string): Promise<ColumnProfile[]> {
  const { data } = await http.get(`/dataset/${id}/profile`);
  return data;
}

// ── SQL ───────────────────────────────────────────────────────
export async function runSQL(id: string, sql: string): Promise<SQLResult> {
  const { data } = await http.post(`/dataset/${id}/sql`, { sql });
  return data;
}

// ── SSE streaming (analyse + insights) ───────────────────────
export interface StreamEvent {
  type:    "text" | "chart" | "done" | "error";
  content: string | ChartSpec;
}

function openStream(
  url:     string,
  body:    object,
  onText:  (chunk: string)   => void,
  onChart: (spec: ChartSpec) => void,
  onDone:  ()                => void,
  onError: (msg: string)     => void,
): () => void {
  let cancelled = false;

  fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  }).then(async (res) => {
    if (!res.ok || !res.body) { onError(`Server ${res.status}`); return; }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buf     = "";

    while (true) {
      if (cancelled) break;
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const evt: StreamEvent = JSON.parse(line.slice(6));
          if (evt.type === "text")  onText(evt.content as string);
          if (evt.type === "chart") onChart(evt.content as ChartSpec);
          if (evt.type === "done")  { onDone(); return; }
          if (evt.type === "error") { onError(evt.content as string); return; }
        } catch { /* skip */ }
      }
    }
    onDone();
  }).catch((e) => onError(String(e)));

  return () => { cancelled = true; };
}

export function streamAnalysis(
  dataset_id: string, message: string,
  history: { role: string; content: string }[],
  onText: (c: string) => void, onChart: (s: ChartSpec) => void,
  onDone: () => void,          onError: (m: string)    => void,
) {
  return openStream("/api/analyze/stream", { dataset_id, message, history },
    onText, onChart, onDone, onError);
}

export function streamInsights(
  dataset_id: string,
  onText: (c: string) => void, onChart: (s: ChartSpec) => void,
  onDone: () => void,          onError: (m: string)    => void,
) {
  return openStream(`/api/dataset/${dataset_id}/insights`, {},
    onText, onChart, onDone, onError);
}
