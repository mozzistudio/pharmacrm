import { Router, Request, Response, NextFunction } from 'express';
import { AIIntelligenceService } from './ai-intelligence.service';
import { authenticate, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validation';
import { UserRole } from '../../types';
import { z } from 'zod';

const router = Router();
const aiService = new AIIntelligenceService();

// ─── SCORING ───────────────────────────────────────────────────

router.post(
  '/scoring/engagement/:hcpId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await aiService.requestEngagementScore(req.params.hcpId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ─── NEXT BEST ACTION ─────────────────────────────────────────

router.post(
  '/nba/:hcpId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await aiService.requestNextBestAction(req.params.hcpId, req.user!.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/nba/pending',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const nbas = await aiService.getUserNBAs(req.user!.id);
      res.json({ success: true, data: nbas });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/nba/:id/respond',
  authenticate,
  validateBody(z.object({
    response: z.enum(['accepted', 'rejected']),
    reason: z.string().optional(),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await aiService.respondToNBA(req.params.id, req.body.response, req.body.reason);
      res.json({ success: true, data: { id: req.params.id, status: req.body.response } });
    } catch (error) {
      next(error);
    }
  }
);

// ─── ACCOUNT SUMMARY ──────────────────────────────────────────

router.get(
  '/summary/:hcpId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await aiService.requestAccountSummary(req.params.hcpId);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
);

// ─── COPILOT ───────────────────────────────────────────────────

router.post(
  '/copilot/chat',
  authenticate,
  validateBody(z.object({
    conversationId: z.string().uuid().nullable().optional(),
    message: z.string().min(1).max(2000),
    context: z.record(z.unknown()).optional(),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await aiService.sendCopilotMessage(
        req.user!.id,
        req.body.conversationId || null,
        req.body.message,
        req.body.context
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
