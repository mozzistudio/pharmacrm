/**
 * Unit tests for the AI scoring engine logic.
 * Tests run against the Python AI service's scoring logic concepts,
 * validating the factor-based model produces expected results.
 */

describe('AI Scoring Engine', () => {
  describe('Engagement Score Factors', () => {
    it('should produce higher scores for recent interactions', () => {
      // Recent interaction (7 days ago) should score higher than stale (90+ days)
      const recentScore = scoreRecency(7);
      const staleScore = scoreRecency(120);
      expect(recentScore).toBeGreaterThan(staleScore);
    });

    it('should produce higher scores for frequent interactions', () => {
      const highFreq = scoreFrequency(25);
      const lowFreq = scoreFrequency(1);
      expect(highFreq).toBeGreaterThan(lowFreq);
    });

    it('should cap scores between 0 and 100', () => {
      const score = computeWeightedScore([
        { weight: 1, value: 1.5 }, // intentionally >1
      ]);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should give KOLs higher influence scores', () => {
      const kolScore = scoreInfluence('key_opinion_leader');
      const lowScore = scoreInfluence('low');
      expect(kolScore).toBeGreaterThan(lowScore);
    });

    it('should return low confidence when data is sparse', () => {
      const confidence = computeConfidence({
        hasLastInteraction: false,
        hasInteractions: false,
        hasChannelHistory: false,
        hasInfluenceLevel: true,
        hasConsents: false,
      });
      expect(confidence).toBeLessThan(0.5);
    });

    it('should return high confidence when data is complete', () => {
      const confidence = computeConfidence({
        hasLastInteraction: true,
        hasInteractions: true,
        hasChannelHistory: true,
        hasInfluenceLevel: true,
        hasConsents: true,
      });
      expect(confidence).toBe(1.0);
    });
  });

  describe('Score Explainability', () => {
    it('should include factor descriptions for every factor', () => {
      const factors = computeAllFactors({
        interactionCount: 10,
        influenceLevel: 'high',
        channelHistory: [{ channel: 'email', status: 'completed' }],
      });

      for (const factor of factors) {
        expect(factor.name).toBeDefined();
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.description).toBeTruthy();
        expect(typeof factor.description).toBe('string');
      }
    });
  });
});

// ─── Helper functions (mirroring Python scoring logic) ─────────

function scoreRecency(daysAgo: number): number {
  if (daysAgo <= 7) return 0.95;
  if (daysAgo <= 30) return 0.75;
  if (daysAgo <= 90) return 0.45;
  return 0.15;
}

function scoreFrequency(count: number): number {
  if (count === 0) return 0.1;
  if (count <= 3) return 0.4;
  if (count <= 10) return 0.7;
  if (count <= 25) return 0.85;
  return 0.95;
}

function scoreInfluence(level: string): number {
  const map: Record<string, number> = {
    key_opinion_leader: 0.95,
    high: 0.75,
    medium: 0.5,
    low: 0.25,
  };
  return map[level] || 0.5;
}

function computeWeightedScore(factors: Array<{ weight: number; value: number }>): number {
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = factors.reduce((sum, f) => sum + f.weight * f.value, 0);
  const score = (weightedSum / totalWeight) * 100;
  return Math.max(0, Math.min(100, score));
}

function computeConfidence(dataPresence: Record<string, boolean>): number {
  const points = Object.values(dataPresence).filter(Boolean).length;
  return points / Object.keys(dataPresence).length;
}

function computeAllFactors(data: {
  interactionCount: number;
  influenceLevel: string;
  channelHistory: Array<{ channel: string; status: string }>;
}): Array<{ name: string; weight: number; value: number; description: string }> {
  return [
    {
      name: 'interaction_frequency',
      weight: 0.2,
      value: scoreFrequency(data.interactionCount),
      description: `${data.interactionCount} total interactions`,
    },
    {
      name: 'influence_level',
      weight: 0.15,
      value: scoreInfluence(data.influenceLevel),
      description: `Influence level: ${data.influenceLevel}`,
    },
    {
      name: 'channel_diversity',
      weight: 0.15,
      value: new Set(data.channelHistory.map((h) => h.channel)).size / 4,
      description: `${new Set(data.channelHistory.map((h) => h.channel)).size} unique channels`,
    },
  ];
}
