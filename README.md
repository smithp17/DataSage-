# DataSage — AI Data Analytics Platform

> Prompt-driven data analysis, live visualizations, SQL queries, and interactive dashboards.  
> Built to replace Tableau for teams that prefer natural language over drag-and-drop.

![DataSage](https://img.shields.io/badge/DataSage-v2.0-DFFF00?style=for-the-badge&labelColor=000000)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Gemini](https://img.shields.io/badge/Gemini_2.0-Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-Llama_3.1-F55036?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)

---

## What is DataSage?

DataSage is a production-grade agentic AI platform that lets data analysts explore, query, and visualize datasets using plain English. Upload a CSV, ask a question, get a Tableau-quality interactive chart — live, as the AI types.

### Core Features

| Feature | Description |
|---|---|
| **AI Analyst** | Chat with your data — the AI calls tools, fetches real values, streams analysis live |
| **Live Chart Panel** | Visualization appears in real-time as the AI generates it — not at the end |
| **Data Explorer** | Browse rows with pagination + column profiling (stats, histograms, top values) |
| **SQL Editor** | Write DuckDB SQL against your dataset (`df`), export results as CSV |
| **Dashboard** | Drag, resize from any edge, pin charts, export as PDF or PNG |
| **Multi-dataset** | Upload and switch between multiple files in the same session |
| **Dual-AI Pipeline** | Gemini 2.0 Flash (primary) + Groq Llama 3.1 (fallback) working together |

---

## Tech Stack

### Backend
- **FastAPI** — async Python API with SSE streaming
- **Gemini 2.0 Flash Lite** — primary AI (better at complex Plotly JSON)
- **Groq / Llama 3.1 8B** — fast fallback when Gemini rate-limits
- **DuckDB** — in-process SQL engine for querying DataFrames
- **pandas + pyarrow** — data loading, aggregation, profiling
- **Plotly** — chart specification format (JSON sent to frontend)

### Frontend
- **React 18 + Vite + TypeScript**
- **Plotly.js** — interactive charts (zoom, pan, hover, download PNG)
- **react-grid-layout** — drag-and-drop dashboard with 8-direction resize
- **Zustand** — global state with localStorage persistence
- **Tailwind CSS** — utility-first styling
- **OpenClaw V4 Design System** — pure black bg, acid/cyan/plasma palette, glassmorphism

### Infrastructure
- **Docker + Docker Compose** — one command deployment
- **Nginx** — serves frontend, proxies API, disables buffering for SSE

---

## AI Architecture

DataSage uses a **smart dual-AI orchestrator** that routes requests based on available API keys:

```
User Prompt
     │
     ▼
┌─────────────────────────────┐
│      Smart Orchestrator     │
│  detects: hybrid/gemini/groq│
└──────────────┬──────────────┘
               │
    ┌──────────▼──────────┐
    │    HYBRID MODE      │  ← both keys set (recommended)
    │                     │
    │  Gemini 2.0 Flash   │  primary — tool calls + chart spec
    │         ↓           │
    │  Groq Llama 3.1     │  fallback on 429 / rate limit
    └─────────────────────┘
```

| Mode | Condition | Behavior |
|---|---|---|
| **Hybrid** | Both keys set | Gemini handles everything; Groq activates on rate-limit |
| **Gemini** | Only Gemini key | Full Gemini 2.0 Flash agent |
| **Groq** | Only Groq key | Full Groq Llama 3.1 agent |

The AI badge in the sidebar shows the current active mode.

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker Desktop (for containerized deployment)
- Free API keys:
  - **Groq** → [console.groq.com](https://console.groq.com) — 500k tokens/day free
  - **Gemini** → [aistudio.google.com](https://aistudio.google.com) — 1M tokens/day free

---

### Option A — Local Development

**1. Clone the repo**
```bash
git clone https://github.com/smithp17/DataSage-.git
cd DataSage-
```

**2. Backend setup**
```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env and add your API keys:
#   GROQ_API_KEY=gsk_...
#   GEMINI_API_KEY=AIza...
```

**3. Start backend** (port 8000)
```bash
uvicorn main:app --reload --port 8000
```

**4. Frontend setup**
```bash
cd frontend
npm install
npm run dev     # opens on http://localhost:3000
```

---

### Option B — Docker (Production)

**1. Add API keys to root `.env`**
```bash
# Create .env in project root
GROQ_API_KEY=gsk_your_key_here
GEMINI_API_KEY=AIza_your_key_here
```

**2. Build and run**
```bash
# If your project path has spaces, copy to a clean path first:
robocopy "C:\path\to\DataSage-" "C:\datasage" /E /XD node_modules venv __pycache__ dist .git
cd C:\datasage

# Disable BuildKit (required on Windows with spaces in paths)
$env:DOCKER_BUILDKIT = "0"
docker compose up --build
```

**3. Open** → [http://localhost](http://localhost)

---

## Project Structure

```
DataSage/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── routers/
│   │   ├── upload.py              # File upload endpoint
│   │   ├── analyze.py             # AI analysis + SSE streaming
│   │   └── datasets.py            # Dataset CRUD, preview, SQL, insights
│   ├── services/
│   │   ├── orchestrator.py        # Smart dual-AI router
│   │   ├── gemini_agent.py        # Gemini 2.0 Flash agent
│   │   ├── agent.py               # Groq Llama agent
│   │   ├── data_service.py        # Dataset storage + aggregation
│   │   └── sql_service.py         # DuckDB SQL + column profiling
│   ├── models/schemas.py          # Pydantic request/response models
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AnalystPage.tsx    # Chat + live chart split pane
│   │   │   ├── DataPage.tsx       # Table + column profile
│   │   │   ├── SQLPage.tsx        # DuckDB SQL editor
│   │   │   └── DashboardPage.tsx  # Drag/resize chart grid
│   │   ├── components/
│   │   │   └── SideNav.tsx        # Nav + dataset manager + AI badge
│   │   ├── lib/
│   │   │   ├── api.ts             # Axios client + SSE streaming
│   │   │   └── store.ts           # Zustand global state
│   │   └── types/index.ts
│   ├── Dockerfile
│   └── nginx.conf
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Supported File Formats

| Format | Extension |
|---|---|
| CSV | `.csv` |
| Excel | `.xlsx`, `.xls` |
| JSON | `.json` |
| Parquet | `.parquet` |

Max file size: **50 MB**

---

## Chart Types

Bar · Horizontal Bar · Line · Area · Scatter · Histogram · Box · Violin  
Pie · Donut · Heatmap · Treemap · Funnel · Waterfall

All charts use a dark theme with the acid/cyan/plasma color palette and are fully interactive (zoom, pan, hover, download PNG).

---

## Usage

1. **Upload** a dataset from the sidebar (drag-drop or click)
2. **Ask anything** in the Analyst chat — the AI fetches real data and streams the response
3. **Pin charts** to the Dashboard using the Pin button on the live chart panel
4. **Explore** raw data in the Data Explorer tab (Table or Column Profile view)
5. **Query** with SQL in the SQL Editor — write any SELECT against `df`
6. **Arrange** your dashboard — drag cards anywhere, resize from any edge or corner
7. **Export** the full dashboard as PDF or individual charts as PNG

### Example Prompts

```
"Give me an overview of this dataset"
"Show top 10 categories by sales — horizontal bar chart"
"What is the trend of revenue over time?"
"Show correlation heatmap of all numeric columns"
"Distribution of customer ages — histogram"
"Compare region performance — sorted bar chart"
"Which product has the highest return rate?"
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload a dataset file |
| `POST` | `/api/analyze/stream` | SSE streaming AI analysis |
| `GET` | `/api/datasets` | List all uploaded datasets |
| `GET` | `/api/dataset/{id}/preview` | Paginated data preview |
| `GET` | `/api/dataset/{id}/profile` | Full column profiling |
| `POST` | `/api/dataset/{id}/sql` | Execute DuckDB SQL |
| `POST` | `/api/dataset/{id}/insights` | Auto-generate insights (SSE) |
| `DELETE` | `/api/dataset/{id}` | Delete a dataset |
| `GET` | `/api/ai/status` | Current AI mode (hybrid/gemini/groq) |
| `GET` | `/health` | Health check |

---

## Free Tier Limits

| Provider | Model | Requests/min | Tokens/day |
|---|---|---|---|
| Gemini | gemini-2.0-flash-lite | 30 RPM | 1.5M |
| Groq | llama-3.1-8b-instant | — | 500k |

DataSage automatically switches between models when one rate-limits.

---

## Roadmap

- [ ] Multi-user authentication (JWT)
- [ ] Persistent chat history in PostgreSQL  
- [ ] Scheduled reports (email PDF exports)
- [ ] Custom chart color themes
- [ ] Join multiple datasets
- [ ] Share dashboard via public URL
- [ ] Connect to live databases (PostgreSQL, MySQL, BigQuery)

---

## License

MIT License — free to use, modify, and deploy.

---

*Built with by Smit · DataSage v2.0*
