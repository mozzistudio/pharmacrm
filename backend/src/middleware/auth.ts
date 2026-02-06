import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticatedUser, JWTPayload, UserRole } from '../types';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Validates JWT token and attaches user to request.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;

    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      territoryIds: payload.territoryIds,
      permissions: [], // loaded from cache/DB in production
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
}

/**
 * Checks if user has one of the required roles.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Access denied: insufficient role', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
      });
      next(new ForbiddenError(`Role '${req.user.role}' does not have access to this resource`));
      return;
    }

    next();
  };
}

/**
 * Checks if user has a specific permission string.
 */
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    // Admin bypasses permission checks
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    if (!req.user.permissions.includes(permission)) {
      logger.warn('Access denied: missing permission', {
        userId: req.user.id,
        requiredPermission: permission,
        path: req.path,
      });
      next(new ForbiddenError(`Missing required permission: ${permission}`));
      return;
    }

    next();
  };
}

/**
 * Restricts data access to user's assigned territories.
 * Managers see their region; reps see their territory only.
 */
export function enforceTerritoryScope(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }

  // Admin and compliance officers see everything
  if ([UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER].includes(req.user.role)) {
    next();
    return;
  }

  // Attach territory filter to request for use by downstream handlers
  (req as Record<string, unknown>).territoryFilter = req.user.territoryIds;
  next();
}
