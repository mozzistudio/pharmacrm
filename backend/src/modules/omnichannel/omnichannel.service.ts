import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { getDatabase } from '../../database/connection';
import { NotFoundError } from '../../utils/errors';
import { UUID, ChannelType } from '../../types';
import { logger } from '../../utils/logger';

export interface CreateCampaignInput {
  name: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  segmentId?: string;
  productId?: string;
  scheduledAt?: string;
}

export class OmnichannelService {
  private db: Knex;

  constructor() {
    this.db = getDatabase();
  }

  // ─── EMAIL CAMPAIGNS ────────────────────────────────────────

  async createCampaign(input: CreateCampaignInput, userId: UUID): Promise<Record<string, unknown>> {
    const id = uuidv4();

    await this.db('email_campaigns').insert({
      id,
      name: input.name,
      subject: input.subject,
      body_html: input.bodyHtml,
      body_text: input.bodyText,
      segment_id: input.segmentId,
      product_id: input.productId,
      status: 'draft',
      scheduled_at: input.scheduledAt,
      created_by: userId,
      compliance_approved: false,
    });

    logger.info('Campaign created', { id, name: input.name });
    return this.getCampaignById(id);
  }

  async getCampaignById(id: UUID): Promise<Record<string, unknown>> {
    const campaign = await this.db('email_campaigns').where({ id }).first();
    if (!campaign) {
      throw new NotFoundError('EmailCampaign', id);
    }
    return campaign;
  }

  async approveCampaign(id: UUID, approvedBy: UUID): Promise<Record<string, unknown>> {
    const campaign = await this.getCampaignById(id);
    if (campaign.compliance_approved) {
      return campaign;
    }

    await this.db('email_campaigns').where({ id }).update({
      compliance_approved: true,
      approved_by: approvedBy,
      updated_at: new Date(),
    });

    logger.info('Campaign compliance-approved', { id, approvedBy });
    return this.getCampaignById(id);
  }

  async scheduleCampaign(id: UUID, scheduledAt: string): Promise<Record<string, unknown>> {
    const campaign = await this.getCampaignById(id);
    if (!campaign.compliance_approved) {
      throw new Error('Campaign must be compliance-approved before scheduling');
    }

    await this.db('email_campaigns').where({ id }).update({
      status: 'scheduled',
      scheduled_at: scheduledAt,
      updated_at: new Date(),
    });

    logger.info('Campaign scheduled', { id, scheduledAt });
    return this.getCampaignById(id);
  }

  async listCampaigns(status?: string): Promise<Record<string, unknown>[]> {
    const qb = this.db('email_campaigns').orderBy('created_at', 'desc');
    if (status) qb.where('status', status);
    return qb;
  }

  async getCampaignMetrics(id: UUID): Promise<Record<string, unknown>> {
    const sends = await this.db('email_sends')
      .where({ campaign_id: id })
      .select(
        this.db.raw('COUNT(*) as total'),
        this.db.raw("COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent"),
        this.db.raw("COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered"),
        this.db.raw("COUNT(CASE WHEN status = 'opened' THEN 1 END) as opened"),
        this.db.raw("COUNT(CASE WHEN status = 'clicked' THEN 1 END) as clicked"),
        this.db.raw("COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced")
      )
      .first();

    const total = Number(sends?.total || 0);
    return {
      campaignId: id,
      metrics: {
        totalSends: total,
        delivered: Number(sends?.delivered || 0),
        opened: Number(sends?.opened || 0),
        clicked: Number(sends?.clicked || 0),
        bounced: Number(sends?.bounced || 0),
        openRate: total > 0 ? Number(sends?.opened || 0) / total : 0,
        clickRate: total > 0 ? Number(sends?.clicked || 0) / total : 0,
        bounceRate: total > 0 ? Number(sends?.bounced || 0) / total : 0,
      },
    };
  }

  // ─── CHANNEL RECOMMENDATION ─────────────────────────────────

  /**
   * Determines the optimal engagement channel for a specific HCP.
   * Uses historical interaction data, consent status, and AI scoring.
   */
  async getChannelRecommendation(hcpId: UUID): Promise<{
    recommendedChannel: ChannelType;
    reasoning: string;
    alternatives: Array<{ channel: ChannelType; score: number; reason: string }>;
  }> {
    // Get HCP's consent status
    const consents = await this.db('consents')
      .where({ hcp_id: hcpId })
      .distinctOn('consent_type')
      .orderBy(['consent_type', { column: 'created_at', order: 'desc' }]);

    const consentedChannels = new Set(
      consents
        .filter((c: Record<string, unknown>) => c.status === 'granted')
        .map((c: Record<string, unknown>) => c.consent_type as string)
    );

    // Get historical interaction effectiveness
    const channelStats = await this.db('interactions')
      .where({ hcp_id: hcpId, status: 'completed' })
      .select(
        'channel',
        this.db.raw('COUNT(*) as total'),
        this.db.raw('AVG(sentiment_score) as avg_sentiment'),
        this.db.raw('MAX(completed_at) as last_engagement')
      )
      .groupBy('channel');

    // Score each channel
    const channelConsentMap: Record<string, string> = {
      email: 'email',
      phone: 'phone',
      in_person_visit: 'visit',
      remote_detailing: 'remote_detailing',
    };

    const scoredChannels: Array<{ channel: ChannelType; score: number; reason: string }> = [];

    for (const [channel, consentType] of Object.entries(channelConsentMap)) {
      if (!consentedChannels.has(consentType)) continue;

      const stats = channelStats.find(
        (s: Record<string, unknown>) => s.channel === channel
      );
      let score = 50; // base score
      let reason = '';

      if (stats) {
        const avgSentiment = Number(stats.avg_sentiment) || 0;
        score += avgSentiment * 20; // sentiment boost
        score += Math.min(Number(stats.total) * 2, 20); // frequency boost (cap at 20)
        reason = `${stats.total} prior ${channel} interactions, avg sentiment: ${avgSentiment.toFixed(2)}`;
      } else {
        score = 40;
        reason = `No prior ${channel} interactions — consider for diversification`;
      }

      scoredChannels.push({ channel: channel as ChannelType, score, reason });
    }

    // Sort by score
    scoredChannels.sort((a, b) => b.score - a.score);

    const recommended = scoredChannels[0] || {
      channel: ChannelType.EMAIL,
      score: 0,
      reason: 'Default fallback — verify consent',
    };

    return {
      recommendedChannel: recommended.channel,
      reasoning: recommended.reason,
      alternatives: scoredChannels.slice(1),
    };
  }
}
