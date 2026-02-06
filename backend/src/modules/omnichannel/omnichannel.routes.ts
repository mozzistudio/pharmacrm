import { Router, Request, Response, NextFunction } from 'express';
import { OmnichannelService } from './omnichannel.service';
import { authenticate, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validation';
import { createAuditEntry, getRequestMeta } from '../../middleware/audit';
import { AuditAction, UserRole } from '../../types';
import { z } from 'zod';

const router = Router();
const omnichannelService = new OmnichannelService();

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  segmentId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime().optional(),
});

// ─── CAMPAIGNS ─────────────────────────────────────────────────

router.get(
  '/campaigns',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaigns = await omnichannelService.listCampaigns(req.query.status as string);
      res.json({ success: true, data: campaigns });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/campaigns',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.MARKETING, UserRole.MANAGER),
  validateBody(createCampaignSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await omnichannelService.createCampaign(req.body, req.user!.id);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.CREATE,
        entityType: 'email_campaign',
        entityId: campaign.id as string,
        newState: { name: req.body.name },
        ...getRequestMeta(req),
      });

      res.status(201).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/campaigns/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await omnichannelService.getCampaignById(req.params.id);
      res.json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  }
);

// Compliance approval for campaigns (separate from creation)
router.post(
  '/campaigns/:id/approve',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await omnichannelService.approveCampaign(req.params.id, req.user!.id);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.UPDATE,
        entityType: 'email_campaign',
        entityId: req.params.id,
        newState: { complianceApproved: true },
        metadata: { action: 'compliance_approval' },
        ...getRequestMeta(req),
      });

      res.json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/campaigns/:id/schedule',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.MARKETING),
  validateBody(z.object({ scheduledAt: z.string().datetime() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await omnichannelService.scheduleCampaign(req.params.id, req.body.scheduledAt);
      res.json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/campaigns/:id/metrics',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const metrics = await omnichannelService.getCampaignMetrics(req.params.id);
      res.json({ success: true, data: metrics });
    } catch (error) {
      next(error);
    }
  }
);

// ─── CHANNEL RECOMMENDATION ──────────────────────────────────

router.get(
  '/channel-recommendation/:hcpId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const recommendation = await omnichannelService.getChannelRecommendation(req.params.hcpId);
      res.json({ success: true, data: recommendation });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
