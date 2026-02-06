import { Router, Request, Response, NextFunction } from 'express';
import { FieldForceService } from './field-force.service';
import { authenticate, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validation';
import { createAuditEntry, getRequestMeta } from '../../middleware/audit';
import { AuditAction, UserRole } from '../../types';
import { z } from 'zod';

const router = Router();
const fieldForceService = new FieldForceService();

const createVisitPlanSchema = z.object({
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(z.object({
    hcpId: z.string().uuid(),
    priority: z.enum(['urgent', 'high', 'medium', 'low']),
    objective: z.string().optional(),
  })).min(1).max(30),
});

const syncOfflineSchema = z.object({
  interactions: z.array(z.record(z.unknown())).default([]),
  taskUpdates: z.array(z.record(z.unknown())).default([]),
});

// ─── VISIT PLANS ───────────────────────────────────────────────

router.post(
  '/visit-plans',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.FIELD_REP),
  validateBody(createVisitPlanSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await fieldForceService.createVisitPlan(req.body, req.user!.id);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.CREATE,
        entityType: 'visit_plan',
        entityId: plan.id as string,
        newState: { date: req.body.planDate, visits: req.body.items.length },
        ...getRequestMeta(req),
      });

      res.status(201).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/visit-plans',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await fieldForceService.getUserVisitPlans(
        req.user!.id,
        req.query.dateFrom as string,
        req.query.dateTo as string
      );
      res.json({ success: true, data: plans });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/visit-plans/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await fieldForceService.getVisitPlanById(req.params.id);
      res.json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/visit-plans/:id/status',
  authenticate,
  validateBody(z.object({ status: z.enum(['draft', 'confirmed', 'in_progress', 'completed']) })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await fieldForceService.updateVisitPlanStatus(req.params.id, req.body.status);
      res.json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }
);

// ─── VISIT SUGGESTIONS (AI-POWERED) ───────────────────────────

router.get(
  '/visit-suggestions',
  authenticate,
  requireRole(UserRole.FIELD_REP, UserRole.MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const suggestions = await fieldForceService.getVisitSuggestions(req.user!.id, date);
      res.json({ success: true, data: suggestions });
    } catch (error) {
      next(error);
    }
  }
);

// ─── OFFLINE SYNC ──────────────────────────────────────────────

router.post(
  '/sync',
  authenticate,
  requireRole(UserRole.FIELD_REP),
  validateBody(syncOfflineSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await fieldForceService.syncOfflineData(req.user!.id, req.body);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.UPDATE,
        entityType: 'offline_sync',
        metadata: { synced: result.synced, conflicts: result.conflicts.length },
        ...getRequestMeta(req),
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
