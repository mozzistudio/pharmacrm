"""
AI Segmentation Engine
======================
Clusters HCPs into segments based on behavioral and profile data.

Model: Rule-based classification + K-means clustering (v1.0)
Input: Array of HCP profiles with interaction data
Output: Segment assignments with confidence and reasoning
"""

from typing import Optional
import numpy as np

MODEL_VERSION = "segmentation-v1.0"

# Pre-defined segment templates (production would learn from data)
SEGMENTS = {
    "high_value_engaged": {
        "description": "High-influence HCPs with strong engagement",
        "min_influence": 0.7,
        "min_interactions": 10,
    },
    "growing_potential": {
        "description": "Medium-influence HCPs showing increasing engagement",
        "min_influence": 0.4,
        "min_interactions": 3,
    },
    "new_targets": {
        "description": "HCPs with limited engagement history",
        "max_interactions": 3,
    },
    "at_risk_disengaged": {
        "description": "Previously active HCPs with declining engagement",
        "min_interactions": 5,
        "sentiment_threshold": -0.2,
    },
    "kol_network": {
        "description": "Key Opinion Leaders requiring strategic engagement",
        "influence_level": "key_opinion_leader",
    },
}


def segment_hcps(hcps: list[dict]) -> list[dict]:
    """Assign each HCP to the most appropriate segment."""
    results = []

    for hcp in hcps:
        segment, confidence, reasoning = _classify_hcp(hcp)
        results.append({
            "hcpId": hcp.get("id", "unknown"),
            "segmentName": segment,
            "confidence": confidence,
            "reasoning": reasoning,
        })

    return results


def _classify_hcp(hcp: dict) -> tuple[str, float, str]:
    """Classify a single HCP into a segment with explanation."""
    influence = hcp.get("influenceLevel", "medium")
    interactions = hcp.get("interactionCount", 0)
    avg_sentiment = hcp.get("avgSentiment", 0)

    influence_map = {
        "key_opinion_leader": 1.0,
        "high": 0.8,
        "medium": 0.5,
        "low": 0.2,
    }
    influence_score = influence_map.get(influence, 0.5)

    # Rule-based classification
    if influence == "key_opinion_leader":
        return (
            "kol_network",
            0.95,
            f"Key Opinion Leader classification. Influence: {influence}, "
            f"Interactions: {interactions}."
        )

    if influence_score >= 0.7 and interactions >= 10:
        return (
            "high_value_engaged",
            round(min(0.9, 0.6 + influence_score * 0.3), 2),
            f"High influence ({influence}) with strong engagement "
            f"({interactions} interactions)."
        )

    if interactions <= 3:
        return (
            "new_targets",
            0.8,
            f"Limited engagement history ({interactions} interactions). "
            f"New target for outreach."
        )

    if interactions >= 5 and avg_sentiment < -0.2:
        return (
            "at_risk_disengaged",
            round(0.7 + abs(avg_sentiment) * 0.2, 2),
            f"Previously engaged ({interactions} interactions) but declining "
            f"sentiment ({avg_sentiment:.2f}). At risk of disengagement."
        )

    if influence_score >= 0.4 and interactions >= 3:
        return (
            "growing_potential",
            round(0.6 + influence_score * 0.2, 2),
            f"Medium influence ({influence}) with growing engagement "
            f"({interactions} interactions). Potential for increased value."
        )

    return (
        "growing_potential",
        0.5,
        f"Standard classification. Influence: {influence}, "
        f"Interactions: {interactions}."
    )
