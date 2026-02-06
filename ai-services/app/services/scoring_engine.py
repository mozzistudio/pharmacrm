"""
Engagement Scoring Engine
=========================
Uses a weighted factor model to produce explainable engagement scores.

Model: Weighted multi-factor scoring (v1.0)
Input: Structured HCP data from CRM
Output: Score (0-100), confidence (0-1), factor breakdown

Each factor has:
- name: human-readable identifier
- weight: how much it contributes to the final score
- value: the computed raw value for this factor
- description: plain English explanation

This is NOT a black box. Every score can be traced to its input factors.
"""

from datetime import datetime, timedelta
from typing import Optional
import hashlib
import json


MODEL_VERSION = "scoring-v1.0"


def compute_engagement_score(data: dict) -> dict:
    """Compute engagement likelihood score with full explainability."""
    factors = []
    total_weight = 0
    weighted_sum = 0

    # Factor 1: Interaction recency (weight: 0.25)
    recency_score, recency_desc = _score_recency(data.get("lastInteractionDate"))
    factors.append({
        "name": "interaction_recency",
        "weight": 0.25,
        "value": recency_score,
        "description": recency_desc,
    })
    weighted_sum += 0.25 * recency_score
    total_weight += 0.25

    # Factor 2: Interaction frequency (weight: 0.20)
    freq_score, freq_desc = _score_frequency(data.get("interactionCount", 0))
    factors.append({
        "name": "interaction_frequency",
        "weight": 0.20,
        "value": freq_score,
        "description": freq_desc,
    })
    weighted_sum += 0.20 * freq_score
    total_weight += 0.20

    # Factor 3: Channel diversity (weight: 0.15)
    channel_score, channel_desc = _score_channel_diversity(data.get("channelHistory", []))
    factors.append({
        "name": "channel_diversity",
        "weight": 0.15,
        "value": channel_score,
        "description": channel_desc,
    })
    weighted_sum += 0.15 * channel_score
    total_weight += 0.15

    # Factor 4: Sentiment trend (weight: 0.15)
    sentiment_score, sentiment_desc = _score_sentiment(data.get("channelHistory", []))
    factors.append({
        "name": "sentiment_trend",
        "weight": 0.15,
        "value": sentiment_score,
        "description": sentiment_desc,
    })
    weighted_sum += 0.15 * sentiment_score
    total_weight += 0.15

    # Factor 5: Influence level (weight: 0.15)
    influence_score, influence_desc = _score_influence(data.get("influenceLevel"))
    factors.append({
        "name": "influence_level",
        "weight": 0.15,
        "value": influence_score,
        "description": influence_desc,
    })
    weighted_sum += 0.15 * influence_score
    total_weight += 0.15

    # Factor 6: Consent breadth (weight: 0.10)
    consent_score, consent_desc = _score_consent(data.get("consentStatus", []))
    factors.append({
        "name": "consent_breadth",
        "weight": 0.10,
        "value": consent_score,
        "description": consent_desc,
    })
    weighted_sum += 0.10 * consent_score
    total_weight += 0.10

    # Final score
    final_score = round((weighted_sum / total_weight) * 100, 1) if total_weight > 0 else 0
    final_score = max(0, min(100, final_score))

    # Confidence based on data completeness
    data_points = sum([
        1 if data.get("lastInteractionDate") else 0,
        1 if data.get("interactionCount", 0) > 0 else 0,
        1 if len(data.get("channelHistory", [])) > 0 else 0,
        1 if data.get("influenceLevel") else 0,
        1 if len(data.get("consentStatus", [])) > 0 else 0,
    ])
    confidence = round(data_points / 5, 2)

    return {
        "hcpId": data["hcpId"],
        "scoreType": "engagement_likelihood",
        "score": final_score,
        "confidence": confidence,
        "factors": factors,
        "modelVersion": MODEL_VERSION,
        "computedAt": datetime.utcnow().isoformat(),
    }


