import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

/**
 * Global error handler. Must be registered last in middleware chain.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: (err as Record<string, unknown>).details,
      },
    };

    if (!err.isOperational) {
      logger.error('Non-operational error', { error: err });
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Unexpected errors
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
  });

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };

  res.status(500).json(response);
}
