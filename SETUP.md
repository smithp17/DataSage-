# AI Data Analyst — Setup Guide

## Prerequisites
- Python 3.11+
- Node.js 18+
- A **free** Groq API key → https://console.groq.com (sign up, click "API Keys", create one)

---

## 1. Backend (FastAPI + Llama 3.3 via Groq)

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Set your API key
# Edit backend\.env and replace the placeholder:
#   GROQ_API_KEY=gsk_...

# Start the server (port 8000)
uvicorn main:app --reload --port 8000
```

---

## 2. Frontend (React + Vite)

```bash
cd frontend

# Install packages (already done if you ran npm install)
npm install

# Start dev server (port 3000)
npm run dev
```

Open http://localhost:3000

---

## Usage

1. **Upload** a CSV, Excel, JSON, or Parquet file via the sidebar drop zone.
2. **Ask** anything in the chat — e.g.:
   - *"Give me an overview of this dataset"*
   - *"Show a bar chart of sales by region"*
   - *"What's the correlation between price and quantity?"*
   - *"Show the distribution of customer ages"*
3. **Pin** any chart to the Dashboard using the **Pin to Dashboard** button.
4. Switch to the **Dashboard** tab to view, rearrange (drag), and resize charts.
5. **Export** the full dashboard as **PDF** or **PNG** from the toolbar.

---

## Project Structure

```
AI DATA ANALYST/
├── backend/
│   ├── main.py                 # FastAPI app entry point
│   ├── routers/
│   │   ├── upload.py           # File upload endpoint
│   │   └── analyze.py         # AI analysis endpoint
│   ├── services/
│   │   ├── agent.py            # Claude agent with tool use
│   │   └── data_service.py    # pandas data processing
│   ├── models/schemas.py       # Pydantic models
│   ├── requirements.txt
│   └── .env                   # ← Add your API key here
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── AnalystPage.tsx  # Chat + upload interface
    │   │   └── DashboardPage.tsx # Dashboard grid + export
    │   ├── components/
    │   │   ├── NavBar.tsx
    │   │   ├── FileUpload.tsx
    │   │   ├── ChatInterface.tsx
    │   │   ├── ChartViewer.tsx
    │   │   ├── DatasetInfo.tsx
    │   │   └── DashboardGrid.tsx
    │   └── lib/
    │       ├── api.ts           # Axios API client
    │       └── store.ts         # Zustand global state
    └── vite.config.ts
```

---

## Supported Chart Types
Bar · Line · Area · Scatter · Histogram · Box · Pie · Heatmap (correlation)

## Supported File Formats
CSV · Excel (.xlsx / .xls) · JSON · Parquet (max 50 MB)
That's the root cause of all the problems — OneDrive is syncing your project (including node_modules = 500MB+). Let's copy only the source code to C:\datasage and free OneDrive:

Step 1 — Copy only source files (no node_modules/venv):


mkdir C:\datasage
robocopy "C:\Users\Smit\OneDrive\Desktop\AI DATA ANALYST" "C:\datasage" /E /XD node_modules venv __pycache__ .git dist .next
Step 2 — Reinstall dependencies in the new location:


cd C:\datasage\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
Step 3 — Build and run Docker from the clean path:


cd C:\datasage
$env:DOCKER_BUILDKIT = "0"
docker compose up --build
Step 4 — Free up OneDrive space (after Docker is running):


# Delete the heavy folders from OneDrive copy
Remove-Item -Recurse -Force "C:\Users\Smit\OneDrive\Desktop\AI DATA ANALYST\frontend\node_modules"
Remove-Item -Recurse -Force "C:\Users\Smit\OneDrive\Desktop\AI DATA ANALYST\backend\venv"
Remove-Item -Recurse -Force "C:\Users\Smit\OneDrive\Desktop\AI DATA ANALYST\frontend\dist"
This frees ~1-2 GB from OneDrive instantly. Going forward, always work from C:\datasage — never put code projects inside OneDrive.