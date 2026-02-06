import { Knex } from 'knex';
import { getDatabase } from '../../database/connection';
import { UUID, AuditAction } from '../../types';
import { logger } from '../../utils/logger';

export interface AuditLogQuery {
  userId?: UUID;
  action?: AuditAction;
  entityType?: string;
  entityId?: UUID;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export class ComplianceService {
  private db: Knex;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Query immutable audit logs with filtering.
   * Compliance officers and admins only.
   */
  async queryAuditLog(query: AuditLogQuery): Promise<{
    data: Record<string, unknown>[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const qb = this.db('audit_log');

    if (query.userId) qb.where('user_id', query.userId);
    if (query.action) qb.where('action', query.action);
    if (query.entityType) qb.where('entity_type', query.entityType);
    if (query.entityId) qb.where('entity_id', query.entityId);
    if (query.dateFrom) qb.where('created_at', '>=', query.dateFrom);
    if (query.dateTo) qb.where('created_at', '<=', query.dateTo);

    const page = query.page || 1;
    const limit = query.limit || 50;

    const [{ count }] = await qb.clone().count('* as count');
    const total = Number(count);

    const data = await qb
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get full consent history for an HCP (all consent records, not just latest).
   * Used for compliance audits and GDPR reporting.
   */
  async getConsentHistory(hcpId: UUID): Promise<Record<string, unknown>[]> {
    return this.db('consents')
      .where({ hcp_id: hcpId })
      .orderBy('created_at', 'desc');
  }

  /**
   * Generate a GDPR data subject access report.
   * Returns all data held about an HCP in a structured format.
   */
  async generateDataSubjectReport(hcpId: UUID): Promise<Record<string, unknown>> {
    const [hcp, consents, interactions, tasks, aiScores, auditEntries] = await Promise.all([
      this.db('hcps').where({ id: hcpId }).first(),
      this.db('consents').where({ hcp_id: hcpId }).orderBy('created_at', 'desc'),
      this.db('interactions').where({ hcp_id: hcpId }).orderBy('created_at', 'desc'),
      this.db('tasks').where({ hcp_id: hcpId }).orderBy('created_at', 'desc'),
      this.db('ai_scores').where({ hcp_id: hcpId }).orderBy('computed_at', 'desc'),
      this.db('audit_log').where({ entity_type: 'hcp', entity_id: hcpId }).orderBy('created_at', 'desc'),
    ]);

    logger.info('GDPR data subject report generated', { hcpId });

    return {
      generatedAt: new Date().toISOString(),
      hcpId,
      personalData: hcp ? {
        specialty: hcp.specialty,
        influenceLevel: hcp.influence_level,
        territory: hcp.territory_id,
        isActive: hcp.is_active,
        createdAt: hcp.created_at,
        // PII fields are encrypted - included but marked
        hasEncryptedEmail: !!hcp.email_encrypted,
        hasEncryptedPhone: !!hcp.phone_encrypted,
        hasEncryptedName: true,
      } : null,
      consentRecords: consents,
      interactionHistory: interactions.map((i: Record<string, unknown>) => ({
        id: i.id,
        channel: i.channel,
        status: i.status,
        scheduledAt: i.scheduled_at,
        completedAt: i.completed_at,
        // Notes excluded from report (contain operational content)
      })),
      taskAssociations: tasks.map((t: Record<string, unknown>) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        createdAt: t.created_at,
      })),
      aiProcessing: aiScores.map((s: Record<string, unknown>) => ({
        scoreType: s.score_type,
        score: s.score,
        confidence: s.confidence,
        modelVersion: s.model_version,
        computedAt: s.computed_at,
        factors: s.factors,
      })),
      accessLog: auditEntries.map((a: Record<string, unknown>) => ({
        action: a.action,
        userId: a.user_id,
        timestamp: a.created_at,
      })),
    };
  }

  /**
   * Verify data integrity for a specific entity.
   * Checks audit log consistency.
   */
  async verifyDataIntegrity(entityType: string, entityId: UUID): Promise<{
    isConsistent: boolean;
    issues: string[];
  }> {
    const auditEntries = await this.db('audit_log')
      .where({ entity_type: entityType, entity_id: entityId })
      .orderBy('created_at', 'asc');

    const issues: string[] = [];

    // Check for gaps in audit trail
    let hasCreate = false;
    for (const entry of auditEntries) {
      if (entry.action === 'create') hasCreate = true;
    }

    if (auditEntries.length > 0 && !hasCreate) {
      issues.push('Missing CREATE audit entry for entity');
    }

    // Check for updates after delete
    const deleteIndex = auditEntries.findIndex(
      (e: Record<string, unknown>) => e.action === 'delete'
    );
    if (deleteIndex >= 0) {
      const postDeleteUpdates = auditEntries.slice(deleteIndex + 1)
        .filter((e: Record<string, unknown>) => e.action === 'update');
      if (postDeleteUpdates.length > 0) {
        issues.push('Updates found after DELETE action');
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues,
    };
  }

  /**
   * Get compliance dashboard metrics.
   */
  async getComplianceDashboard(): Promise<Record<string, unknown>> {
    const [
      totalConsentsGranted,
      totalConsentsRevoked,
      pendingConsents,
      recentAuditActions,
      aiDecisionCount,
    ] = await Promise.all([
      this.db('consents').where('status', 'granted').count('* as count').first(),
      this.db('consents').where('status', 'revoked').count('* as count').first(),
      this.db('consents').where('status', 'pending').count('* as count').first(),
      this.db('audit_log')
        .where('created_at', '>=', this.db.raw("NOW() - INTERVAL '24 hours'"))
        .count('* as count')
        .first(),
      this.db('audit_log')
        .where('action', 'ai_decision')
        .where('created_at', '>=', this.db.raw("NOW() - INTERVAL '30 days'"))
        .count('* as count')
        .first(),
    ]);

    return {
      consents: {
        granted: Number(totalConsentsGranted?.count || 0),
        revoked: Number(totalConsentsRevoked?.count || 0),
        pending: Number(pendingConsents?.count || 0),
      },
      auditActivity: {
        last24Hours: Number(recentAuditActions?.count || 0),
      },
      aiDecisions: {
        last30Days: Number(aiDecisionCount?.count || 0),
      },
    };
  }
}
