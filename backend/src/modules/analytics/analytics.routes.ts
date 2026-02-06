import { Router, Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';
import { authenticate, requireRole, enforceTerritoryScope } from '../../middleware/auth';
import { createAuditEntry, getRequestMeta } from '../../middleware/audit';
import { AuditAction, UserRole } from '../../types';

const router = Router();
const analyticsService = new AnalyticsService();

// ─── DASHBOARD ─────────────────────────────────────────────────

router.get(
  '/dashboard',
  authenticate,
  enforceTerritoryScope,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const territoryFilter = (req as Record<string, unknown>).territoryFilter as string[] | undefined;
      const period = (req.query.period as string) || '30d';
      const data = await analyticsService.getDashboardData(req.user!.id, territoryFilter, period);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

// ─── TERRITORY PERFORMANCE ────────────────────────────────────

router.get(
  '/territory-performance',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = (req.query.period as string) || '30d';
      const data = await analyticsService.getTerritoryPerformance(period);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

// ─── ENGAGEMENT TRENDS ────────────────────────────────────────

router.get(
  '/engagement-trends',
  authenticate,
  enforceTerritoryScope,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const territoryFilter = (req as Record<string, unknown>).territoryFilter as string[] | undefined;
      const period = (req.query.period as string) || '30d';
      const data = await analyticsService.getEngagementTrends(territoryFilter, period);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

// ─── REPORTS ───────────────────────────────────────────────────

router.post(
  '/reports',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await analyticsService.generateReport(req.body);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.EXPORT,
        entityType: 'report',
        metadata: { reportType: req.body.type, format: req.body.format },
        ...getRequestMeta(req),
      });

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
