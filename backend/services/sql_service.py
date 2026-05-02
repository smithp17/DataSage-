"""DuckDB SQL execution against uploaded DataFrames."""
import duckdb
import pandas as pd
import numpy as np
from typing import Any


def run_sql(df: pd.DataFrame, sql: str, limit: int = 2000) -> dict[str, Any]:
    """
    Execute SQL against a DataFrame registered as 'df'.
    Returns {columns, rows, row_count, truncated}.
    """
    con = duckdb.connect(database=":memory:")
    con.register("df", df)

    # Safety: only allow SELECT statements
    stripped = sql.strip().lstrip(";").lstrip()
    if not stripped.upper().startswith("SELECT"):
        raise ValueError("Only SELECT statements are allowed.")

    result_df = con.execute(sql).df()
    truncated = len(result_df) > limit
    result_df = result_df.head(limit)

    # Serialize safely
    rows = result_df.replace({np.nan: None}).to_dict(orient="records")
    columns = [
        {"name": col, "dtype": str(result_df[col].dtype)}
        for col in result_df.columns
    ]

    return {
        "columns":   columns,
        "rows":      rows,
        "row_count": len(rows),
        "truncated": truncated,
    }


def profile_column(df: pd.DataFrame, col: str) -> dict[str, Any]:
    """Return statistical profile for a single column."""
    if col not in df.columns:
        return {"error": f"Column '{col}' not found"}

    series = df[col].dropna()
    total  = len(df[col])
    null_count = int(df[col].isna().sum())

    profile: dict[str, Any] = {
        "name":       col,
        "dtype":      str(df[col].dtype),
        "total":      total,
        "null_count": null_count,
        "null_pct":   round(null_count / total * 100, 1) if total else 0,
        "unique":     int(series.nunique()),
    }

    if pd.api.types.is_numeric_dtype(series):
        profile.update({
            "min":    round(float(series.min()), 4),
            "max":    round(float(series.max()), 4),
            "mean":   round(float(series.mean()), 4),
            "median": round(float(series.median()), 4),
            "std":    round(float(series.std()), 4),
            "hist":   _histogram(series),
        })
    else:
        vc = series.value_counts().head(10)
        profile["top_values"] = [
            {"value": str(k), "count": int(v)} for k, v in vc.items()
        ]

    return profile


def _histogram(series: pd.Series, bins: int = 20) -> list[dict]:
    counts, edges = pd.cut(series, bins=bins, retbins=True)
    hist = counts.value_counts(sort=False)
    return [
        {"x": round(float(edges[i]), 4), "count": int(hist.iloc[i])}
        for i in range(len(hist))
    ]
