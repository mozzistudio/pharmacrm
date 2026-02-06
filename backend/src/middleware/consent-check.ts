import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../database/connection';
import { ConsentRequiredError } from '../utils/errors';
import { ConsentType, ConsentStatus } from '../types';
import { logger } from '../utils/logger';

/**
 * Middleware that verifies active consent exists for the target HCP
 * before allowing channel-specific engagement.
 *
 * This is a HARD BLOCK — no consent = no action.
 */
export function requireConsent(consentType: ConsentType) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const hcpId = req.params.hcpId || req.body?.hcpId;

    if (!hcpId) {
      next();
      return;
    }

    try {
      const db = getDatabase();

      // Get the most recent consent record for this HCP + type
      const consent = await db('consents')
        .where({ hcp_id: hcpId, consent_type: consentType })
        .orderBy('created_at', 'desc')
        .first();

      if (!consent || consent.status !== ConsentStatus.GRANTED) {
        logger.warn('Consent check failed', {
          hcpId,
          consentType,
          consentStatus: consent?.status || 'none',
          userId: req.user?.id,
        });
        next(new ConsentRequiredError(hcpId, consentType));
        return;
      }

      // Check expiration
      if (consent.expires_at && new Date(consent.expires_at) < new Date()) {
        logger.warn('Consent expired', { hcpId, consentType, expiredAt: consent.expires_at });
        next(new ConsentRequiredError(hcpId, consentType));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
