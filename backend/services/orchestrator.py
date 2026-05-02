"""
Smart dual-AI orchestrator.

Pipeline (when BOTH keys are set):
  1. Groq  → fast tool-use loop: fetches real data from the dataset
  2. Gemini → receives actual data values + generates rich Plotly chart spec
  3. Groq  → streams concise text analysis

Why split this way:
- Groq is 10-100× faster for simple tool calls (get rows, aggregate, correlate)
- Gemini is far better at producing complex nested JSON (Plotly specs) — no embedded-reference bugs
- Groq streams text faster, keeping the UI responsive

Degraded modes:
- Gemini only → full Gemini agent
- Groq only   → full Groq agent
- Neither     → error
"""
import json
import os
from typing import Iterator
import pandas as pd

from services.data_service import (
    dataset_info, run_aggregation, get_column_values, correlation_matrix,
)
import services.agent        as groq_agent
import services.gemini_agent as gemini_agent

_CHART_KEYWORDS = {
    "chart","plot","graph","visual","visuali","show","bar","line","pie","donut",
    "scatter","histogram","heatmap","trend","distribution","compare","correlation",
    "treemap","funnel","box","violin","area","breakdown","overview",
}

def _wants_chart(message: str) -> bool:
    low = message.lower()
    return any(kw in low for kw in _CHART_KEYWORDS)


# ── Groq: data-collection-only loop ──────────────────────────
_COLLECT_PROMPT = """You are a data retrieval agent. Call the provided tools to fetch the data needed to answer the user's request.
Do NOT generate any chart. Just call tools and stop.
Return a plain text summary of what data you collected."""

_COLLECT_TOOLS = [
    {"type":"function","function":{"name":"get_dataset_info","description":"Dataset shape, columns, types, stats.","parameters":{"type":"object","properties":{},"required":[]}}},
    {"type":"function","function":{"name":"query_data","description":"Group-by aggregate — for bar/line/pie data.","parameters":{"type":"object","properties":{"group_by":{"type":"array","items":{"type":"string"}},"value_col":{"type":"string"},"agg_func":{"type":"string","enum":["sum","mean","count","min","max","median"]},"limit":{"type":"integer"}},"required":["value_col","agg_func"]}}},
    {"type":"function","function":{"name":"get_column_data","description":"Raw column values for histograms/scatter.","parameters":{"type":"object","properties":{"column":{"type":"string"},"limit":{"type":"integer"}},"required":["column"]}}},
    {"type":"function","function":{"name":"get_correlation_matrix","description":"Pearson correlation matrix for heatmaps.","parameters":{"type":"object","properties":{},"required":[]}}},
]

def _exec_data_tool(df: pd.DataFrame, info: dict, name: str, inp: dict) -> dict:
    if name == "get_dataset_info":
        return info
    if name == "query_data":
        records = run_aggregation(df, group_by=inp.get("group_by"), value_col=inp["value_col"],
                                  agg_func=inp["agg_func"], limit=inp.get("limit", 50))
        return {"records": records}
    if name == "get_column_data":
        return {"column": inp["column"], "values": get_column_values(df, inp["column"], inp.get("limit", 300))}
    if name == "get_correlation_matrix":
        return correlation_matrix(df) or {"error": "Not enough numeric columns"}
    return {"error": f"Unknown: {name}"}


