"""
Gemini 2.0 Flash agent using the new google-genai SDK.
Much better at producing rich, structured Plotly chart specs.
Free tier: 15 RPM, 1M tokens/day.
"""
import json
import os
from typing import Iterator
import pandas as pd

from services.data_service import (
    dataset_info, run_aggregation, get_column_values, correlation_matrix,
)

_api_key = os.getenv("GEMINI_API_KEY", "")

# ── Lazy init so missing key never crashes import ─────────────
_client = None

def _get_client():
    global _client
    if _client is None and _api_key:
        from google import genai
        _client = genai.Client(api_key=_api_key)
    return _client


def is_available() -> bool:
    return bool(_api_key)


# ── Design tokens ─────────────────────────────────────────────
PALETTE = ["#DFFF00","#00FFFF","#BF5AF2","#FF6B35","#10b981",
           "#3b82f6","#ec4899","#f59e0b","#84cc16","#14b8a6"]

DARK_LAYOUT_BASE = {
    "plot_bgcolor":  "#050505",
    "paper_bgcolor": "#000000",
    "font":     {"color":"#e2e8f0","family":"Space Grotesk, DM Sans, sans-serif","size":13},
    "xaxis":    {"gridcolor":"#1A1A1A","linecolor":"#2A2A2A","tickfont":{"color":"#555","size":11},"zerolinecolor":"#1A1A1A"},
    "yaxis":    {"gridcolor":"#1A1A1A","linecolor":"#2A2A2A","tickfont":{"color":"#555","size":11},"zerolinecolor":"#1A1A1A"},
    "legend":   {"bgcolor":"rgba(5,5,5,0.85)","bordercolor":"#222","borderwidth":1,"font":{"color":"#ccc","size":12}},
    "hoverlabel":{"bgcolor":"#0D0D0D","bordercolor":"#DFFF00","font":{"color":"#fff","size":13}},
    "colorway": PALETTE,
    "margin":   {"l":64,"r":24,"t":72,"b":64},
}

# ── System prompt ─────────────────────────────────────────────
SYSTEM = """You are an elite data analyst AI. You produce TABLEAU-QUALITY Plotly.js visualizations.

## TOOL ORDER — follow EXACTLY every time:
1. Call get_dataset_info FIRST to see real column names.
2. Call query_data or get_column_data to fetch REAL values.
3. Build chart using ONLY values returned by tools — NEVER invent names.

## DATA EXTRACTION RULES (critical — prevents A/B/C placeholder bug):
- Bar chart from query_data result: x = [rec["group_col"] for rec in records], y = [rec["value_col"] for rec in records]
  where group_col and value_col are the ACTUAL column names from the records keys.
- Pie chart: labels = [rec["group_col"] for rec in records], values = [rec["value_col"] for rec in records]
- Histogram: x = result["values"] (the raw list from get_column_data)
- Heatmap: z = result["values"], x = result["columns"], y = result["columns"]
- NEVER use ["A","B","C"], ["Category 1","Category 2"], or any invented names.
- Use EXACT string values that appear in the tool result records.
NEVER put function references inside create_visualization arguments.

## VISUALIZATION STANDARDS:

### ALL CHARTS — mandatory every time:
- plot_bgcolor="#050505", paper_bgcolor="#000000"
- colorway=["#DFFF00","#00FFFF","#BF5AF2","#FF6B35","#10b981","#3b82f6","#ec4899","#f59e0b"]
- hoverlabel: bgcolor="#0D0D0D", bordercolor="#DFFF00", font.color="#fff"
- title.font.size=22, title.x=0.04, title.font.family="Space Grotesk, sans-serif"
- opacity=0.88 on all traces

### Bar charts:
- Horizontal bars (orientation="h") when >6 categories
- Sort by value (largest first for impact)
- Color each bar from colorway array: marker.color=[color list]
- Text labels: text=[formatted values], textposition="outside", textfont.color="#DFFF00"
- hovertemplate="<b>%{y}</b><br>Value: <b>%{x:,.2f}</b><extra></extra>"
- bargap=0.28, marker.line={"color":"rgba(255,255,255,0.08)","width":1}

### Line / Area:
- mode="lines+markers", line={"width":3,"shape":"spline","color":"#DFFF00"}
- markers: size=8, symbol="circle", line={"color":"#000","width":2}
- For area: fill="tozeroy", fillcolor="rgba(223,255,0,0.07)"
- hovertemplate="<b>%{x}</b><br>%{y:,.2f}<extra></extra>"

### Scatter:
- marker={"size":11,"opacity":0.88,"line":{"color":"rgba(255,255,255,0.25)","width":1}}
- Use marker.color with colorscale="Plasma" for a 3rd dimension when possible
- Add a trendline trace if data allows

### Heatmap:
- colorscale="Plasma", showscale=True, zsmooth="best"
- xgap=2, ygap=2, reversescale=False
- Annotate cells: annotations array with the z values formatted to 2dp
- hovertemplate="<b>%{x}</b> / <b>%{y}</b><br>r = %{z:.3f}<extra></extra>"

### Pie / Donut:
- hole=0.5, textinfo="label+percent", textposition="outside"
- Sort values descending before passing
- pull: [0.07 for largest slice, 0 for rest]
- marker.line={"color":"#000","width":2}
- hovertemplate="<b>%{label}</b><br>%{value:,.0f} (%{percent})<extra></extra>"

### Histogram:
- nbinsx=28, marker.color="#DFFF00", marker.opacity=0.82
- marker.line={"color":"#000","width":1}

## RESPONSE FORMAT:
One bold key finding + 2 bullet insights + one follow-up suggestion.
Under 100 words. Lead with the number, not the methodology."""

