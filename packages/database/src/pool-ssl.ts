import type { PoolConfig } from 'pg';

function urlRequiresTls(databaseUrl: string): boolean {
  const lower = databaseUrl.toLowerCase();
  if (lower.includes('sslmode=disable')) {
    return false;
  }
  return (
    lower.includes('neon.tech') ||
    lower.includes('sslmode=require') ||
    lower.includes('sslmode=verify-ca') ||
    lower.includes('sslmode=verify-full')
  );
}

/**
 * TLS settings for pg.Pool. Neon (and any URL that asks for SSL) gets a
 * verified TLS connection. Local Docker Postgres stays unencrypted.
 */
export function resolvePoolSsl(
  databaseUrl: string,
): PoolConfig['ssl'] {
  if (!urlRequiresTls(databaseUrl)) {
    return undefined;
  }

  return { rejectUnauthorized: true };
}
