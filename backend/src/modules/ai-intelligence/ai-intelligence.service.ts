import { Knex } from 'knex';
import { getDatabase } from '../../database/connection';
import { config } from '../../config';
import { UUID, AIScoreResult, NextBestAction, AISummary } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Backend connector to the AI Services (Python/FastAPI).
 * Handles data preparation, result persistence, and explainability logging.
 *
 * AI Boundaries:
 * - AI NEVER generates medical claims
 * - All AI outputs include model version and confidence scores
 * - All AI decisions are audited
 * - Humans always have final decision authority
 */
export class AIIntelligenceService {
  private db: Knex;
  private aiServiceUrl: string;

  constructor() {
    this.db = getDatabase();
    this.aiServiceUrl = config.ai.serviceUrl;
  }

  /**
   * Request engagement scoring for an HCP.
   * Sends structured CRM data to AI service, persists result with explainability.
   */
  async requestEngagementScore(hcpId: UUID): Promise<AIScoreResult> {
    // Prepare input data from CRM
    const inputData = await this.prepareHCPData(hcpId);

    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/scoring/engagement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.ai.apiKey,
        },
        body: JSON.stringify(inputData),
      });

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`);
      }

      const result: AIScoreResult = await response.json();

      // Persist score with full explainability
      await this.db('ai_scores').insert({
        hcp_id: hcpId,
        score_type: 'engagement_likelihood',
        score: result.score,
        confidence: result.confidence,
        factors: JSON.stringify(result.factors),
        model_version: result.modelVersion,
        input_data_hash: this.hashInputData(inputData),
        computed_at: new Date(),
      });

      // Audit the AI decision
      await this.db('audit_log').insert({
        user_id: null, // system action
        action: 'ai_decision',
        entity_type: 'ai_score',
        entity_id: hcpId,
        new_state: JSON.stringify({
          scoreType: 'engagement_likelihood',
          score: result.score,
          confidence: result.confidence,
          modelVersion: result.modelVersion,
        }),
        metadata: JSON.stringify({ factors: result.factors }),
        ip_address: 'system',
        user_agent: 'ai-intelligence-service',
      });

      logger.info('Engagement score computed', {
        hcpId,
        score: result.score,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      logger.error('AI scoring failed', { hcpId, error });
      throw error;
    }
  }

  /**
   * Request Next Best Action for a user-HCP pair.
   */
  async requestNextBestAction(hcpId: UUID, userId: UUID): Promise<NextBestAction> {
    const inputData = await this.prepareNBAData(hcpId, userId);

    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/nba/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.ai.apiKey,
        },
        body: JSON.stringify(inputData),
      });

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`);
      }

      const result: NextBestAction = await response.json();

      // Persist NBA recommendation
      await this.db('next_best_actions').insert({
        hcp_id: hcpId,
        user_id: userId,
        recommended_channel: result.recommendedChannel,
        recommended_timing: result.recommendedTiming,
        suggested_content: result.suggestedContent,
        reasoning: result.reasoning,
        confidence: result.confidence,
        factors: JSON.stringify(result.factors),
        model_version: result.modelVersion,
        status: 'pending',
      });

      logger.info('NBA computed', {
        hcpId,
        userId,
        channel: result.recommendedChannel,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      logger.error('NBA computation failed', { hcpId, userId, error });
      throw error;
    }
  }

  /**
   * Request AI-generated account summary.
   * IMPORTANT: Summary must NOT contain medical claims or treatment recommendations.
   */
  async requestAccountSummary(hcpId: UUID): Promise<AISummary> {
    const inputData = await this.prepareHCPData(hcpId);

    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/summaries/account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.ai.apiKey,
        },
        body: JSON.stringify(inputData),
      });

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`);
      }

      const result: AISummary = await response.json();
      return result;
    } catch (error) {
      logger.error('Account summary generation failed', { hcpId, error });
      throw error;
    }
  }

  /**
   * Get user's pending NBA recommendations.
   */
  async getUserNBAs(userId: UUID): Promise<Record<string, unknown>[]> {
    return this.db('next_best_actions')
      .where({ user_id: userId, status: 'pending' })
      .orderBy('created_at', 'desc')
      .limit(20);
  }

  /**
   * Accept or reject an NBA recommendation.
   */
  async respondToNBA(
    nbaId: UUID,
    response: 'accepted' | 'rejected',
    reason?: string
  ): Promise<void> {
    await this.db('next_best_actions').where({ id: nbaId }).update({
      status: response,
      rejection_reason: response === 'rejected' ? reason : null,
      acted_on_at: new Date(),
    });
  }

  /**
   * Copilot: Send a chat message and get an AI response.
   */
  async sendCopilotMessage(
    userId: UUID,
    conversationId: UUID | null,
    message: string,
    context?: Record<string, unknown>
  ): Promise<{
    conversationId: UUID;
    response: string;
    metadata: Record<string, unknown>;
  }> {
    // Create or retrieve conversation
    let convId = conversationId;
    if (!convId) {
      const [conv] = await this.db('copilot_conversations')
        .insert({
          user_id: userId,
          title: message.substring(0, 100),
          context: JSON.stringify(context || {}),
        })
        .returning('id');
      convId = conv.id;
    }

    // Store user message
    await this.db('copilot_messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // Get conversation history
    const history = await this.db('copilot_messages')
      .where({ conversation_id: convId })
      .orderBy('created_at', 'asc')
      .limit(20);

    // Call AI service
    const response = await fetch(`${this.aiServiceUrl}/api/v1/copilot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.ai.apiKey,
      },
      body: JSON.stringify({
        messages: history.map((m: Record<string, unknown>) => ({
          role: m.role,
          content: m.content,
        })),
        context,
        userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Copilot AI service returned ${response.status}`);
    }

    const aiResponse = await response.json();

    // Store AI response
    await this.db('copilot_messages').insert({
      conversation_id: convId,
      role: 'assistant',
      content: aiResponse.content,
      metadata: JSON.stringify({
        modelVersion: aiResponse.modelVersion,
        tokensUsed: aiResponse.tokensUsed,
      }),
    });

    return {
      conversationId: convId!,
      response: aiResponse.content,
      metadata: {
        modelVersion: aiResponse.modelVersion,
        tokensUsed: aiResponse.tokensUsed,
      },
    };
  }

  // ─── DATA PREPARATION ───────────────────────────────────────

  private async prepareHCPData(hcpId: UUID): Promise<Record<string, unknown>> {
    const [hcp, interactions, consents, scores, segments] = await Promise.all([
      this.db('hcps').where({ id: hcpId }).first(),
      this.db('interactions')
        .where({ hcp_id: hcpId })
        .orderBy('created_at', 'desc')
        .limit(50),
      this.db('consents')
        .where({ hcp_id: hcpId })
        .orderBy('created_at', 'desc'),
      this.db('ai_scores')
        .where({ hcp_id: hcpId })
        .orderBy('computed_at', 'desc')
        .limit(5),
      this.db('hcp_segments')
        .where({ hcp_id: hcpId })
        .join('segments', 'hcp_segments.segment_id', 'segments.id'),
    ]);

    return {
      hcpId,
      specialty: hcp?.specialty,
      influenceLevel: hcp?.influence_level,
      therapeuticAreas: hcp?.therapeutic_areas,
      yearsOfPractice: hcp?.years_of_practice,
      interactionCount: interactions.length,
      lastInteractionDate: interactions[0]?.created_at,
      channelHistory: interactions.map((i: Record<string, unknown>) => ({
        channel: i.channel,
        status: i.status,
        sentiment: i.sentiment_score,
        date: i.created_at,
      })),
      consentStatus: consents,
      previousScores: scores,
      segments: segments.map((s: Record<string, unknown>) => s.name),
    };
  }

  private async prepareNBAData(hcpId: UUID, userId: UUID): Promise<Record<string, unknown>> {
    const hcpData = await this.prepareHCPData(hcpId);

    const [userTasks, userInteractions] = await Promise.all([
      this.db('tasks')
        .where({ assigned_to: userId })
        .whereIn('status', ['pending', 'in_progress'])
        .orderBy('due_date', 'asc'),
      this.db('interactions')
        .where({ user_id: userId })
        .orderBy('scheduled_at', 'desc')
        .limit(20),
    ]);

    return {
      ...hcpData,
      userId,
      pendingTasks: userTasks.length,
      recentUserInteractions: userInteractions.map((i: Record<string, unknown>) => ({
        hcpId: i.hcp_id,
        channel: i.channel,
        scheduledAt: i.scheduled_at,
      })),
    };
  }

  private hashInputData(data: Record<string, unknown>): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}
