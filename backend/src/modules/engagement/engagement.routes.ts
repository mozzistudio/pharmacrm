import { Router, Request, Response, NextFunction } from 'express';
import { EngagementService } from './engagement.service';
import { authenticate, requireRole, enforceTerritoryScope } from '../../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../../middleware/validation';
import { requireConsent } from '../../middleware/consent-check';
import { createAuditEntry, getRequestMeta } from '../../middleware/audit';
import {
  createInteractionSchema,
  updateInteractionSchema,
  createTaskSchema,
  updateTaskSchema,
  listInteractionsQuerySchema,
} from './engagement.schema';
import { AuditAction, ConsentType, UserRole } from '../../types';
import { z } from 'zod';

const router = Router();
const engagementService = new EngagementService();

const uuidParam = z.object({ id: z.string().uuid() });

// ─── INTERACTIONS ──────────────────────────────────────────────

router.get(
  '/interactions',
  authenticate,
  enforceTerritoryScope,
  validateQuery(listInteractionsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const territoryFilter = (req as Record<string, unknown>).territoryFilter as string[] | undefined;
      const result = await engagementService.listInteractions(req.query, territoryFilter);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/interactions/:id',
  authenticate,
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const interaction = await engagementService.getInteractionById(req.params.id);
      res.json({ success: true, data: interaction });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/interactions',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.FIELD_REP, UserRole.MEDICAL_AFFAIRS),
  validateBody(createInteractionSchema),
  // Consent check: email/phone/visit interactions require matching consent
  async (req: Request, res: Response, next: NextFunction) => {
    const channelConsentMap: Record<string, ConsentType> = {
      email: ConsentType.EMAIL,
      phone: ConsentType.PHONE,
      in_person_visit: ConsentType.VISIT,
      remote_detailing: ConsentType.REMOTE_DETAILING,
    };
    const requiredConsent = channelConsentMap[req.body.channel];
    if (requiredConsent) {
      return requireConsent(requiredConsent)(req, res, next);
    }
    next();
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const interaction = await engagementService.createInteraction(req.body, req.user!.id);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.CREATE,
        entityType: 'interaction',
        entityId: interaction.id as string,
        newState: { channel: req.body.channel, hcpId: req.body.hcpId },
        ...getRequestMeta(req),
      });

      res.status(201).json({ success: true, data: interaction });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/interactions/:id',
  authenticate,
  validateParams(uuidParam),
  validateBody(updateInteractionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const interaction = await engagementService.updateInteraction(req.params.id, req.body);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.UPDATE,
        entityType: 'interaction',
        entityId: req.params.id,
        newState: { status: req.body.status },
        ...getRequestMeta(req),
      });

      res.json({ success: true, data: interaction });
    } catch (error) {
      next(error);
    }
  }
);

// ─── TASKS ─────────────────────────────────────────────────────

router.get(
  '/tasks',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.query.userId as string) || req.user!.id;
      const status = req.query.status as string | undefined;
      const tasks = await engagementService.listUserTasks(userId, status);
      res.json({ success: true, data: tasks });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/tasks',
  authenticate,
  validateBody(createTaskSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = await engagementService.createTask(req.body, req.user!.id);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.CREATE,
        entityType: 'task',
        entityId: task.id as string,
        newState: { title: req.body.title, priority: req.body.priority },
        ...getRequestMeta(req),
      });

      res.status(201).json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/tasks/:id',
  authenticate,
  validateParams(uuidParam),
  validateBody(updateTaskSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = await engagementService.updateTask(req.params.id, req.body);
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/tasks/overdue',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tasks = await engagementService.getOverdueTasks();
      res.json({ success: true, data: tasks });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
