import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { getDatabase } from '../../database/connection';
import { NotFoundError } from '../../utils/errors';
import { UUID } from '../../types';
import { logger } from '../../utils/logger';

export interface CreateVisitPlanInput {
  planDate: string;
  items: VisitPlanItemInput[];
}

export interface VisitPlanItemInput {
  hcpId: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  objective?: string;
}

export class FieldForceService {
  private db: Knex;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Creates a visit plan for a field rep for a given day.
   * Items are sequenced by priority (urgent first) or by AI route optimization.
   */
  async createVisitPlan(input: CreateVisitPlanInput, userId: UUID): Promise<Record<string, unknown>> {
    const planId = uuidv4();

    await this.db.transaction(async (trx) => {
      await trx('visit_plans').insert({
        id: planId,
        user_id: userId,
        plan_date: input.planDate,
        status: 'draft',
        total_visits: input.items.length,
      });

      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const sortedItems = [...input.items].sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
      );

      const itemRecords = sortedItems.map((item, index) => ({
        id: uuidv4(),
        visit_plan_id: planId,
        hcp_id: item.hcpId,
        sequence_order: index + 1,
        priority: item.priority,
        objective: item.objective,
      }));

      await trx('visit_plan_items').insert(itemRecords);
    });

    logger.info('Visit plan created', { planId, userId, date: input.planDate, visits: input.items.length });
    return this.getVisitPlanById(planId);
  }

  async getVisitPlanById(id: UUID): Promise<Record<string, unknown>> {
    const plan = await this.db('visit_plans').where({ id }).first();
    if (!plan) {
      throw new NotFoundError('VisitPlan', id);
    }

    const items = await this.db('visit_plan_items')
      .where({ visit_plan_id: id })
      .orderBy('sequence_order', 'asc');

    return { ...plan, items };
  }

  async getUserVisitPlans(userId: UUID, dateFrom?: string, dateTo?: string): Promise<Record<string, unknown>[]> {
    const qb = this.db('visit_plans').where({ user_id: userId });
    if (dateFrom) qb.where('plan_date', '>=', dateFrom);
    if (dateTo) qb.where('plan_date', '<=', dateTo);
    return qb.orderBy('plan_date', 'desc');
  }

  async updateVisitPlanStatus(id: UUID, status: string): Promise<Record<string, unknown>> {
    const existing = await this.db('visit_plans').where({ id }).first();
    if (!existing) {
      throw new NotFoundError('VisitPlan', id);
    }

    await this.db('visit_plans').where({ id }).update({ status, updated_at: new Date() });
    return this.getVisitPlanById(id);
  }

  /**
   * Syncs offline visit data from mobile device.
   * Handles conflict resolution for interactions created while offline.
   */
  async syncOfflineData(
    userId: UUID,
    data: {
      interactions: Record<string, unknown>[];
      taskUpdates: Record<string, unknown>[];
    }
  ): Promise<{ synced: number; conflicts: string[] }> {
    let synced = 0;
    const conflicts: string[] = [];

    await this.db.transaction(async (trx) => {
      // Sync interactions
      for (const interaction of data.interactions) {
        const existing = await trx('interactions')
          .where({ id: interaction.id as string })
          .first();

        if (existing) {
          // Conflict: offline version vs server version
          // Strategy: last-write-wins based on updated_at, log conflict
          const serverUpdated = new Date(existing.updated_at).getTime();
          const offlineUpdated = new Date(interaction.updatedAt as string).getTime();

          if (offlineUpdated > serverUpdated) {
            await trx('interactions').where({ id: interaction.id as string }).update({
              ...interaction,
              is_synced: true,
              updated_at: new Date(),
            });
            synced++;
          } else {
            conflicts.push(`interaction:${interaction.id}`);
          }
        } else {
          await trx('interactions').insert({
            ...interaction,
            user_id: userId,
            is_synced: true,
          });
          synced++;
        }
      }

      // Sync task updates
      for (const taskUpdate of data.taskUpdates) {
        await trx('tasks')
          .where({ id: taskUpdate.id as string })
          .update({
            status: taskUpdate.status,
            updated_at: new Date(),
          });
        synced++;
      }
    });

    logger.info('Offline sync completed', { userId, synced, conflicts: conflicts.length });
    return { synced, conflicts };
  }

  /**
   * Gets AI-prioritized visit suggestions for a field rep.
   * Calls the AI service for route and visit optimization.
   */
  async getVisitSuggestions(userId: UUID, date: string): Promise<Record<string, unknown>[]> {
    // Get HCPs in user's territory
    const userTerritories = await this.db('user_territories')
      .where({ user_id: userId })
      .pluck('territory_id');

    if (userTerritories.length === 0) return [];

    // Get HCPs with their latest engagement scores
    const hcps = await this.db('hcps')
      .whereIn('territory_id', userTerritories)
      .where('is_active', true)
      .where('deleted_at', null)
      .leftJoin(
        this.db('ai_scores')
          .distinctOn('hcp_id')
          .orderBy([
            { column: 'hcp_id' },
            { column: 'computed_at', order: 'desc' },
          ])
          .as('latest_scores'),
        'hcps.id',
        'latest_scores.hcp_id'
      )
      .select('hcps.*', 'latest_scores.score as engagement_score')
      .orderBy('latest_scores.score', 'desc')
      .limit(10);

    // Check recent interactions to avoid over-contacting
    const recentInteractions = await this.db('interactions')
      .whereIn('hcp_id', hcps.map((h: Record<string, unknown>) => h.id))
      .where('user_id', userId)
      .where('created_at', '>=', this.db.raw("NOW() - INTERVAL '14 days'"))
      .select('hcp_id', this.db.raw('COUNT(*) as recent_count'))
      .groupBy('hcp_id');

    const recentMap = new Map(
      recentInteractions.map((r: Record<string, unknown>) => [r.hcp_id as string, Number(r.recent_count)])
    );

    return hcps
      .filter((hcp: Record<string, unknown>) => (recentMap.get(hcp.id as string) || 0) < 3)
      .map((hcp: Record<string, unknown>, index: number) => ({
        hcpId: hcp.id,
        sequenceOrder: index + 1,
        priority: (hcp.engagement_score as number) >= 70 ? 'high' : 'medium',
        reason: `Engagement score: ${hcp.engagement_score || 'N/A'}. ` +
          `Last contacted: ${recentMap.has(hcp.id as string) ? 'recently' : 'not in last 14 days'}.`,
      }));
  }
}
