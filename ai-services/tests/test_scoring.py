"""
Tests for the AI Scoring Engine.
Validates that scoring is explainable, bounded, and correct.
"""

import pytest
from app.services.scoring_engine import (
    compute_engagement_score,
    compute_prescription_propensity,
)


class TestEngagementScoring:
    def test_score_is_bounded(self):
        """Score must be between 0 and 100."""
        result = compute_engagement_score({
            "hcpId": "test-001",
            "interactionCount": 50,
            "influenceLevel": "key_opinion_leader",
        })
        assert 0 <= result["score"] <= 100

    def test_score_includes_factors(self):
        """Every score must include explainability factors."""
        result = compute_engagement_score({
            "hcpId": "test-002",
            "interactionCount": 5,
            "influenceLevel": "medium",
        })
        assert len(result["factors"]) > 0
        for factor in result["factors"]:
            assert "name" in factor
            assert "weight" in factor
            assert "value" in factor
            assert "description" in factor
            assert isinstance(factor["description"], str)
            assert len(factor["description"]) > 0

    def test_score_includes_model_version(self):
        """Every score must be traceable to a model version."""
        result = compute_engagement_score({"hcpId": "test-003"})
        assert "modelVersion" in result
        assert result["modelVersion"].startswith("scoring-v")

    def test_confidence_reflects_data_completeness(self):
        """Sparse data should produce low confidence."""
        sparse = compute_engagement_score({"hcpId": "test-004"})
        rich = compute_engagement_score({
            "hcpId": "test-005",
            "interactionCount": 20,
            "influenceLevel": "high",
            "lastInteractionDate": "2024-01-15T10:00:00Z",
            "channelHistory": [
                {"channel": "email", "status": "completed", "sentiment": 0.5},
                {"channel": "phone", "status": "completed", "sentiment": 0.3},
            ],
            "consentStatus": [{"status": "granted", "consent_type": "email"}],
        })
        assert rich["confidence"] > sparse["confidence"]

    def test_kol_scores_higher(self):
        """Key Opinion Leaders should score higher than low-influence HCPs."""
        kol = compute_engagement_score({
            "hcpId": "test-006",
            "influenceLevel": "key_opinion_leader",
            "interactionCount": 10,
        })
        low = compute_engagement_score({
            "hcpId": "test-007",
            "influenceLevel": "low",
            "interactionCount": 10,
        })
        assert kol["score"] > low["score"]

    def test_recent_interaction_scores_higher(self):
        """Recent interactions should boost the score."""
        recent = compute_engagement_score({
            "hcpId": "test-008",
            "lastInteractionDate": "2024-12-01T10:00:00Z",
            "interactionCount": 5,
        })
        stale = compute_engagement_score({
            "hcpId": "test-009",
            "lastInteractionDate": "2023-01-01T10:00:00Z",
            "interactionCount": 5,
        })
        assert recent["score"] >= stale["score"]


class TestPrescriptionPropensity:
    def test_score_is_bounded(self):
        result = compute_prescription_propensity({
            "hcpId": "test-010",
            "influenceLevel": "high",
        })
        assert 0 <= result["score"] <= 100

    def test_score_type_is_correct(self):
        result = compute_prescription_propensity({"hcpId": "test-011"})
        assert result["scoreType"] == "prescription_propensity"

    def test_includes_explainability(self):
        result = compute_prescription_propensity({
            "hcpId": "test-012",
            "influenceLevel": "medium",
            "interactionCount": 8,
            "segments": ["high_value_engaged"],
        })
        assert len(result["factors"]) > 0
        for factor in result["factors"]:
            assert "description" in factor
