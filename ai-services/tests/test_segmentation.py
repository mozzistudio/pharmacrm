"""
Tests for the AI Segmentation engine.
"""

import pytest
from app.services.segmentation_engine import segment_hcps


class TestSegmentation:
    def test_kol_classification(self):
        """KOLs should be classified into kol_network segment."""
        results = segment_hcps([{
            "id": "test-001",
            "influenceLevel": "key_opinion_leader",
            "interactionCount": 20,
        }])
        assert len(results) == 1
        assert results[0]["segmentName"] == "kol_network"
        assert results[0]["confidence"] >= 0.9

    def test_new_target_classification(self):
        """HCPs with few interactions should be new_targets."""
        results = segment_hcps([{
            "id": "test-002",
            "influenceLevel": "medium",
            "interactionCount": 1,
        }])
        assert results[0]["segmentName"] == "new_targets"

    def test_high_value_engaged(self):
        """High-influence HCPs with many interactions = high_value_engaged."""
        results = segment_hcps([{
            "id": "test-003",
            "influenceLevel": "high",
            "interactionCount": 15,
        }])
        assert results[0]["segmentName"] == "high_value_engaged"

    def test_at_risk_disengaged(self):
        """HCPs with declining sentiment should be at_risk_disengaged."""
        results = segment_hcps([{
            "id": "test-004",
            "influenceLevel": "medium",
            "interactionCount": 10,
            "avgSentiment": -0.5,
        }])
        assert results[0]["segmentName"] == "at_risk_disengaged"

    def test_all_results_include_reasoning(self):
        """Every segment assignment must include reasoning."""
        results = segment_hcps([
            {"id": "test-005", "influenceLevel": "high", "interactionCount": 20},
            {"id": "test-006", "influenceLevel": "low", "interactionCount": 0},
        ])
        for result in results:
            assert "reasoning" in result
            assert isinstance(result["reasoning"], str)
            assert len(result["reasoning"]) > 0

    def test_confidence_is_bounded(self):
        """Confidence must be between 0 and 1."""
        results = segment_hcps([
            {"id": "test-007", "influenceLevel": "medium", "interactionCount": 5},
        ])
        for result in results:
            assert 0 <= result["confidence"] <= 1
