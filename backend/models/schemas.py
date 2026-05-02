from pydantic import BaseModel
from typing import Any, Optional


class DatasetMeta(BaseModel):
    dataset_id: str
    filename: str
    rows: int
    columns: int
    column_names: list[str]
    dtypes: dict[str, str]
    preview: list[dict]
    numeric_summary: Optional[dict] = None


class AnalyzeRequest(BaseModel):
    dataset_id: str
    message: str
    history: list[dict] = []


class ChartSpec(BaseModel):
    data: list[dict]
    layout: dict
    title: str
    chart_type: str


class AnalyzeResponse(BaseModel):
    text: str
    chart: Optional[ChartSpec] = None
    table: Optional[dict] = None