# ── Tool schemas for Gemini function calling ──────────────────
TOOL_DECLARATIONS = [
    {
        "name": "get_dataset_info",
        "description": "Get dataset metadata: shape, column names, types, sample rows, numeric stats.",
        "parameters": {"type": "OBJECT", "properties": {}, "required": []},
    },
    {
        "name": "query_data",
        "description": "Group-by and aggregate to get chart data for bar/line/pie charts.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "group_by":  {"type": "ARRAY",  "items": {"type": "STRING"}, "description": "Columns to group by"},
                "value_col": {"type": "STRING",  "description": "Column to aggregate"},
                "agg_func":  {"type": "STRING",  "enum": ["sum","mean","count","min","max","median"]},
                "limit":     {"type": "INTEGER", "description": "Max rows to return (default 50, max 100)"},
            },
            "required": ["value_col", "agg_func"],
        },
    },
    {
        "name": "get_column_data",
        "description": "Get raw column values for histograms, scatter, box plots, or unique value lists.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "column": {"type": "STRING"},
                "limit":  {"type": "INTEGER", "description": "Max values (default 300)"},
            },
            "required": ["column"],
        },
    },
    {
        "name": "get_correlation_matrix",
        "description": "Compute Pearson correlation between all numeric columns. Use for heatmaps.",
        "parameters": {"type": "OBJECT", "properties": {}, "required": []},
    },
    {
        "name": "create_visualization",
        "description": (
            "Emit a complete Plotly.js chart specification. "
            "MUST be called for every visual request. "
            "plotly_data and plotly_layout must be valid JSON strings containing real data values."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "title":         {"type": "STRING", "description": "Chart title"},
                "chart_type":    {"type": "STRING", "enum": ["bar","line","scatter","histogram","box","pie","heatmap","area","treemap","funnel","violin","waterfall"]},
                "plotly_data":   {"type": "STRING", "description": "JSON array string of Plotly trace objects with real data values"},
                "plotly_layout": {"type": "STRING", "description": "JSON object string of Plotly layout properties"},
            },
            "required": ["title", "chart_type", "plotly_data", "plotly_layout"],
        },
    },
]


def _exec_tool(df: pd.DataFrame, info: dict, name: str, args: dict) -> dict:
    if name == "get_dataset_info":
        return info
    if name == "query_data":
        records = run_aggregation(df, group_by=args.get("group_by"), value_col=args["value_col"],
                                  agg_func=args["agg_func"], limit=args.get("limit", 50))
        return {"records": records, "count": len(records)}
    if name == "get_column_data":
        return {"column": args["column"], "values": get_column_values(df, args["column"], args.get("limit", 300))}
    if name == "get_correlation_matrix":
        return correlation_matrix(df) or {"error": "Not enough numeric columns"}
    if name == "create_visualization":
        # Parse JSON strings from Gemini
        try:
            data = json.loads(args.get("plotly_data", "[]"))
        except Exception:
            data = []
        try:
            layout = json.loads(args.get("plotly_layout", "{}"))
        except Exception:
            layout = {}

        # Reject traces that contain tool-call placeholders
        def valid(v):
            if isinstance(v, str):
                return not any(k in v for k in ["get_column_data","query_data","get_dataset_info"])
            return True

        clean = [{k: v for k, v in t.items() if valid(v)} for t in data if isinstance(t, dict)]
        merged = _merge_layout(layout, args["title"])
        return {"chart": {"data": clean, "layout": merged, "title": args["title"], "chart_type": args["chart_type"]}}
    return {"error": f"Unknown tool: {name}"}


