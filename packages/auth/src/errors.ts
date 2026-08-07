import { ValidationError, DuplicateEmailError } from "./signup.js";

import {
  AccountLockedError,
  AccountSuspendedError,
  AccountDisabledError,
  PendingVerificationError,
  AuthenticationFailureError,
  MaxSessionsExceededError,
} from "./login.js";

import {
  InvalidTokenError,
  SessionNotFoundError,
  CredentialNotFoundError,
  ReplayAttackDetectedError,
  SessionExpiredError,
  SessionRevokedError,
} from "./token.js";

export interface AbstractHttpResponse {
  statusCode: number;
  body: {
    success: boolean;
    code: string;
    message: string;
    errors?: unknown;
  };
}

/**
 * Standardized mapping utility to convert authentication domain exceptions
 * into transport-agnostic HTTP status and payload descriptions.
 */
export function mapAuthError(err: unknown): AbstractHttpResponse {
  if (err instanceof ValidationError) {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: "VALIDATION_FAILED",
        message: err.message,
        errors: err.errors,
      },
    };
  }

  if (err instanceof DuplicateEmailError) {
    return {
      statusCode: 409,
      body: {
        success: false,
        code: "DUPLICATE_EMAIL",
        message: err.message,
      },
    };
  }

  if (err instanceof AccountLockedError) {
    return {
      statusCode: 423,
      body: {
        success: false,
        code: "ACCOUNT_LOCKED",
        message: err.message,
      },
    };
  }

  if (err instanceof AccountSuspendedError) {
    return {
      statusCode: 403,
      body: {
        success: false,
        code: "ACCOUNT_SUSPENDED",
        message: err.message,
      },
    };
  }

  if (err instanceof AccountDisabledError) {
    return {
      statusCode: 403,
      body: {
        success: false,
        code: "ACCOUNT_DISABLED",
        message: err.message,
      },
    };
  }

  if (err instanceof PendingVerificationError) {
    return {
      statusCode: 403,
      body: {
        success: false,
        code: "PENDING_VERIFICATION",
        message: err.message,
      },
    };
  }

  if (err instanceof AuthenticationFailureError) {
    return {
      statusCode: 401,
      body: {
        success: false,
        code: "INVALID_CREDENTIALS",
        message: err.message,
      },
    };
  }

  if (err instanceof MaxSessionsExceededError) {
    return {
      statusCode: 429,
      body: {
        success: false,
        code: "MAX_SESSIONS_EXCEEDED",
        message: err.message,
      },
    };
  }

  if (
    err instanceof InvalidTokenError ||
    err instanceof SessionExpiredError ||
    err instanceof SessionRevokedError ||
    err instanceof SessionNotFoundError ||
    err instanceof CredentialNotFoundError ||
    err instanceof ReplayAttackDetectedError
  ) {
    let code = "UNAUTHORIZED";
    if (err instanceof SessionExpiredError) {
      code = "SESSION_EXPIRED";
    } else if (err instanceof SessionRevokedError) {
      code = "SESSION_REVOKED";
    } else if (err instanceof ReplayAttackDetectedError) {
      code = "REPLAY_ATTACK_DETECTED";
    }

    return {
      statusCode: 401,
      body: {
        success: false,
        code,
        message: (err as Error).message,
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      success: false,
      code: "INTERNAL_ERROR",
      message: "An infrastructure error occurred.",
    },
  };
}
