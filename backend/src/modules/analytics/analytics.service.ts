import { Knex } from 'knex';
import { getDatabase } from '../../database/connection';
import { UUID } from '../../types';
import { logger } from '../../utils/logger';

export class AnalyticsService {
  private db: Knex;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Main dashboard data: KPIs, territory performance, trends.
   */
  async getDashboardData(
    userId: UUID,
    territoryIds?: UUID[],
    period: string = '30d'
  ): Promise<Record<string, unknown>> {
    const intervalMap: Record<string, string> = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      '1y': '365 days',
    };
    const interval = intervalMap[period] || '30 days';

    const [
      totalHCPs,
      activeHCPs,
      totalInteractions,
      completedInteractions,
      avgInteractionsPerHCP,
      channelBreakdown,
      topHCPs,
      recentActivity,
    ] = await Promise.all([
      this.getHCPCount(territoryIds),
      this.getActiveHCPCount(territoryIds, interval),
      this.getInteractionCount(territoryIds, interval),
      this.getCompletedInteractionCount(territoryIds, interval),
      this.getAvgInteractionsPerHCP(territoryIds, interval),
      this.getChannelBreakdown(territoryIds, interval),
      this.getTopHCPsByEngagement(territoryIds, 10),
      this.getRecentActivity(userId, 20),
    ]);

