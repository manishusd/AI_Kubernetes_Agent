# AI Kubernetes Agent

On-demand Kubernetes troubleshooting with AI.

## Architecture

```text
Frontend (Next.js)
    ↓
FastAPI Backend (Orchestrator)
    ↓
Kubernetes Investigation Layer
    ↓
AI Kubernetes Agent
    ↓
LLM Reasoning (OpenRouter via InsForge)
    ↓
Root Cause + Suggested Fix
    ↓
Frontend Diagnosis
```

## Project Structure

```text
ai-kubernetes-agent/
├── backend/          # FastAPI orchestrator
├── frontend/         # Next.js UI
├── docs/             # Documentation
├── prompts/          # AI prompt templates
├── docker-compose.yml
└── README.md
```

## Quick Start

### Docker (recommended)

```bash
docker compose up --build
```

Access:

- Frontend: http://localhost:3000
- Backend health: http://localhost:8000/health

### Local Development

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
# If .venv came from another OS (e.g., Windows -> Linux), recreate it first:
# rm -rf .venv && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

### Backend (`backend/.env`)

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
KUBECONFIG_PATH=
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_INSFORGE_URL=
NEXT_PUBLIC_INSFORGE_ANON_KEY=
```

## API Endpoints

| Method | Path          | Description                          |
|--------|---------------|--------------------------------------|
| GET    | `/health`     | Service health check                 |
| POST   | `/investigate`| Collect Kubernetes troubleshooting evidence |

## Tech Stack

- **Backend:** FastAPI, Python 3.12+, Uvicorn, Pydantic, Loguru, HTTPX
- **Frontend:** Next.js, TypeScript, Tailwind CSS, Axios, React Query
- **Infrastructure:** Docker, Docker Compose

## Status

This is the foundation setup. Kubernetes investigation, AI reasoning, and InsForge integration are not yet implemented.
