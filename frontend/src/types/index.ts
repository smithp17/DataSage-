export interface DatasetMeta {
  dataset_id:      string;
  filename:        string;
  rows:            number;
  columns:         number;
  column_names:    string[];
  dtypes:          Record<string, string>;
  preview:         Record<string, unknown>[];
  numeric_summary?: Record<string, Record<string, number>>;
}

export interface ChartSpec {
  data:       object[];
  layout:     object;
  title:      string;
  chart_type: string;
}

export interface SavedChart {
  id:         string;
  title:      string;
  chart_type: string;
  spec:       ChartSpec;
  created_at: number;
  dataset_id?: string;
}

export interface ChatMessage {
  role:      "user" | "assistant";
  content:   string;
  chart?:    ChartSpec;
  timestamp: number;
}

export interface ColumnProfile {
  name:       string;
  dtype:      string;
  total:      number;
  null_count: number;
  null_pct:   number;
  unique:     number;
  // numeric
  min?:    number;
  max?:    number;
  mean?:   number;
  median?: number;
  std?:    number;
  hist?:   { x: number; count: number }[];
  // categorical
  top_values?: { value: string; count: number }[];
}

export interface SQLResult {
  columns:   { name: string; dtype: string }[];
  rows:      Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
}
