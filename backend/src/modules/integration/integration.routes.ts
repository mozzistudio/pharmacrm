import { Router, Request, Response, NextFunction } from 'express';
import { IntegrationService } from './integration.service';
import { authenticate, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validation';
import { createAuditEntry, getRequestMeta } from '../../middleware/audit';
import { AuditAction, UserRole } from '../../types';
import { z } from 'zod';

const router = Router();
const integrationService = new IntegrationService();

// ─── WEBHOOKS ──────────────────────────────────────────────────

router.get(
  '/webhooks',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const webhooks = await integrationService.listWebhooks();
      res.json({ success: true, data: webhooks });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/webhooks',
  authenticate,
  requireRole(UserRole.ADMIN),
  validateBody(z.object({
    name: z.string().min(1).max(200),
    url: z.string().url(),
    events: z.array(z.string()).min(1),
    headers: z.record(z.string()).optional(),
    secret: z.string().optional(),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhook = await integrationService.registerWebhook(req.body, req.user!.id);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.CREATE,
        entityType: 'webhook',
        entityId: webhook.id as string,
        newState: { name: req.body.name, events: req.body.events },
        ...getRequestMeta(req),
      });

      res.status(201).json({ success: true, data: webhook });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/webhooks/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await integrationService.deleteWebhook(req.params.id);
      res.json({ success: true, data: { id: req.params.id, deleted: true } });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DATA IMPORTS ──────────────────────────────────────────────

router.get(
  '/imports',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imports = await integrationService.listImportJobs(req.query.status as string);
      res.json({ success: true, data: imports });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/imports',
  authenticate,
  requireRole(UserRole.ADMIN),
  validateBody(z.object({
    source: z.string().min(1),
    dataType: z.enum(['prescription_data', 'sales_data', 'hcp_data']),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await integrationService.createImportJob({
        source: req.body.source,
        dataType: req.body.dataType,
        userId: req.user!.id,
      });

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.CREATE,
        entityType: 'data_import',
        entityId: job.id as string,
        newState: { source: req.body.source, dataType: req.body.dataType },
        ...getRequestMeta(req),
      });

      res.status(201).json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/imports/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await integrationService.getImportJob(req.params.id);
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PRESCRIPTION DATA IMPORT ─────────────────────────────────

router.post(
  '/imports/:id/process-prescriptions',
  authenticate,
  requireRole(UserRole.ADMIN),
  validateBody(z.object({
    records: z.array(z.object({
      hcpExternalId: z.string(),
      productName: z.string(),
      quantity: z.number().int().min(0),
      periodStart: z.string(),
      periodEnd: z.string(),
    })),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await integrationService.processPrescriptionImport(
        req.params.id,
        req.body.records
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
