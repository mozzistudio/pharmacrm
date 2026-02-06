import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { validateBody } from '../../middleware/validation';
import { authenticate, requireRole } from '../../middleware/auth';
import { createAuditEntry, getRequestMeta } from '../../middleware/audit';
import { AuditAction, UserRole } from '../../types';
import { z } from 'zod';

const router = Router();
const authService = new AuthService();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum([
    'admin', 'manager', 'field_rep', 'medical_affairs',
    'marketing', 'compliance_officer', 'read_only',
  ]),
  territoryIds: z.array(z.string().uuid()).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Registration (admin only in production)
router.post(
  '/register',
  authenticate,
  requireRole(UserRole.ADMIN),
  validateBody(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body);

      await createAuditEntry({
        userId: req.user!.id,
        action: AuditAction.CREATE,
        entityType: 'user',
        entityId: result.user.id as string,
        newState: { email: req.body.email, role: req.body.role },
        ...getRequestMeta(req),
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Login
router.post(
  '/login',
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body);

      await createAuditEntry({
        userId: result.user.id as string,
        action: AuditAction.LOGIN,
        entityType: 'session',
        ...getRequestMeta(req),
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Token refresh
router.post(
  '/refresh',
  validateBody(z.object({ refreshToken: z.string() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.refreshToken(req.body.refreshToken);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Current user info
router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response) => {
    res.json({ success: true, data: req.user });
  }
);

export default router;
