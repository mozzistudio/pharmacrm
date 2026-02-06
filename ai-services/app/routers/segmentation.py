from fastapi import APIRouter
from app.schemas.scoring import SegmentationInput, SegmentResult
from app.services.segmentation_engine import segment_hcps

router = APIRouter()


@router.post("/classify", response_model=list[SegmentResult])
async def classify_hcps(data: SegmentationInput):
    """
    Classify HCPs into AI-driven segments.

    Each assignment includes:
    - Segment name
    - Confidence score
    - Human-readable reasoning

    Segments are engagement-focused, not clinical.
    """
    results = segment_hcps(data.hcps)
    return results
