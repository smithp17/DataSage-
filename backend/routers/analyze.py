import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.schemas import AnalyzeRequest, AnalyzeResponse
from services.data_service import get_dataset, dataset_info
from services import orchestrator
from services import agent as groq_agent

router = APIRouter(prefix="/api", tags=["analyze"])


# ── SSE streaming — all requests go through the orchestrator ──
@router.post("/analyze/stream")
async def analyze_stream(req: AnalyzeRequest):
    df = get_dataset(req.dataset_id)
    if df is None:
        raise HTTPException(404, "Dataset not found. Please re-upload.")

    def generate():
        try:
            for event in orchestrator.stream_agent(df, req.message, req.history):
                # Skip internal status events (used for UI indicators only)
                if event.get("type") == "status":
                    continue
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type':'error','content':str(e)})}\n\n"
        finally:
            yield 'data: {"type":"done","content":""}\n\n'

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no","Access-Control-Allow-Origin":"*"},
    )


# ── Blocking fallback ─────────────────────────────────────────
@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    df = get_dataset(req.dataset_id)
    if df is None:
        raise HTTPException(404, "Dataset not found.")
    try:
        result = groq_agent.run_agent(df, req.message, req.history)
    except Exception as e:
        raise HTTPException(500, str(e))
    return AnalyzeResponse(text=result["text"], chart=result.get("chart"))


# ── Dataset info ──────────────────────────────────────────────
@router.get("/dataset/{dataset_id}/info")
async def get_info(dataset_id: str):
    df = get_dataset(dataset_id)
    if df is None:
        raise HTTPException(404, "Dataset not found")
    return dataset_info(df)


# ── AI mode status ────────────────────────────────────────────
@router.get("/ai/status")
def ai_status():
    from services import gemini_agent
    import os
    mode = orchestrator.get_mode()
    return {
        "mode":   mode,
        "groq":   bool(os.getenv("GROQ_API_KEY")),
        "gemini": gemini_agent.is_available(),
        "description": {
            "hybrid": "Groq fetches data fast → Gemini builds rich charts → Groq streams text",
            "gemini": "Full Gemini 2.0 Flash agent",
            "groq":   "Full Groq Llama agent",
            "none":   "No API keys configured",
        }.get(mode, "unknown"),
    }