def _merge_layout(user: dict, title: str) -> dict:
    import copy
    base = copy.deepcopy(DARK_LAYOUT_BASE)
    base["title"] = {"text": title, "font": {"color":"#fff","size":22,"family":"Space Grotesk, sans-serif"}, "x": 0.04}
    for k, v in user.items():
        if isinstance(v, dict) and k in base and isinstance(base[k], dict):
            base[k] = {**base[k], **v}
        else:
            base[k] = v
    return base


def stream_agent(df: pd.DataFrame, message: str, history: list[dict]) -> Iterator[dict]:
    """Yields {type: text|chart|done|error, content}"""
    client = _get_client()
    if client is None:
        yield {"type": "error", "content": "GEMINI_API_KEY not configured"}
        return

    from google.genai import types as gtypes

    info = dataset_info(df)
    cols = info["column_names"][:25]
    context = (
        f"Dataset: {info['rows']:,} rows × {info['columns']} columns. "
        f"Columns+types: { {c: info['dtypes'][c] for c in cols} }."
    )

    tools = gtypes.Tool(function_declarations=[
        gtypes.FunctionDeclaration(**t) for t in TOOL_DECLARATIONS
    ])
    config = gtypes.GenerateContentConfig(
        system_instruction=SYSTEM,
        tools=[tools],
        temperature=0.15,
        max_output_tokens=2048,
    )

    # Build conversation history
    contents = []
    for m in (history[-6:] if len(history) > 6 else history):
        role = "user" if m["role"] == "user" else "model"
        contents.append(gtypes.Content(role=role, parts=[gtypes.Part(text=m["content"])]))
    contents.append(gtypes.Content(role="user", parts=[gtypes.Part(text=f"[Data: {context}]\n\n{message}")]))

    chart_spec = None
    last_text = ""

    # Agentic tool-use loop
    for _ in range(8):
        try:
            resp = client.models.generate_content(
                model="gemini-2.0-flash-lite",
                contents=contents,
                config=config,
            )
        except Exception as e:
            yield {"type": "error", "content": f"Gemini error: {e}"}
            return

        # Collect text parts
        for part in resp.candidates[0].content.parts:
            if hasattr(part, "text") and part.text:
                last_text += part.text

        # Collect function calls
        fn_calls = [p.function_call for p in resp.candidates[0].content.parts
                    if hasattr(p, "function_call") and p.function_call]
        if not fn_calls:
            break

        # Append model turn
        contents.append(resp.candidates[0].content)

        # Execute tools, build responses
        fn_parts = []
        for fc in fn_calls:
            args = dict(fc.args) if fc.args else {}
            result = _exec_tool(df, info, fc.name, args)
            if fc.name == "create_visualization" and "chart" in result:
                chart_spec = result["chart"]
                result = {"status": "chart created", "title": args.get("title", "")}
            fn_parts.append(gtypes.Part(
                function_response=gtypes.FunctionResponse(
                    name=fc.name,
                    response={"result": json.dumps(result, default=str)[:5000]},
                )
            ))

        contents.append(gtypes.Content(role="user", parts=fn_parts))

    # Stream the final text
    try:
        stream = client.models.generate_content_stream(
            model="gemini-2.0-flash-lite",
            contents=contents + [gtypes.Content(role="user", parts=[
                gtypes.Part(text="Now give your final concise analysis following the response format.")
            ])],
            config=gtypes.GenerateContentConfig(
                system_instruction=SYSTEM, temperature=0.3, max_output_tokens=600
            ),
        )
        for chunk in stream:
            if chunk.text:
                yield {"type": "text", "content": chunk.text}
    except Exception:
        if last_text:
            yield {"type": "text", "content": last_text}

    if chart_spec:
        yield {"type": "chart", "content": chart_spec}
    yield {"type": "done", "content": ""}
