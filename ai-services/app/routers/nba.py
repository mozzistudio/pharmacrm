from fastapi import APIRouter
from app.schemas.scoring import NBAInput, NBAResult
from app.services.nba_engine import compute_next_best_action

router = APIRouter()


@router.post("/recommend", response_model=NBAResult)
async def recommend_next_action(data: NBAInput):
    """
    Generate a Next Best Action recommendation for an HCP.

    Considers:
    - Consent status (hard constraint)
    - Channel effectiveness history
    - Optimal timing
    - Content suggestions (commercial only, no medical claims)

    Returns recommendation with full reasoning and factor breakdown.
    The user (field rep / manager) makes the final decision.
    """
    result = compute_next_best_action(data.model_dump())
    return result
