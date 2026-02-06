import { Router, Request, Response, NextFunction } from 'express';
import { ComplianceService } from './compliance.service';
import { authenticate, requireRole } from '../../middleware/auth';
import { createAuditEntry, getRequestMeta } from '../../middleware/audit';
import { AuditAction, UserRole } from '../../types';
import { z } from 'zod';
import { validateQuery } from '../../middleware/validation';

const router = Router();
const complianceService = new ComplianceService();

const auditLogQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ─── AUDIT LOG ─────────────────────────────────────────────────

router.get(
  '/audit-log',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  validateQuery(auditLogQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await complianceService.queryAuditLog(
        req.query as unknown as z.infer<typeof auditLogQuerySchema>
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

// ─── CONSENT HISTORY ───────────────────────────────────────────

router.get(
  '/consents/:hcpId/history',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const history = await complianceService.getConsentHistory(req.params.hcpId);
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GDPR DATA SUBJECT REPORT ─────────────────────────────────

router.get(
  '/gdpr/data-subject-report/:hcpId',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await complianceService.generateDataSubjectReport(req.params.hcpId);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.EXPORT,
        entityType: 'gdpr_report',
        entityId: req.params.hcpId,
        metadata: { reportType: 'data_subject_access' },
        ...getRequestMeta(req),
      });

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DATA INTEGRITY CHECK ─────────────────────────────────────

router.get(
  '/integrity-check/:entityType/:entityId',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await complianceService.verifyDataIntegrity(
        req.params.entityType,
        req.params.entityId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ─── COMPLIANCE DASHBOARD ─────────────────────────────────────

router.get(
  '/dashboard',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.MANAGER),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboard = await complianceService.getComplianceDashboard();
      res.json({ success: true, data: dashboard });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
