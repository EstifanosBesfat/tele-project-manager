const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Thrown when JWT_SECRET is missing or too weak. Kept as a distinct class so
 * callers (and tests) can distinguish a misconfiguration error from any other
 * startup failure.
 */
export class InvalidJwtSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJwtSecretError';
  }
}

/**
 * Validates the JWT signing secret and returns it.
 *
 * There is intentionally NO hardcoded fallback here. This repository is
 * public, so a fallback like `'dev-secret-change-me'` would let anyone who
 * reads the source forge valid JWTs (including admin tokens) whenever
 * JWT_SECRET is missing in a deployed environment. Failing fast at startup
 * is safer than silently running with a known secret.
 */
export function resolveJwtSecret(rawSecret: string | undefined): string {
  if (!rawSecret || rawSecret.trim().length === 0) {
    throw new InvalidJwtSecretError(
      'JWT_SECRET environment variable is not set. Set it to a long, random ' +
        `string (at least ${MIN_JWT_SECRET_LENGTH} characters) before starting the API.`,
    );
  }

  if (rawSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new InvalidJwtSecretError(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long ` +
        `(got ${rawSecret.length}). Use a longer random string.`,
    );
  }

  return rawSecret;
}
