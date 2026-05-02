"""Dataset store — persists to disk so Docker volumes survive restarts."""
import io
import uuid
import os
import json
import pathlib
import pandas as pd
import numpy as np
from typing import Optional

STORE_DIR = pathlib.Path(os.getenv("DATASET_STORE", "/tmp/ai_analyst_datasets"))
STORE_DIR.mkdir(parents=True, exist_ok=True)

META_FILE = STORE_DIR / "meta.json"

# ── helpers ──────────────────────────────────────────────────
def _meta() -> dict:
    if META_FILE.exists():
        try:
            return json.loads(META_FILE.read_text())
        except Exception:
            pass
    return {}


def _save_meta(m: dict) -> None:
    META_FILE.write_text(json.dumps(m))


# ── public API ───────────────────────────────────────────────
def load_dataset(file_bytes: bytes, filename: str) -> tuple[str, pd.DataFrame]:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "csv":
        df = pd.read_csv(io.BytesIO(file_bytes))
    elif ext in ("xlsx", "xls"):
        df = pd.read_excel(io.BytesIO(file_bytes))
    elif ext == "json":
        df = pd.read_json(io.BytesIO(file_bytes))
    elif ext == "parquet":
        df = pd.read_parquet(io.BytesIO(file_bytes))
    else:
        raise ValueError(f"Unsupported file type: .{ext}")

    dataset_id = str(uuid.uuid4())
    path = STORE_DIR / f"{dataset_id}.parquet"
    df.to_parquet(path, index=False)

    m = _meta()
    m[dataset_id] = {"filename": filename, "path": str(path)}
    _save_meta(m)

    return dataset_id, df


def get_dataset(dataset_id: str) -> Optional[pd.DataFrame]:
    m = _meta()
    if dataset_id not in m:
        return None
    path = pathlib.Path(m[dataset_id]["path"])
    if not path.exists():
        return None
    return pd.read_parquet(path)


def dataset_info(df: pd.DataFrame) -> dict:
    dtypes   = {col: str(df[col].dtype) for col in df.columns}
    preview  = df.head(5).replace({np.nan: None}).to_dict(orient="records")
    num_cols = df.select_dtypes(include="number").columns.tolist()

    numeric_summary = None
    if num_cols:
        desc = df[num_cols].describe().replace({np.nan: None})
        numeric_summary = desc.to_dict()

    return {
        "rows":            len(df),
        "columns":         len(df.columns),
        "column_names":    df.columns.tolist(),
        "dtypes":          dtypes,
        "preview":         preview,
        "numeric_summary": numeric_summary,
    }


def run_aggregation(
    df: pd.DataFrame,
    group_by: Optional[list[str]],
    value_col: str,
    agg_func: str,
    filters: Optional[dict] = None,
    limit: int = 500,
) -> list[dict]:
    if filters:
        for col, val in filters.items():
            if col in df.columns:
                df = df[df[col] == val]

    agg_map = {
        "sum": "sum", "mean": "mean", "count": "count",
        "min": "min",  "max": "max",  "median": "median",
    }

    if group_by:
        valid = [c for c in group_by if c in df.columns]
        if value_col not in df.columns:
            return []
        result = (
            df.groupby(valid)[value_col]
            .agg(agg_map.get(agg_func, "sum"))
            .reset_index()
        )
    else:
        if value_col not in df.columns:
            return []
        result = df[[value_col]].agg(agg_map.get(agg_func, "sum")).to_frame().T

    return result.head(limit).replace({np.nan: None}).to_dict(orient="records")


def get_column_values(df: pd.DataFrame, col: str, limit: int = 500) -> list:
    if col not in df.columns:
        return []
    series = df[col].dropna()
    if pd.api.types.is_numeric_dtype(series):
        return series.head(limit).tolist()
    return series.value_counts().head(limit).index.tolist()


def correlation_matrix(df: pd.DataFrame) -> Optional[dict]:
    num = df.select_dtypes(include="number")
    if num.shape[1] < 2:
        return None
    corr = num.corr().replace({np.nan: None})
    return {"columns": corr.columns.tolist(), "values": corr.values.tolist()}