def compute_prescription_propensity(data: dict) -> dict:
    """Compute prescription propensity score."""
    factors = []

    # Similar factor-based approach for prescription propensity
    influence_map = {"key_opinion_leader": 0.9, "high": 0.7, "medium": 0.5, "low": 0.3}
    influence_val = influence_map.get(data.get("influenceLevel", "medium"), 0.5)

    factors.append({
        "name": "influence_level",
        "weight": 0.3,
        "value": influence_val,
        "description": f"Influence level: {data.get('influenceLevel', 'unknown')}",
    })

    interaction_val = min(data.get("interactionCount", 0) / 20, 1.0)
    factors.append({
        "name": "interaction_engagement",
        "weight": 0.3,
        "value": interaction_val,
        "description": f"{data.get('interactionCount', 0)} total interactions",
    })

    segment_val = 0.5 + (len(data.get("segments", [])) * 0.1)
    segment_val = min(segment_val, 1.0)
    factors.append({
        "name": "segment_alignment",
        "weight": 0.2,
        "value": segment_val,
        "description": f"Member of {len(data.get('segments', []))} relevant segments",
    })

    specialty_val = 0.6  # Default; would be calibrated per therapeutic area
    factors.append({
        "name": "specialty_relevance",
        "weight": 0.2,
        "value": specialty_val,
        "description": f"Specialty: {data.get('specialty', 'unknown')}",
    })

    weighted_sum = sum(f["weight"] * f["value"] for f in factors)
    total_weight = sum(f["weight"] for f in factors)
    final_score = round((weighted_sum / total_weight) * 100, 1) if total_weight > 0 else 0

    return {
        "hcpId": data["hcpId"],
        "scoreType": "prescription_propensity",
        "score": max(0, min(100, final_score)),
        "confidence": 0.7,
        "factors": factors,
        "modelVersion": MODEL_VERSION,
        "computedAt": datetime.utcnow().isoformat(),
    }


# ─── Factor scoring functions ──────────────────────────────────

def _score_recency(last_date: Optional[str]) -> tuple[float, str]:
    if not last_date:
        return 0.1, "No prior interactions recorded"
    try:
        last = datetime.fromisoformat(last_date.replace("Z", "+00:00"))
        days_ago = (datetime.now(last.tzinfo) - last).days
        if days_ago <= 7:
            return 0.95, f"Last interaction {days_ago} days ago (very recent)"
        elif days_ago <= 30:
            return 0.75, f"Last interaction {days_ago} days ago (recent)"
        elif days_ago <= 90:
            return 0.45, f"Last interaction {days_ago} days ago (moderate)"
        else:
            return 0.15, f"Last interaction {days_ago} days ago (stale)"
    except (ValueError, TypeError):
        return 0.3, "Unable to parse last interaction date"


def _score_frequency(count: int) -> tuple[float, str]:
    if count == 0:
        return 0.1, "No interactions recorded"
    elif count <= 3:
        return 0.4, f"{count} interactions (low frequency)"
    elif count <= 10:
        return 0.7, f"{count} interactions (moderate frequency)"
    elif count <= 25:
        return 0.85, f"{count} interactions (high frequency)"
    else:
        return 0.95, f"{count} interactions (very high frequency)"


def _score_channel_diversity(history: list[dict]) -> tuple[float, str]:
    if not history:
        return 0.1, "No channel history"
    channels = set(h.get("channel") for h in history if h.get("channel"))
    diversity = len(channels)
    if diversity >= 4:
        return 0.95, f"Engaged across {diversity} channels (excellent diversity)"
    elif diversity >= 3:
        return 0.75, f"Engaged across {diversity} channels (good diversity)"
    elif diversity >= 2:
        return 0.5, f"Engaged across {diversity} channels (moderate)"
    else:
        return 0.3, f"Single channel engagement ({list(channels)[0] if channels else 'none'})"


def _score_sentiment(history: list[dict]) -> tuple[float, str]:
    sentiments = [h["sentiment"] for h in history if h.get("sentiment") is not None]
    if not sentiments:
        return 0.5, "No sentiment data available (neutral assumed)"
    avg = sum(sentiments) / len(sentiments)
    normalized = (avg + 1) / 2  # Convert -1..1 to 0..1
    if normalized > 0.7:
        return normalized, f"Positive sentiment trend (avg: {avg:.2f})"
    elif normalized > 0.4:
        return normalized, f"Neutral sentiment (avg: {avg:.2f})"
    else:
        return normalized, f"Negative sentiment trend (avg: {avg:.2f})"


def _score_influence(level: Optional[str]) -> tuple[float, str]:
    mapping = {
        "key_opinion_leader": (0.95, "Key Opinion Leader — highest strategic value"),
        "high": (0.75, "High influence — strong strategic importance"),
        "medium": (0.5, "Medium influence — standard engagement priority"),
        "low": (0.25, "Low influence — lower engagement priority"),
    }
    return mapping.get(level or "medium", (0.5, f"Unknown influence level: {level}"))


def _score_consent(consents: list[dict]) -> tuple[float, str]:
    granted = [c for c in consents if c.get("status") == "granted"]
    if not consents:
        return 0.1, "No consent records"
    ratio = len(granted) / max(len(consents), 1)
    return ratio, f"{len(granted)} of {len(consents)} consent types granted"
