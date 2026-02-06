import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { getDatabase } from '../../database/connection';
import { encryptPII } from '../../utils/encryption';
import { NotFoundError } from '../../utils/errors';
import { PaginatedResult, UUID } from '../../types';
import {
  CreateInteractionInput,
  UpdateInteractionInput,
  CreateTaskInput,
  UpdateTaskInput,
} from './engagement.schema';
import { logger } from '../../utils/logger';

export class EngagementService {
  private db: Knex;

  constructor() {
    this.db = getDatabase();
  }

  // ─── INTERACTIONS ────────────────────────────────────────────

  async createInteraction(input: CreateInteractionInput, userId: UUID): Promise<Record<string, unknown>> {
    const id = uuidv4();

    const record = {
      id,
      hcp_id: input.hcpId,
      user_id: userId,
      channel: input.channel,
      status: input.status,
      scheduled_at: input.scheduledAt,
      duration_minutes: input.durationMinutes,
      notes_encrypted: input.notes ? encryptPII(input.notes) : null,
      products_discussed: JSON.stringify(input.productsDiscussed || []),
      key_messages: JSON.stringify(input.keyMessages || []),
      samples_delivered: JSON.stringify(input.samplesDelivered || []),
      location: input.location ? JSON.stringify(input.location) : null,
      parent_interaction_id: input.parentInteractionId,
      metadata: JSON.stringify(input.metadata || {}),
      is_synced: true,
    };

    await this.db('interactions').insert(record);
    logger.info('Interaction created', { id, channel: input.channel, hcpId: input.hcpId });

    return this.getInteractionById(id);
  }

  async getInteractionById(id: UUID): Promise<Record<string, unknown>> {
    const row = await this.db('interactions').where({ id }).first();
    if (!row) {
      throw new NotFoundError('Interaction', id);
    }
    return row;
  }

  async updateInteraction(id: UUID, input: UpdateInteractionInput): Promise<Record<string, unknown>> {
    const existing = await this.db('interactions').where({ id }).first();
    if (!existing) {
      throw new NotFoundError('Interaction', id);
    }

    const updates: Record<string, unknown> = { updated_at: new Date() };

    if (input.status !== undefined) {
      updates.status = input.status;
      if (input.status === 'in_progress' && !existing.started_at) {
        updates.started_at = new Date();
      }
      if (input.status === 'completed' && !existing.completed_at) {
        updates.completed_at = new Date();
      }
    }
    if (input.durationMinutes !== undefined) updates.duration_minutes = input.durationMinutes;
    if (input.notes !== undefined) updates.notes_encrypted = input.notes ? encryptPII(input.notes) : null;
    if (input.productsDiscussed !== undefined) updates.products_discussed = JSON.stringify(input.productsDiscussed);
    if (input.keyMessages !== undefined) updates.key_messages = JSON.stringify(input.keyMessages);
    if (input.samplesDelivered !== undefined) updates.samples_delivered = JSON.stringify(input.samplesDelivered);
    if (input.sentimentScore !== undefined) updates.sentiment_score = input.sentimentScore;
    if (input.aiSummary !== undefined) updates.ai_summary = input.aiSummary;
    if (input.metadata !== undefined) updates.metadata = JSON.stringify(input.metadata);

    await this.db('interactions').where({ id }).update(updates);
    logger.info('Interaction updated', { id, status: input.status });

    return this.getInteractionById(id);
  }

  async listInteractions(
    query: Record<string, unknown>,
    territoryFilter?: UUID[]
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const qb = this.db('interactions');

    if (query.hcpId) qb.where('hcp_id', query.hcpId);
    if (query.userId) qb.where('user_id', query.userId);
    if (query.channel) qb.where('channel', query.channel);
    if (query.status) qb.where('status', query.status);
    if (query.dateFrom) qb.where('scheduled_at', '>=', query.dateFrom);
    if (query.dateTo) qb.where('scheduled_at', '<=', query.dateTo);

    // Territory scoping via HCP
    if (territoryFilter && territoryFilter.length > 0) {
      qb.whereIn('hcp_id', function () {
        this.select('id').from('hcps').whereIn('territory_id', territoryFilter as string[]);
      });
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const [{ count }] = await qb.clone().count('* as count');
    const total = Number(count);

    const sortBy = (query.sortBy as string) || 'scheduled_at';
    const sortOrder = (query.sortOrder as string) || 'desc';

    const rows = await qb
      .orderBy(sortBy, sortOrder)
      .offset((page - 1) * limit)
      .limit(limit);

    return {
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── TASKS ───────────────────────────────────────────────────

  async createTask(input: CreateTaskInput, createdBy: UUID): Promise<Record<string, unknown>> {
    const id = uuidv4();

    const record = {
      id,
      assigned_to: input.assignedTo,
      created_by: createdBy,
      hcp_id: input.hcpId,
      interaction_id: input.interactionId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: 'pending',
      due_date: input.dueDate,
      source: input.source,
      metadata: JSON.stringify(input.metadata || {}),
    };

    await this.db('tasks').insert(record);
    logger.info('Task created', { id, assignedTo: input.assignedTo, priority: input.priority });

    return this.getTaskById(id);
  }

  async getTaskById(id: UUID): Promise<Record<string, unknown>> {
    const row = await this.db('tasks').where({ id }).first();
    if (!row) {
      throw new NotFoundError('Task', id);
    }
    return row;
  }

  async updateTask(id: UUID, input: UpdateTaskInput): Promise<Record<string, unknown>> {
    const existing = await this.db('tasks').where({ id }).first();
    if (!existing) {
      throw new NotFoundError('Task', id);
    }

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (input.status !== undefined) {
      updates.status = input.status;
      if (input.status === 'completed') updates.completed_at = new Date();
    }
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.dueDate !== undefined) updates.due_date = input.dueDate;
    if (input.description !== undefined) updates.description = input.description;
    if (input.metadata !== undefined) updates.metadata = JSON.stringify(input.metadata);

    await this.db('tasks').where({ id }).update(updates);
    return this.getTaskById(id);
  }

  async listUserTasks(userId: UUID, status?: string): Promise<Record<string, unknown>[]> {
    const qb = this.db('tasks').where({ assigned_to: userId });
    if (status) qb.where('status', status);
    return qb.orderBy('due_date', 'asc');
  }

  async getOverdueTasks(): Promise<Record<string, unknown>[]> {
    return this.db('tasks')
      .where('status', 'pending')
      .where('due_date', '<', new Date())
      .orderBy('due_date', 'asc');
  }
}
