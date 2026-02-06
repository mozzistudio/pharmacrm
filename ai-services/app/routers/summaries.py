"""
Account Summary Generation
===========================
Generates natural language summaries of HCP accounts.

CRITICAL CONSTRAINT:
- Summaries MUST NOT contain medical claims
- Summaries MUST NOT recommend treatments
- Summaries MUST focus on engagement patterns and commercial relationship
"""

from fastapi import APIRouter
from datetime import datetime
import hashlib
import json

from app.schemas.scoring import SummaryInput, SummaryResult

router = APIRouter()

MODEL_VERSION = "summary-v1.0"


@router.post("/account", response_model=SummaryResult)
async def generate_account_summary(data: SummaryInput):
    """
    Generate a natural language summary of an HCP account.

    Summary covers:
    - Engagement pattern overview
    - Channel preferences
    - Segment membership
    - Key metrics

    Summary explicitly EXCLUDES:
    - Medical treatment recommendations
    - Product efficacy claims
    - Clinical decision guidance
    """
    input_hash = hashlib.sha256(
        json.dumps(data.model_dump(), sort_keys=True, default=str).encode()
    ).hexdigest()

    summary_parts = []
    insights = []

    # Engagement overview
    interaction_count = data.interactionCount
    if interaction_count == 0:
        summary_parts.append(
            "This HCP has no recorded interactions. "
            "Consider initiating outreach through consented channels."
        )
        insights.append("No engagement history — new prospect")
    elif interaction_count < 5:
        summary_parts.append(
            f"This HCP has {interaction_count} recorded interactions, "
            f"indicating early-stage engagement."
        )
        insights.append("Early-stage engagement")
    elif interaction_count < 15:
        summary_parts.append(
            f"This HCP has {interaction_count} recorded interactions, "
            f"showing moderate engagement levels."
        )
        insights.append("Moderate engagement established")
    else:
        summary_parts.append(
            f"This HCP has {interaction_count} recorded interactions, "
            f"indicating strong, established engagement."
        )
        insights.append("Strong engagement relationship")

    # Specialty context
    if data.specialty:
        specialty_display = data.specialty.replace("_", " ").title()
        summary_parts.append(f"Specialty: {specialty_display}.")
        insights.append(f"Specialty: {specialty_display}")

    # Influence level
    if data.influenceLevel:
        influence_display = data.influenceLevel.replace("_", " ").title()
        summary_parts.append(f"Classified as {influence_display} influence.")
        if data.influenceLevel == "key_opinion_leader":
            insights.append("Key Opinion Leader — strategic engagement priority")

    # Channel analysis
    if data.channelHistory:
        channels = {}
        for h in data.channelHistory:
            ch = h.channel.replace("_", " ").title()
            channels[ch] = channels.get(ch, 0) + 1

        channel_str = ", ".join(
            f"{ch} ({count})" for ch, count in
            sorted(channels.items(), key=lambda x: -x[1])
        )
        summary_parts.append(f"Channel distribution: {channel_str}.")

        # Identify preferred channel
        preferred = max(channels, key=channels.get)
        insights.append(f"Preferred channel: {preferred}")

        # Sentiment analysis
        sentiments = [
            h.sentiment for h in data.channelHistory
            if h.sentiment is not None
        ]
        if sentiments:
            avg_sentiment = sum(sentiments) / len(sentiments)
            if avg_sentiment > 0.3:
                insights.append("Positive sentiment trend")
            elif avg_sentiment < -0.3:
                insights.append("Declining sentiment — attention required")

    # Segment membership
    if data.segments:
        summary_parts.append(
            f"Segment membership: {', '.join(data.segments)}."
        )

    # Previous scores
    if data.previousScores:
        latest_score = data.previousScores[0]
        if "score" in latest_score:
            summary_parts.append(
                f"Latest AI engagement score: {latest_score['score']}."
            )

    summary = " ".join(summary_parts)

    return SummaryResult(
        entityId=data.hcpId,
        entityType="hcp",
        summary=summary,
        keyInsights=insights,
        generatedAt=datetime.utcnow().isoformat(),
        modelVersion=MODEL_VERSION,
        inputDataHash=input_hash,
    )
