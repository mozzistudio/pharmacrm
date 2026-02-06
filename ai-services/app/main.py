"""
PharmaCRM AI Services
=====================
Standalone AI microservice for scoring, NBA, summarization, and copilot.

Architecture:
- FastAPI for HTTP API
- scikit-learn for ML scoring models
- Structured input/output with full explainability
- No medical claims generated
- All outputs include model version and confidence

AI Boundaries (ENFORCED):
1. AI never generates medical treatment recommendations
2. AI never claims efficacy or safety of products
3. All outputs include confidence scores and factor breakdowns
4. Model versions are tracked for audit reproducibility
5. Commercial content separated from medical content
"""

from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

from app.routers import scoring, nba, summaries, copilot, segmentation

load_dotenv()

app = FastAPI(
    title="PharmaCRM AI Services",
    version="1.0.0",
    description="AI intelligence layer for pharma CRM platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restricted in production via API gateway
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("AI_SERVICE_API_KEY", "dev-key")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return api_key


# ─── ROUTES ─────────────────────────────────────────────────────

app.include_router(
    scoring.router,
    prefix="/api/v1/scoring",
    tags=["Scoring"],
    dependencies=[Depends(verify_api_key)],
)

app.include_router(
    nba.router,
    prefix="/api/v1/nba",
    tags=["Next Best Action"],
    dependencies=[Depends(verify_api_key)],
)

app.include_router(
    summaries.router,
    prefix="/api/v1/summaries",
    tags=["Summaries"],
    dependencies=[Depends(verify_api_key)],
)

app.include_router(
    copilot.router,
    prefix="/api/v1/copilot",
    tags=["Copilot"],
    dependencies=[Depends(verify_api_key)],
)

app.include_router(
    segmentation.router,
    prefix="/api/v1/segmentation",
    tags=["Segmentation"],
    dependencies=[Depends(verify_api_key)],
)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "pharmacrm-ai-services",
        "version": "1.0.0",
        "models": {
            "engagement_scoring": "v1.0",
            "prescription_propensity": "v1.0",
            "nba_engine": "v1.0",
            "segmentation": "v1.0",
        },
    }
