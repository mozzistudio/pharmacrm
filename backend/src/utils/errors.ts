export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} with id '${id}' not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
    if (details) {
      (this as Record<string, unknown>).details = details;
    }
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConsentRequiredError extends AppError {
  constructor(hcpId: string, consentType: string) {
    super(
      `Consent of type '${consentType}' required for HCP '${hcpId}'`,
      403,
      'CONSENT_REQUIRED'
    );
  }
}

export class ComplianceViolationError extends AppError {
  constructor(message: string) {
    super(message, 403, 'COMPLIANCE_VIOLATION');
  }
}
