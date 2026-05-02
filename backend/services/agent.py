"""Groq-powered analyst agent — tool use + SSE streaming."""
import json
import os
from typing import Iterator
from groq import Groq
import pandas as pd

from services.data_service import (
    dataset_info,
    run_aggregation,
    get_column_values,
    correlation_matrix,
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# llama-3.1-8b-instant: 6k TPM, 500k TPD — works with our compressed prompts
MODEL_PRIMARY  = "llama-3.1-8b-instant"
MODEL_FALLBACK = "llama-3.3-70b-versatile"
MODEL          = MODEL_PRIMARY

# ──────────────────────────────────────────────────────────────
# Colour palette & dark-theme helpers
# ──────────────────────────────────────────────────────────────
# Full 12-color vivid palette — used in ALL charts
PALETTE = [
    "#6366f1",   # indigo
    "#06b6d4",   # cyan
    "#10b981",   # emerald
    "#f59e0b",   # amber
    "#f43f5e",   # rose
    "#8b5cf6",   # violet
    "#ec4899",   # pink
    "#14b8a6",   # teal
    "#f97316",   # orange
    "#84cc16",   # lime
    "#3b82f6",   # blue
    "#a855f7",   # purple
]

DARK_THEME = {
    "plot_bgcolor":  "#0d1526",
    "paper_bgcolor": "#070d1a",
    "font":   {"color": "#e2e8f0", "family": "Inter, system-ui, sans-serif", "size": 13},
    "xaxis":  {"gridcolor": "#1a2d4a", "linecolor": "#243b5e",
                "tickfont": {"color": "#64748b", "size": 11}, "zerolinecolor": "#1a2d4a"},
    "yaxis":  {"gridcolor": "#1a2d4a", "linecolor": "#243b5e",
                "tickfont": {"color": "#64748b", "size": 11}, "zerolinecolor": "#1a2d4a"},
    "legend": {"bgcolor": "rgba(13,21,38,0.8)", "bordercolor": "#1a2d4a",
                "borderwidth": 1, "font": {"color": "#cbd5e1", "size": 12}},
    "hoverlabel": {"bgcolor": "#0d1526", "bordercolor": "#6366f1",
                   "font": {"color": "#f1f5f9", "size": 13}},
    "margin": {"l": 60, "r": 24, "t": 64, "b": 60},
    "colorway": PALETTE,
}

# ──────────────────────────────────────────────────────────────
# System prompt — instructs the model how to produce world-class charts
# ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an AI data analyst. Follow these steps EXACTLY for every request:

STEP 1: Call get_dataset_info to learn real column names and types.
STEP 2: Call query_data or get_column_data to get REAL values from the dataset.
STEP 3: Call create_visualization using ONLY values returned by the tools in step 2.

CRITICAL DATA RULES:
- NEVER invent category names like "A", "B", "Category 1" — use EXACT strings from tool results.
- For a bar chart: x = list of group_by column values from records, y = list of value_col numbers from records.
  Example: if records=[{"city":"Mumbai","sales":5000},{"city":"Delhi","sales":3200}] then x=["Mumbai","Delhi"] y=[5000,3200]
- For pie: labels = category names from records, values = numbers from records.
- For histogram: x = raw values list from get_column_data result["values"].
- For heatmap: z = matrix from get_correlation_matrix result["values"], x=y=result["columns"].

CHART STYLE: plot_bgcolor="#050505" paper_bgcolor="#000" colorway=["#DFFF00","#00FFFF","#BF5AF2","#FF6B35","#10b981","#3b82f6"] hoverlabel.bgcolor="#0D0D0D" hoverlabel.bordercolor="#DFFF00" bargap=0.28 bar.textposition="outside"

ANSWER any data question (no chart needed) using tool results. Always call get_dataset_info first.
Reply: 1 bold key finding + 2 bullets. Under 70 words."""

# ──────────────────────────────────────────────────────────────
# Tool schemas
# ──────────────────────────────────────────────────────────────
TOOLS = [
    {"type":"function","function":{"name":"get_dataset_info","description":"Dataset metadata: shape, column names, types, stats.","parameters":{"type":"object","properties":{},"required":[]}}},
    {"type":"function","function":{"name":"query_data","description":"Group-by aggregate. Returns records for charts.","parameters":{"type":"object","properties":{"group_by":{"type":"array","items":{"type":"string"}},"value_col":{"type":"string"},"agg_func":{"type":"string","enum":["sum","mean","count","min","max","median"]},"limit":{"type":"integer"}},"required":["value_col","agg_func"]}}},
    {"type":"function","function":{"name":"get_column_data","description":"Raw column values for histograms/scatter.","parameters":{"type":"object","properties":{"column":{"type":"string"},"limit":{"type":"integer"}},"required":["column"]}}},
    {"type":"function","function":{"name":"get_correlation_matrix","description":"Correlation matrix for heatmaps.","parameters":{"type":"object","properties":{},"required":[]}}},
    {"type":"function","function":{"name":"create_visualization","description":"Emit Plotly chart. plotly_data=array of traces (NOT a string). plotly_layout=object (NOT a string).","parameters":{"type":"object","properties":{"title":{"type":"string"},"chart_type":{"type":"string","enum":["bar","line","scatter","histogram","box","pie","heatmap","area","treemap","funnel","violin"]},"plotly_data":{"type":"array","items":{"type":"object"}},"plotly_layout":{"type":"object"}},"required":["title","chart_type","plotly_data","plotly_layout"]}}},
]

# ──────────────────────────────────────────────────────────────
# Layout merger
# ──────────────────────────────────────────────────────────────
def _merge_layout(user_layout: dict, title: str) -> dict:
    import copy
    base = copy.deepcopy(DARK_THEME)
    base["title"] = {"text": title,
                     "font": {"color": "#e2e8f0", "size": 20},
                     "x": 0.04}
    for k, v in user_layout.items():
        if isinstance(v, dict) and k in base and isinstance(base[k], dict):
            base[k] = {**base[k], **v}
        else:
            base[k] = v
    return base


# ──────────────────────────────────────────────────────────────
# Tool executor
# ──────────────────────────────────────────────────────────────
def _exec_tool(df: pd.DataFrame, info: dict, name: str, inp: dict) -> dict:
    if name == "get_dataset_info":
        return info

    if name == "query_data":
        records = run_aggregation(
            df,
            group_by=inp.get("group_by"),
            value_col=inp["value_col"],
            agg_func=inp["agg_func"],
            filters=inp.get("filters"),
            limit=inp.get("limit", 500),
        )
        return {"records": records, "count": len(records)}

    if name == "get_column_data":
        vals = get_column_values(df, inp["column"], inp.get("limit", 500))
        return {"column": inp["column"], "values": vals}

    if name == "get_correlation_matrix":
        mat = correlation_matrix(df)
        return mat or {"error": "Not enough numeric columns"}

    if name == "create_visualization":
        # Smaller models sometimes serialise arrays/objects as JSON strings — fix silently
        plotly_data   = inp.get("plotly_data", [])
        plotly_layout = inp.get("plotly_layout", {})

        if isinstance(plotly_data, str):
            try:
                plotly_data = json.loads(plotly_data)
            except json.JSONDecodeError:
                plotly_data = []

        if isinstance(plotly_layout, str):
            try:
                plotly_layout = json.loads(plotly_layout)
            except json.JSONDecodeError:
                plotly_layout = {}

        def _is_real_value(v) -> bool:
            if isinstance(v, str):
                return not any(kw in v for kw in ["get_column_data", "get_dataset", "query_data"])
            return True

        def _looks_like_placeholder(val) -> bool:
            """Detect ['A','B','C'] or ['Category 1','Category 2'] style fake data."""
            if not isinstance(val, list) or len(val) < 2:
                return False
            # Single uppercase letters only
            if all(isinstance(v, str) and len(v) == 1 and v.isupper() for v in val[:6]):
                return True
            # "Category N" / "Group N" / "Item N" pattern
            placeholders = {"category","group","item","type","label","value","series","class"}
            if all(isinstance(v, str) and any(p in v.lower() for p in placeholders)
                   and any(c.isdigit() for c in v) for v in val[:4]):
                return True
            return False

        fixed_traces = []
        for trace in (plotly_data if isinstance(plotly_data, list) else []):
            if isinstance(trace, str):
                try:
                    trace = json.loads(trace)
                except json.JSONDecodeError:
                    continue
            if not isinstance(trace, dict):
                continue
            cleaned = {k: v for k, v in trace.items() if _is_real_value(v)}
            # Reject traces whose x or labels look like placeholder data
            if _looks_like_placeholder(cleaned.get("x")) or _looks_like_placeholder(cleaned.get("labels")):
                return {"error": "Placeholder data detected — model must use real tool results"}
            fixed_traces.append(cleaned)

        layout = _merge_layout(plotly_layout, inp["title"])
        return {
            "chart": {
                "data":       fixed_traces,
                "layout":     layout,
                "title":      inp["title"],
                "chart_type": inp["chart_type"],
            }
        }

    return {"error": f"Unknown tool: {name}"}


# ──────────────────────────────────────────────────────────────
# Core: tool-use loop  (non-streaming phase)
# ──────────────────────────────────────────────────────────────
def _chat(model: str, **kwargs):
    """Call Groq; auto-fallback to secondary model on rate-limit (429)."""
    from groq import RateLimitError
    try:
        return client.chat.completions.create(model=model, **kwargs)
    except RateLimitError:
        if model != MODEL_FALLBACK:
            return client.chat.completions.create(model=MODEL_FALLBACK, **kwargs)
        raise
    except Exception as e:
        # 413 request too large — retry with fallback model
        if "413" in str(e) or "too large" in str(e).lower():
            if model != MODEL_FALLBACK:
                return client.chat.completions.create(model=MODEL_FALLBACK, **kwargs)
        raise


def _run_tool_loop(
    df: pd.DataFrame,
    messages: list[dict],
    info: dict,
) -> tuple[list[dict], dict | None]:
    """Run tool-use iterations until the model stops calling tools.
    Returns (updated_messages, chart_spec_or_None)."""
    chart_spec = None
    from groq import BadRequestError

    for _ in range(8):
        try:
            resp = _chat(
                MODEL,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
                max_tokens=1200,
                temperature=0.2,
            )
        except BadRequestError as e:
            # Model produced invalid tool JSON (e.g. embedded a tool-call reference).
            # Inject a corrective user message and retry without tools.
            messages.append({
                "role": "user",
                "content": (
                    "Your last tool call was invalid — you cannot embed tool references "
                    "inside create_visualization arguments. "
                    "Please first call query_data or get_column_data to fetch real data, "
                    "then call create_visualization with actual numeric values."
                ),
            })
            continue
        choice = resp.choices[0]
        msg    = choice.message

        if choice.finish_reason != "tool_calls" or not msg.tool_calls:
            # Model wrote a text response — keep it for streaming phase
            if msg.content:
                messages.append({"role": "assistant", "content": msg.content})
            break

        # Append assistant tool-call turn
        messages.append({
            "role":       "assistant",
            "content":    msg.content or "",
            "tool_calls": [
                {
                    "id":       tc.id,
                    "type":     "function",
                    "function": {
                        "name":      tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in msg.tool_calls
            ],
        })

        # Execute each tool
        for tc in msg.tool_calls:
            try:
                inp = json.loads(tc.function.arguments)
            except json.JSONDecodeError:
                # Model returned malformed JSON — try to recover or skip
                try:
                    import re
                    cleaned = re.sub(r'[\x00-\x1f]', '', tc.function.arguments)
                    inp = json.loads(cleaned)
                except Exception:
                    inp = {}

            result = _exec_tool(df, info, tc.function.name, inp)

            if tc.function.name == "create_visualization" and "chart" in result:
                chart_spec = result["chart"]
                tool_content = json.dumps({"status": "chart created",
                                           "title": inp.get("title")})
            else:
                tool_content = json.dumps(result, default=str)[:8000]  # cap size

            messages.append({
                "role":         "tool",
                "tool_call_id": tc.id,
                "content":      tool_content,
            })

    return messages, chart_spec


# ──────────────────────────────────────────────────────────────
# Public API 1 — streaming generator  (for SSE endpoint)
# ──────────────────────────────────────────────────────────────
def stream_agent(
    df: pd.DataFrame, message: str, history: list[dict]
) -> Iterator[dict]:
    """Yield SSE event dicts: {type: 'text'|'chart'|'done', content: ...}"""
    info = dataset_info(df)

    # Compact context — include ALL column names so model knows real names
    TYPE_SHORT = {"int64":"int","float64":"float","object":"str","bool":"bool","datetime64[ns]":"date"}
    col_summary = {c: TYPE_SHORT.get(info["dtypes"][c], info["dtypes"][c][:5])
                   for c in info["column_names"][:20]}
    context = (
        f"Dataset: {info['rows']:,} rows × {info['columns']} columns.\n"
        f"Columns with types: {json.dumps(col_summary)}\n"
        f"Use ONLY these exact column names in tool calls."
    )
    if info["columns"] > 20:
        context += f" (+{info['columns']-20} more — call get_dataset_info to see all)"

    # Max 4 history turns
    trimmed_history = history[-4:] if len(history) > 4 else history

    messages: list[dict] = [
        {"role": "system",  "content": SYSTEM_PROMPT},
        # Inject dataset info as assistant context so model knows columns before first tool call
        {"role": "user",    "content": f"[DATASET CONTEXT]\n{context}"},
        {"role": "assistant","content": f"Understood. I can see the dataset has columns: {', '.join(info['column_names'][:20])}. I will use get_dataset_info or query_data to fetch real values before creating any visualization."},
        *trimmed_history,
        {"role": "user",    "content": message},
    ]

    # Phase 1 — tool use (non-streaming)
    messages, chart_spec = _run_tool_loop(df, messages, info)

    # Phase 2 — stream the final analysis text
    from groq import RateLimitError
    try:
        stream = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            stream=True,
            max_tokens=500,
            temperature=0.35,
        )
    except RateLimitError:
        stream = client.chat.completions.create(
            model=MODEL_FALLBACK,
            messages=messages,
            stream=True,
            max_tokens=500,
            temperature=0.35,
        )

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield {"type": "text", "content": delta.content}

    if chart_spec:
        yield {"type": "chart", "content": chart_spec}

    yield {"type": "done", "content": ""}


# ──────────────────────────────────────────────────────────────
# Public API 2 — blocking (kept for compatibility)
# ──────────────────────────────────────────────────────────────
def run_agent(df: pd.DataFrame, message: str, history: list[dict]) -> dict:
    text_parts: list[str] = []
    chart = None
    for event in stream_agent(df, message, history):
        if event["type"] == "text":
            text_parts.append(event["content"])
        elif event["type"] == "chart":
            chart = event["content"]
    return {"text": "".join(text_parts).strip(), "chart": chart}
