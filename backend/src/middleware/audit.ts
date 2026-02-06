import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/connection';
import { AuditAction } from '../types';
import { logger } from '../utils/logger';

/**
 * Creates an immutable audit log entry.
 * Used by route handlers after successful mutations.
 */
export async function createAuditEntry(params: {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getDatabase();

  try {
    await db('audit_log').insert({
      id: uuidv4(),
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      previous_state: params.previousState ? JSON.stringify(params.previousState) : null,
      new_state: params.newState ? JSON.stringify(params.newState) : null,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      metadata: params.metadata ? JSON.stringify(params.metadata) : '{}',
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Audit failures must NEVER silently fail — log and re-throw
    logger.error('CRITICAL: Audit log write failed', {
      error,
      params: { ...params, previousState: '[redacted]', newState: '[redacted]' },
    });
    throw error;
  }
}

/**
 * Middleware that automatically audits all data-viewing GET requests.
 * Attach to routes where data access must be logged (e.g., HCP profile views).
 */
export function auditDataAccess(entityType: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (req.user && req.method === 'GET') {
      const entityId = req.params.id;
      // Fire and forget for reads — don't block the response
      createAuditEntry({
        userId: req.user.id,
        action: AuditAction.VIEW,
        entityType,
        entityId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
      }).catch((err) => {
        logger.error('Audit log (view) failed', { error: err });
      });
    }
    next();
  };
}

/**
 * Helper to extract request metadata for audit entries.
 */
export function getRequestMeta(req: Request) {
  return {
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
  };
}
