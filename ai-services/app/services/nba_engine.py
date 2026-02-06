"""
Next Best Action Engine
=======================
Recommends the optimal next engagement action for an HCP.

Model: Rule-based + weighted factor model (v1.0)
Input: HCP data, user context, interaction history
Output: Recommended channel, timing, content, with full reasoning

NBA NEVER:
- Generates medical treatment recommendations
- Claims product efficacy
- Overrides consent restrictions
- Hides its reasoning from users
"""

from datetime import datetime, timedelta
from typing import Optional


MODEL_VERSION = "nba-v1.0"

# Channel priority based on pharma engagement effectiveness
CHANNEL_PRIORITY = {
    "in_person_visit": 0.9,
    "remote_detailing": 0.8,
    "phone": 0.7,
    "email": 0.6,
    "webinar": 0.5,
    "conference": 0.4,
}


def compute_next_best_action(data: dict) -> dict:
    """Determine the recommended next action for engaging an HCP."""
    factors = []

    # Get consented channels
    consented = _get_consented_channels(data.get("consentStatus", []))

    # Score each consented channel
    channel_scores = {}
    for channel in consented:
        score, channel_factors = _score_channel(channel, data)
        channel_scores[channel] = score
        factors.extend(channel_factors)

    if not channel_scores:
        return _no_action_response(data["hcpId"], data["userId"])

    # Select best channel
    best_channel = max(channel_scores, key=channel_scores.get)
    best_score = channel_scores[best_channel]

    # Determine timing
    timing, timing_reason = _recommend_timing(data)
    factors.append({
        "name": "recommended_timing",
        "weight": 0.1,
        "value": 0.5,
        "description": timing_reason,
    })

    # Generate content suggestion (commercial only, no medical claims)
    content = _suggest_content(data, best_channel)

    # Build reasoning
    reasoning_parts = [
        f"Recommended {best_channel} based on:",
        f"- Consent status: {best_channel} is consented",
    ]

    if data.get("lastInteractionDate"):
        reasoning_parts.append(
            f"- Last interaction: {data['lastInteractionDate']}"
        )

    if data.get("interactionCount", 0) > 0:
        reasoning_parts.append(
            f"- Total interactions: {data['interactionCount']}"
        )

    # Recent channel preference
    recent_channels = [h["channel"] for h in data.get("channelHistory", [])[:5]]
    if recent_channels:
        reasoning_parts.append(
            f"- Recent channels used: {', '.join(set(recent_channels))}"
        )

    reasoning = "\n".join(reasoning_parts)

    # Confidence
    confidence = round(min(best_score / 100, 0.95), 2)

    return {
        "hcpId": data["hcpId"],
        "recommendedChannel": best_channel,
        "recommendedTiming": timing.isoformat(),
        "suggestedContent": content,
        "reasoning": reasoning,
        "confidence": confidence,
        "factors": factors,
        "modelVersion": MODEL_VERSION,
    }


def _get_consented_channels(consents: list[dict]) -> list[str]:
    """Map consent types to engagement channels."""
    consent_channel_map = {
        "email": "email",
        "phone": "phone",
        "visit": "in_person_visit",
        "remote_detailing": "remote_detailing",
    }

    granted = set()
    for consent in consents:
        if consent.get("status") == "granted":
            channel = consent_channel_map.get(consent.get("consent_type", ""))
            if channel:
                granted.add(channel)

    return list(granted)


def _score_channel(channel: str, data: dict) -> tuple[float, list[dict]]:
    """Score a specific channel for this HCP."""
    factors = []
    score = CHANNEL_PRIORITY.get(channel, 0.5) * 100

    # Check past effectiveness on this channel
    channel_interactions = [
        h for h in data.get("channelHistory", [])
        if h.get("channel") == channel
    ]

    if channel_interactions:
        sentiments = [
            h["sentiment"] for h in channel_interactions
            if h.get("sentiment") is not None
        ]
        if sentiments:
            avg_sentiment = sum(sentiments) / len(sentiments)
            sentiment_boost = avg_sentiment * 15
            score += sentiment_boost
            factors.append({
                "name": f"{channel}_sentiment",
                "weight": 0.2,
                "value": (avg_sentiment + 1) / 2,
                "description": f"Average sentiment on {channel}: {avg_sentiment:.2f}",
            })

        # Frequency on this channel
        freq_factor = min(len(channel_interactions) / 10, 1.0)
        factors.append({
            "name": f"{channel}_frequency",
            "weight": 0.15,
            "value": freq_factor,
            "description": f"{len(channel_interactions)} past {channel} interactions",
        })
    else:
        # No history = potential for diversification
        factors.append({
            "name": f"{channel}_novelty",
            "weight": 0.1,
            "value": 0.4,
            "description": f"No prior {channel} interactions — diversification opportunity",
        })

    return score, factors


def _recommend_timing(data: dict) -> tuple[datetime, str]:
    """Determine optimal timing for next interaction."""
    now = datetime.utcnow()

    last_date = data.get("lastInteractionDate")
    if not last_date:
        return now + timedelta(days=1), "No prior interactions — suggest near-term engagement"

    try:
        last = datetime.fromisoformat(last_date.replace("Z", "+00:00"))
        days_since = (now - last.replace(tzinfo=None)).days

        if days_since < 7:
            target = now + timedelta(days=7 - days_since)
            return target, f"Last contact {days_since} days ago — wait for 1-week gap"
        elif days_since < 30:
            return now + timedelta(days=2), f"Last contact {days_since} days ago — follow up soon"
        else:
            return now + timedelta(days=1), f"Last contact {days_since} days ago — re-engage promptly"
    except (ValueError, TypeError):
        return now + timedelta(days=3), "Unable to determine last contact — suggest standard timing"


def _suggest_content(data: dict, channel: str) -> str:
    """
    Generate content suggestion based on context.
    IMPORTANT: No medical claims, no efficacy statements, no treatment recommendations.
    """
    specialty = data.get("specialty", "").replace("_", " ").title()
    influence = data.get("influenceLevel", "medium")
    interaction_count = data.get("interactionCount", 0)

    if interaction_count == 0:
        return (
            f"Introductory engagement for {specialty} specialist. "
            f"Focus on understanding their practice priorities and information needs."
        )

    if influence in ("key_opinion_leader", "high"):
        return (
            f"Strategic engagement with high-influence {specialty} specialist. "
            f"Discuss latest clinical data and peer engagement opportunities. "
            f"Consider invitations to advisory boards or speaker programs."
        )

    return (
        f"Continue relationship-building with {specialty} specialist. "
        f"Follow up on topics from previous interactions. "
        f"Share relevant educational resources aligned with their interests."
    )


def _no_action_response(hcp_id: str, user_id: str) -> dict:
    return {
        "hcpId": hcp_id,
        "recommendedChannel": "none",
        "recommendedTiming": datetime.utcnow().isoformat(),
        "suggestedContent": "No consented channels available. Obtain consent before engagement.",
        "reasoning": "No engagement channels currently have active consent. Action required: obtain consent.",
        "confidence": 0.0,
        "factors": [{
            "name": "no_consent",
            "weight": 1.0,
            "value": 0.0,
            "description": "HCP has no active consent for any engagement channel",
        }],
        "modelVersion": MODEL_VERSION,
    }
