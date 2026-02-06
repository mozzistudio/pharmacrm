import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { getDatabase } from '../../database/connection';
import { NotFoundError } from '../../utils/errors';
import { UUID } from '../../types';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

export interface WebhookConfig {
  name: string;
  url: string;
  events: string[];
  headers?: Record<string, string>;
  secret?: string;
}

export class IntegrationService {
  private db: Knex;

  constructor() {
    this.db = getDatabase();
  }

  // ─── WEBHOOKS ────────────────────────────────────────────────

  async registerWebhook(input: WebhookConfig, userId: UUID): Promise<Record<string, unknown>> {
    const id = uuidv4();
    const secret = input.secret || crypto.randomBytes(32).toString('hex');

    await this.db('webhooks').insert({
      id,
      name: input.name,
      url: input.url,
      events: JSON.stringify(input.events),
      headers: JSON.stringify(input.headers || {}),
      secret,
      is_active: true,
      created_by: userId,
    });

    logger.info('Webhook registered', { id, name: input.name, events: input.events });
    return { id, name: input.name, events: input.events, secret };
  }

  async listWebhooks(): Promise<Record<string, unknown>[]> {
    return this.db('webhooks').where('is_active', true).orderBy('created_at', 'desc');
  }

  async deleteWebhook(id: UUID): Promise<void> {
    await this.db('webhooks').where({ id }).update({ is_active: false, updated_at: new Date() });
  }

  /**
   * Dispatch an event to all matching webhooks.
   * Signs the payload with the webhook secret for verification.
   */
  async dispatchEvent(event: string, payload: Record<string, unknown>): Promise<void> {
    const webhooks = await this.db('webhooks')
      .where('is_active', true)
      .whereRaw("events::jsonb @> ?::jsonb", [JSON.stringify([event])]);

    for (const webhook of webhooks) {
      try {
        const body = JSON.stringify({
          event,
          timestamp: new Date().toISOString(),
          payload,
        });

        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(body)
          .digest('hex');

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-PharmaCRM-Signature': signature,
          'X-PharmaCRM-Event': event,
          ...(typeof webhook.headers === 'object' ? webhook.headers : {}),
        };

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!response.ok) {
          throw new Error(`Webhook returned ${response.status}`);
        }

        await this.db('webhooks').where({ id: webhook.id }).update({
          last_triggered_at: new Date(),
          failure_count: 0,
        });
      } catch (error) {
        logger.error('Webhook delivery failed', {
          webhookId: webhook.id,
          event,
          error: (error as Error).message,
        });

        await this.db('webhooks').where({ id: webhook.id }).update({
          failure_count: this.db.raw('failure_count + 1'),
        });
      }
    }
  }

  // ─── DATA IMPORTS ────────────────────────────────────────────

  async createImportJob(params: {
    source: string;
    dataType: string;
    userId: UUID;
  }): Promise<Record<string, unknown>> {
    const id = uuidv4();

    await this.db('data_imports').insert({
      id,
      source: params.source,
      data_type: params.dataType,
      status: 'pending',
      initiated_by: params.userId,
    });

    return { id, source: params.source, dataType: params.dataType, status: 'pending' };
  }

  async getImportJob(id: UUID): Promise<Record<string, unknown>> {
    const job = await this.db('data_imports').where({ id }).first();
    if (!job) {
      throw new NotFoundError('DataImport', id);
    }
    return job;
  }

  async listImportJobs(status?: string): Promise<Record<string, unknown>[]> {
    const qb = this.db('data_imports').orderBy('created_at', 'desc');
    if (status) qb.where('status', status);
    return qb;
  }

  /**
   * Process prescription data import.
   * Validates, maps, and inserts external prescription data.
   */
  async processPrescriptionImport(
    importId: UUID,
    records: Array<{
      hcpExternalId: string;
      productName: string;
      quantity: number;
      periodStart: string;
      periodEnd: string;
    }>
  ): Promise<{ processed: number; failed: number; errors: string[] }> {
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    await this.db('data_imports').where({ id: importId }).update({
      status: 'processing',
      records_total: records.length,
      started_at: new Date(),
    });

    for (const record of records) {
      try {
        // Look up HCP by external ID
        const hcp = await this.db('hcps')
          .where('external_id', record.hcpExternalId)
          .first();

        if (!hcp) {
          errors.push(`HCP not found: ${record.hcpExternalId}`);
          failed++;
          continue;
        }

        // Look up product
        const product = await this.db('products')
          .where('name', record.productName)
          .orWhere('brand_name', record.productName)
          .first();

        await this.db('prescription_data').insert({
          hcp_id: hcp.id,
          product_id: product?.id || null,
          import_id: importId,
          quantity: record.quantity,
          period_start: record.periodStart,
          period_end: record.periodEnd,
          source: 'import',
        });

        processed++;
      } catch (error) {
        errors.push(`Row error: ${(error as Error).message}`);
        failed++;
      }
    }

    await this.db('data_imports').where({ id: importId }).update({
      status: 'completed',
      records_processed: processed,
      records_failed: failed,
      error_log: JSON.stringify(errors),
      completed_at: new Date(),
    });

    logger.info('Import completed', { importId, processed, failed });
    return { processed, failed, errors };
  }
}
