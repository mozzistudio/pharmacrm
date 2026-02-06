from fastapi import APIRouter
from app.schemas.scoring import HCPScoringInput, ScoringResult
from app.services.scoring_engine import compute_engagement_score, compute_prescription_propensity

router = APIRouter()


@router.post("/engagement", response_model=ScoringResult)
async def score_engagement(data: HCPScoringInput):
    """
    Compute engagement likelihood score for an HCP.

    Returns a score (0-100) with confidence and full factor breakdown.
    Every scoring decision is explainable.
    """
    result = compute_engagement_score(data.model_dump())
    return result


@router.post("/prescription-propensity", response_model=ScoringResult)
async def score_prescription_propensity(data: HCPScoringInput):
    """
    Compute prescription propensity score for an HCP.

    Based on influence level, engagement patterns, and segment membership.
    Does NOT make medical claims or predict clinical decisions.
    """
    result = compute_prescription_propensity(data.model_dump())
    return result
