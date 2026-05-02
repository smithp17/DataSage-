from fastapi import APIRouter, UploadFile, File, HTTPException
from services.data_service import load_dataset, dataset_info
from models.schemas import DatasetMeta

router = APIRouter(prefix="/api", tags=["upload"])

MAX_BYTES = 50 * 1024 * 1024  # 50 MB
ALLOWED = {"csv", "xlsx", "xls", "json", "parquet"}


@router.post("/upload", response_model=DatasetMeta)
async def upload_file(file: UploadFile = File(...)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED:
        raise HTTPException(400, f"Unsupported file type .{ext}. Allowed: {ALLOWED}")

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "File too large (max 50 MB)")

    try:
        dataset_id, df = load_dataset(content, file.filename)
    except Exception as e:
        raise HTTPException(422, f"Could not parse file: {e}")

    info = dataset_info(df)
    return DatasetMeta(
        dataset_id=dataset_id,
        filename=file.filename,
        **info,
    )
