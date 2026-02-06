import { Router, Request, Response, NextFunction } from 'express';
import { HCPService } from './hcp.service';
import { authenticate, requireRole, enforceTerritoryScope } from '../../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../../middleware/validation';
import { auditDataAccess, createAuditEntry, getRequestMeta } from '../../middleware/audit';
import {
  createHCPSchema,
  updateHCPSchema,
  listHCPsQuerySchema,
  createConsentSchema,
} from './hcp.schema';
import { AuditAction, UserRole } from '../../types';
import { z } from 'zod';

const router = Router();
const hcpService = new HCPService();

const uuidParam = z.object({ id: z.string().uuid() });

// ─── LIST HCPs ─────────────────────────────────────────────────
router.get(
  '/',
  authenticate,
  enforceTerritoryScope,
  validateQuery(listHCPsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as z.infer<typeof listHCPsQuerySchema>;
      const territoryFilter = (req as Record<string, unknown>).territoryFilter as string[] | undefined;
      const result = await hcpService.list(query, territoryFilter);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET HCP BY ID ─────────────────────────────────────────────
router.get(
  '/:id',
  authenticate,
  enforceTerritoryScope,
  validateParams(uuidParam),
  auditDataAccess('hcp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hcp = await hcpService.getById(req.params.id);
      res.json({ success: true, data: hcp });
    } catch (error) {
      next(error);
    }
  }
);

// ─── CREATE HCP ────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.FIELD_REP),
  validateBody(createHCPSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hcp = await hcpService.create(req.body);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.CREATE,
        entityType: 'hcp',
        entityId: hcp.id,
        newState: { specialty: hcp.specialty, influenceLevel: hcp.influenceLevel },
        ...getRequestMeta(req),
      });

      res.status(201).json({ success: true, data: hcp });
    } catch (error) {
      next(error);
    }
  }
);

// ─── UPDATE HCP ────────────────────────────────────────────────
router.patch(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.FIELD_REP),
  validateParams(uuidParam),
  validateBody(updateHCPSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const previousHcp = await hcpService.getById(req.params.id);
      const updatedHcp = await hcpService.update(req.params.id, req.body);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.UPDATE,
        entityType: 'hcp',
        entityId: req.params.id,
        previousState: { specialty: previousHcp.specialty, influenceLevel: previousHcp.influenceLevel },
        newState: { specialty: updatedHcp.specialty, influenceLevel: updatedHcp.influenceLevel },
        ...getRequestMeta(req),
      });

      res.json({ success: true, data: updatedHcp });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE (SOFT) HCP ─────────────────────────────────────────
router.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await hcpService.softDelete(req.params.id);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.DELETE,
        entityType: 'hcp',
        entityId: req.params.id,
        ...getRequestMeta(req),
      });

      res.json({ success: true, data: { id: req.params.id, deleted: true } });
    } catch (error) {
      next(error);
    }
  }
);

// ─── ANONYMIZE HCP (GDPR) ─────────────────────────────────────
router.post(
  '/:id/anonymize',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await hcpService.anonymize(req.params.id);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.DELETE,
        entityType: 'hcp',
        entityId: req.params.id,
        metadata: { type: 'gdpr_anonymization' },
        ...getRequestMeta(req),
      });

      res.json({ success: true, data: { id: req.params.id, anonymized: true } });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET HCP INTERACTION HISTORY ───────────────────────────────
router.get(
  '/:id/interactions',
  authenticate,
  enforceTerritoryScope,
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const interactions = await hcpService.getInteractionHistory(req.params.id);
      res.json({ success: true, data: interactions });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET HCP CONSENT STATUS ───────────────────────────────────
router.get(
  '/:id/consents',
  authenticate,
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consents = await hcpService.getConsentStatus(req.params.id);
      res.json({ success: true, data: consents });
    } catch (error) {
      next(error);
    }
  }
);

// ─── RECORD CONSENT ────────────────────────────────────────────
router.post(
  '/:id/consents',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.FIELD_REP),
  validateBody(createConsentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consent = await hcpService.recordConsent(req.body, req.user!.id);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.CONSENT_CHANGE,
        entityType: 'consent',
        entityId: consent.id as string,
        newState: { hcpId: req.body.hcpId, type: req.body.consentType, status: req.body.status },
        ...getRequestMeta(req),
      });

      res.status(201).json({ success: true, data: consent });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET HCP AI SCORES ────────────────────────────────────────
router.get(
  '/:id/ai-scores',
  authenticate,
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scores = await hcpService.getAIScores(req.params.id);
      res.json({ success: true, data: scores });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
