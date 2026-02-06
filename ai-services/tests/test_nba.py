"""
Tests for the Next Best Action engine.
Validates consent enforcement, channel selection, and explainability.
"""

import pytest
from app.services.nba_engine import compute_next_best_action


class TestNextBestAction:
    def test_no_consent_returns_no_action(self):
        """If no channels are consented, NBA should not recommend engagement."""
        result = compute_next_best_action({
            "hcpId": "test-001",
            "userId": "user-001",
            "consentStatus": [],
        })
        assert result["recommendedChannel"] == "none"
        assert result["confidence"] == 0.0

    def test_only_recommends_consented_channels(self):
        """NBA must only recommend channels with active consent."""
        result = compute_next_best_action({
            "hcpId": "test-002",
            "userId": "user-001",
            "consentStatus": [
                {"consent_type": "email", "status": "granted"},
                {"consent_type": "phone", "status": "revoked"},
            ],
        })
        assert result["recommendedChannel"] == "email"

    def test_includes_reasoning(self):
        """Every NBA recommendation must include human-readable reasoning."""
        result = compute_next_best_action({
            "hcpId": "test-003",
            "userId": "user-001",
            "consentStatus": [{"consent_type": "visit", "status": "granted"}],
        })
        assert isinstance(result["reasoning"], str)
        assert len(result["reasoning"]) > 0

    def test_includes_model_version(self):
        result = compute_next_best_action({
            "hcpId": "test-004",
            "userId": "user-001",
            "consentStatus": [{"consent_type": "email", "status": "granted"}],
        })
        assert "modelVersion" in result
        assert result["modelVersion"].startswith("nba-v")

    def test_suggested_content_no_medical_claims(self):
        """Content suggestions must not contain medical claims."""
        result = compute_next_best_action({
            "hcpId": "test-005",
            "userId": "user-001",
            "specialty": "cardiology",
            "influenceLevel": "high",
            "consentStatus": [{"consent_type": "visit", "status": "granted"}],
            "interactionCount": 5,
        })
        forbidden_terms = ["cure", "treat", "prescribe", "dosage", "efficacy"]
        content_lower = result["suggestedContent"].lower()
        for term in forbidden_terms:
            assert term not in content_lower, (
                f"Content should not contain medical term '{term}'"
            )

    def test_timing_is_future(self):
        """Recommended timing should be in the future."""
        from datetime import datetime

        result = compute_next_best_action({
            "hcpId": "test-006",
            "userId": "user-001",
            "consentStatus": [{"consent_type": "email", "status": "granted"}],
        })
        timing = datetime.fromisoformat(result["recommendedTiming"])
        assert timing > datetime.utcnow()