    return {
      kpis: [
        {
          name: 'Total HCPs',
          value: totalHCPs,
          unit: 'count',
          period,
        },
        {
          name: 'Active HCPs',
          value: activeHCPs,
          unit: 'count',
          period,
        },
        {
          name: 'Total Interactions',
          value: totalInteractions,
          unit: 'count',
          period,
        },
        {
          name: 'Completion Rate',
          value: totalInteractions > 0
            ? Math.round((completedInteractions / totalInteractions) * 100)
            : 0,
          unit: 'percent',
          period,
        },
        {
          name: 'Avg Interactions per HCP',
          value: Math.round(avgInteractionsPerHCP * 10) / 10,
          unit: 'ratio',
          period,
        },
      ],
      channelBreakdown,
      topHCPs,
      recentActivity,
    };
  }

  private async getHCPCount(territoryIds?: UUID[]): Promise<number> {
    const qb = this.db('hcps').where('is_active', true).where('deleted_at', null);
    if (territoryIds?.length) qb.whereIn('territory_id', territoryIds);
    const [{ count }] = await qb.count('* as count');
    return Number(count);
  }

  private async getActiveHCPCount(territoryIds?: UUID[], interval?: string): Promise<number> {
    const qb = this.db('interactions')
      .where('created_at', '>=', this.db.raw(`NOW() - INTERVAL '${interval}'`))
      .countDistinct('hcp_id as count');
    if (territoryIds?.length) {
      qb.whereIn('hcp_id', function () {
        this.select('id').from('hcps').whereIn('territory_id', territoryIds!);
      });
    }
    const [{ count }] = await qb;
    return Number(count);
  }

  private async getInteractionCount(territoryIds?: UUID[], interval?: string): Promise<number> {
    const qb = this.db('interactions')
      .where('created_at', '>=', this.db.raw(`NOW() - INTERVAL '${interval}'`));
    if (territoryIds?.length) {
      qb.whereIn('hcp_id', function () {
        this.select('id').from('hcps').whereIn('territory_id', territoryIds!);
      });
    }
    const [{ count }] = await qb.count('* as count');
    return Number(count);
  }

  private async getCompletedInteractionCount(territoryIds?: UUID[], interval?: string): Promise<number> {
    const qb = this.db('interactions')
      .where('status', 'completed')
      .where('created_at', '>=', this.db.raw(`NOW() - INTERVAL '${interval}'`));
    if (territoryIds?.length) {
      qb.whereIn('hcp_id', function () {
        this.select('id').from('hcps').whereIn('territory_id', territoryIds!);
      });
    }
    const [{ count }] = await qb.count('* as count');
    return Number(count);
  }

  private async getAvgInteractionsPerHCP(territoryIds?: UUID[], interval?: string): Promise<number> {
    const totalInteractions = await this.getInteractionCount(territoryIds, interval);
    const totalHCPs = await this.getHCPCount(territoryIds);
    return totalHCPs > 0 ? totalInteractions / totalHCPs : 0;
  }

  private async getChannelBreakdown(
    territoryIds?: UUID[],
    interval?: string
  ): Promise<Record<string, number>> {
    const qb = this.db('interactions')
      .select('channel')
      .count('* as count')
      .where('created_at', '>=', this.db.raw(`NOW() - INTERVAL '${interval}'`))
      .groupBy('channel');

    if (territoryIds?.length) {
      qb.whereIn('hcp_id', function () {
        this.select('id').from('hcps').whereIn('territory_id', territoryIds!);
      });
    }

    const rows = await qb;
    const result: Record<string, number> = {};
    for (const row of rows as Array<{ channel: string; count: string }>) {
      result[row.channel] = Number(row.count);
    }
    return result;
  }

  private async getTopHCPsByEngagement(
    territoryIds?: UUID[],
    limit: number = 10
  ): Promise<Record<string, unknown>[]> {
    const qb = this.db('hcps')
      .select(
        'hcps.id',
        'hcps.specialty',
        'hcps.influence_level',
        this.db.raw('COUNT(interactions.id) as interaction_count')
      )
      .leftJoin('interactions', 'hcps.id', 'interactions.hcp_id')
      .where('hcps.is_active', true)
      .where('hcps.deleted_at', null)
      .groupBy('hcps.id')
      .orderBy('interaction_count', 'desc')
      .limit(limit);

    if (territoryIds?.length) {
      qb.whereIn('hcps.territory_id', territoryIds);
    }

    return qb;
  }

  private async getRecentActivity(userId: UUID, limit: number): Promise<Record<string, unknown>[]> {
    return this.db('audit_log')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  /**
   * Territory performance comparison.
   */
  async getTerritoryPerformance(period: string = '30d'): Promise<Record<string, unknown>[]> {
    const intervalMap: Record<string, string> = {
      '7d': '7 days', '30d': '30 days', '90d': '90 days', '1y': '365 days',
    };
    const interval = intervalMap[period] || '30 days';

    return this.db('territories')
      .select(
        'territories.id',
        'territories.name',
        'territories.region',
        this.db.raw('COUNT(DISTINCT hcps.id) as total_hcps'),
        this.db.raw(`COUNT(DISTINCT CASE WHEN interactions.created_at >= NOW() - INTERVAL '${interval}' THEN interactions.hcp_id END) as active_hcps`),
        this.db.raw(`COUNT(CASE WHEN interactions.created_at >= NOW() - INTERVAL '${interval}' THEN interactions.id END) as total_interactions`),
        this.db.raw(`COUNT(CASE WHEN interactions.status = 'completed' AND interactions.created_at >= NOW() - INTERVAL '${interval}' THEN interactions.id END) as completed_interactions`)
      )
      .leftJoin('hcps', 'territories.id', 'hcps.territory_id')
      .leftJoin('interactions', 'hcps.id', 'interactions.hcp_id')
      .where('territories.is_active', true)
      .groupBy('territories.id')
      .orderBy('total_interactions', 'desc');
  }

  /**
   * Engagement trends over time (daily aggregation).
   */
  async getEngagementTrends(
    territoryIds?: UUID[],
    period: string = '30d'
  ): Promise<Record<string, unknown>[]> {
    const intervalMap: Record<string, string> = {
      '7d': '7 days', '30d': '30 days', '90d': '90 days', '1y': '365 days',
    };
    const interval = intervalMap[period] || '30 days';

    const qb = this.db('interactions')
      .select(
        this.db.raw("DATE(created_at) as date"),
        this.db.raw('COUNT(*) as total'),
        this.db.raw("COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed"),
        this.db.raw('COUNT(DISTINCT hcp_id) as unique_hcps')
      )
      .where('created_at', '>=', this.db.raw(`NOW() - INTERVAL '${interval}'`))
      .groupByRaw('DATE(created_at)')
      .orderBy('date', 'asc');

    if (territoryIds?.length) {
      qb.whereIn('hcp_id', function () {
        this.select('id').from('hcps').whereIn('territory_id', territoryIds!);
      });
    }

    return qb;
  }

  /**
   * Export report data in structured format.
   */
  async generateReport(params: {
    type: 'interactions' | 'hcps' | 'territory' | 'compliance';
    dateFrom: string;
    dateTo: string;
    territoryIds?: UUID[];
    format: 'json' | 'csv';
  }): Promise<Record<string, unknown>> {
    logger.info('Report generation started', { type: params.type, format: params.format });

    let data: Record<string, unknown>[];

    switch (params.type) {
      case 'interactions':
        data = await this.db('interactions')
          .where('created_at', '>=', params.dateFrom)
          .where('created_at', '<=', params.dateTo)
          .orderBy('created_at', 'desc');
        break;

      case 'hcps':
        data = await this.db('hcps')
          .where('is_active', true)
          .where('deleted_at', null)
          .select('id', 'specialty', 'influence_level', 'territory_id', 'created_at');
        break;

      case 'territory':
        data = await this.getTerritoryPerformance();
        break;

      case 'compliance': {
        const dashboard = await this.db('audit_log')
          .where('created_at', '>=', params.dateFrom)
          .where('created_at', '<=', params.dateTo)
          .select('action', this.db.raw('COUNT(*) as count'))
          .groupBy('action');
        data = dashboard;
        break;
      }

      default:
        data = [];
    }

    return {
      reportType: params.type,
      generatedAt: new Date().toISOString(),
      dateRange: { from: params.dateFrom, to: params.dateTo },
      recordCount: data.length,
      data,
    };
  }
}
