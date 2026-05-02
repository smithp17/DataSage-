"""Dataset management — list, preview, profile, delete, SQL, auto-insights."""
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.data_service import get_dataset, dataset_info, _meta, _save_meta, STORE_DIR
from services.sql_service   import run_sql, profile_column
from services               import agent as agent_service
import pathlib

router = APIRouter(prefix="/api", tags=["datasets"])


# ── List all datasets ─────────────────────────────────────────
@router.get("/datasets")
def list_datasets():
    m = _meta()
    return [
        {"dataset_id": did, "filename": v["filename"]}
        for did, v in m.items()
    ]


# ── Dataset info / schema ─────────────────────────────────────
@router.get("/dataset/{dataset_id}/info")
def get_info(dataset_id: str):
    df = get_dataset(dataset_id)
    if df is None:
        raise HTTPException(404, "Dataset not found")
    return dataset_info(df)


# ── Paginated data preview ────────────────────────────────────
@router.get("/dataset/{dataset_id}/preview")
def preview(dataset_id: str, page: int = 1, page_size: int = 100):
    df = get_dataset(dataset_id)
    if df is None:
        raise HTTPException(404, "Dataset not found")

    total  = len(df)
    start  = (page - 1) * page_size
    end    = start + page_size
    slice_ = df.iloc[start:end]

    import numpy as np
    rows = slice_.replace({float("nan"): None}).to_dict(orient="records")
    cols = [{"name": c, "dtype": str(df[c].dtype)} for c in df.columns]

    return {
        "columns":    cols,
        "rows":       rows,
        "total_rows": total,
        "page":       page,
        "page_size":  page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


# ── Column profile ────────────────────────────────────────────
@router.get("/dataset/{dataset_id}/profile/{column}")
def column_profile(dataset_id: str, column: str):
    df = get_dataset(dataset_id)
    if df is None:
        raise HTTPException(404, "Dataset not found")
    return profile_column(df, column)


# ── Full dataset profile (all columns) ───────────────────────
@router.get("/dataset/{dataset_id}/profile")
def full_profile(dataset_id: str):
    df = get_dataset(dataset_id)
    if df is None:
        raise HTTPException(404, "Dataset not found")
    return [profile_column(df, c) for c in df.columns]


# ── SQL execution ─────────────────────────────────────────────
class SQLRequest(BaseModel):
    sql: str

@router.post("/dataset/{dataset_id}/sql")
def execute_sql(dataset_id: str, req: SQLRequest):
    df = get_dataset(dataset_id)
    if df is None:
        raise HTTPException(404, "Dataset not found")
    try:
        result = run_sql(df, req.sql)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(422, f"SQL error: {e}")
    return result


# ── Auto-insights (streaming) ─────────────────────────────────
@router.post("/dataset/{dataset_id}/insights")
def auto_insights(dataset_id: str):
    df = get_dataset(dataset_id)
    if df is None:
        raise HTTPException(404, "Dataset not found")

    prompt = (
        "You are analysing this dataset for the first time. "
        "1) Summarise what the dataset is about. "
        "2) Identify the 3 most interesting patterns or insights. "
        "3) Create ONE compelling visualization that best represents the data. "
        "Be concise and executive-level."
    )

    def generate():
        try:
            for event in agent_service.stream_agent(df, prompt, []):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type':'error','content':str(e)})}\n\n"
        finally:
            yield 'data: {"type":"done","content":""}\n\n'

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Delete dataset ────────────────────────────────────────────
@router.delete("/dataset/{dataset_id}")
def delete_dataset(dataset_id: str):
    m = _meta()
    if dataset_id not in m:
        raise HTTPException(404, "Dataset not found")
    path = pathlib.Path(m[dataset_id]["path"])
    if path.exists():
        path.unlink()
    del m[dataset_id]
    _save_meta(m)
    return {"status": "deleted"}