def _groq_collect_data(df: pd.DataFrame, message: str, info: dict) -> list[dict]:
    """
    Run Groq tool-use loop to collect data.
    Returns a list of {tool_name, result} dicts.
    """
    from groq import Groq, RateLimitError
    client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

    TYPE_SHORT = {"int64":"int","float64":"float","object":"str","bool":"bool"}
    cols = info["column_names"][:12]
    ctx = f"{info['rows']}r×{info['columns']}c cols={({c:TYPE_SHORT.get(info['dtypes'][c],info['dtypes'][c][:4]) for c in cols})}"

    messages = [
        {"role": "system", "content": _COLLECT_PROMPT},
        {"role": "user", "content": f"Dataset: {ctx}\n\nFetch data for: {message}"},
    ]

    collected: list[dict] = []

    for _ in range(5):
        try:
            resp = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                tools=_COLLECT_TOOLS,
                tool_choice="auto",
                max_tokens=800,
                temperature=0.1,
            )
        except Exception:
            break

        choice = resp.choices[0]
        msg = choice.message

        if choice.finish_reason != "tool_calls" or not msg.tool_calls:
            break

        messages.append({
            "role": "assistant", "content": msg.content or "",
            "tool_calls": [{"id": tc.id, "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                           for tc in msg.tool_calls],
        })

        for tc in msg.tool_calls:
            try:
                inp = json.loads(tc.function.arguments)
            except Exception:
                inp = {}
            result = _exec_data_tool(df, info, tc.function.name, inp)
            collected.append({"tool": tc.function.name, "args": inp, "result": result})
            messages.append({"role": "tool", "tool_call_id": tc.id,
                             "content": json.dumps(result, default=str)[:3000]})

    return collected


# ── Gemini: chart-only generation from real data ──────────────
_CHART_SYSTEM = """You are a Plotly.js chart expert. Given real data values, generate ONE perfect chart spec.

Return ONLY a JSON object with keys: title, chart_type, plotly_data, plotly_layout.
No explanation. No markdown. Pure JSON only.

Dark theme rules:
- plot_bgcolor="#050505" paper_bgcolor="#000000" font.color="#e2e8f0"
- colorway=["#DFFF00","#00FFFF","#BF5AF2","#FF6B35","#10b981","#3b82f6","#ec4899","#f59e0b"]
- hoverlabel: bgcolor="#0D0D0D" bordercolor="#DFFF00" font.color="#fff"
- title.font.size=20 title.x=0.04
- Bar: textposition="outside" bargap=0.28 marker.color=array from colorway
- Line: mode="lines+markers" line.width=3 line.shape="spline" fill="tozeroy" for area
- Pie: hole=0.5 textinfo="label+percent" pull largest slice 0.07
- Heatmap: colorscale="Plasma" xgap=2 ygap=2
chart_type must be one of: bar, line, scatter, histogram, box, pie, heatmap, area, treemap, funnel, violin"""


def _gemini_build_chart(message: str, collected_data: list[dict]) -> dict | None:
    """Ask Gemini to produce a Plotly chart spec from the collected data."""
    if not gemini_agent.is_available():
        return None

    data_str = json.dumps(collected_data, default=str)[:6000]
    prompt = (
        f"User request: {message}\n\n"
        f"Collected data:\n{data_str}\n\n"
        "Generate the chart JSON now."
    )

    try:
        from google import genai
        from google.genai import types as gt

        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY", ""))
        resp = client.models.generate_content(
            model="gemini-2.0-flash-lite",
            contents=[prompt],
            config=gt.GenerateContentConfig(
                system_instruction=_CHART_SYSTEM,
                temperature=0.1,
                max_output_tokens=2048,
            ),
        )
        raw = resp.text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        spec = json.loads(raw)

        # Validate required keys
        if not all(k in spec for k in ("title", "chart_type", "plotly_data")):
            return None

        data = spec.get("plotly_data", [])
        if isinstance(data, str):
            data = json.loads(data)
        layout = spec.get("plotly_layout", {})
        if isinstance(layout, str):
            layout = json.loads(layout)

        # Apply dark theme
        merged = gemini_agent._merge_layout(layout, spec["title"])
        return {
            "data":       data,
            "layout":     merged,
            "title":      spec["title"],
            "chart_type": spec.get("chart_type", "bar"),
        }
    except Exception:
        return None


# ── Groq: stream text analysis ────────────────────────────────
def _groq_stream_text(message: str, collected_data: list[dict], info: dict) -> Iterator[str]:
    from groq import Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

    data_summary = json.dumps(
        [{"tool": d["tool"], "result": d["result"]} for d in collected_data],
        default=str
    )[:2000]

    prompt = (
        f"Data collected:\n{data_summary}\n\n"
        f"User asked: {message}\n\n"
        "Reply with: 1 bold key finding + 2 bullet insights + 1 follow-up suggestion. Under 80 words."
    )
    try:
        stream = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            max_tokens=400,
            temperature=0.3,
        )
        for chunk in stream:
            text = chunk.choices[0].delta.content
            if text:
                yield text
    except Exception:
        yield "Analysis complete. Check the visualization for insights."


# ── Public API ─────────────────────────────────────────────────
def get_mode() -> str:
    g = gemini_agent.is_available()
    q = bool(os.getenv("GROQ_API_KEY"))
    if g and q:  return "hybrid"   # Gemini primary, Groq fallback
    if g:        return "gemini"
    if q:        return "groq"
    return "none"


def stream_agent(df: pd.DataFrame, message: str, history: list[dict]) -> Iterator[dict]:
    """
    Routing logic:
    - hybrid (both keys): Gemini runs full agent (tool calls + chart + text).
                          If Gemini fails/rate-limits, Groq handles it.
    - gemini only:        Full Gemini agent.
    - groq only:          Full Groq agent.
    - none:               Error.

    The previous "Groq collects data → Gemini charts" hybrid hit Groq TPM limits
    because accumulated tool results ballooned the context. Gemini 2.0 Flash has
    a 32k context and 1M tokens/day free — it handles the full flow better.
    """
    mode = get_mode()

    if mode == "none":
        yield {"type": "error", "content": "No AI keys configured. Set GROQ_API_KEY or GEMINI_API_KEY in backend/.env"}
        return

    if mode == "groq":
        yield from groq_agent.stream_agent(df, message, history)
        return

    # ── Gemini (or hybrid with Gemini primary) ────────────────
    # Gemini yields error events rather than raising — intercept them here
    def _run_gemini():
        try:
            yield from gemini_agent.stream_agent(df, message, history)
        except Exception as e:
            yield {"type": "error", "content": str(e)}

    gemini_failed = False
    for event in _run_gemini():
        if event.get("type") == "error":
            err = event.get("content", "")
            is_rate_limit = any(k in err for k in ("429", "quota", "RESOURCE_EXHAUSTED", "rate limit", "exhausted"))
            if mode == "hybrid" and is_rate_limit:
                # Gemini rate-limited — transparently switch to Groq
                gemini_failed = True
                break
            else:
                yield event
                return
        else:
            yield event

    if gemini_failed:
        yield from groq_agent.stream_agent(df, message, history)
