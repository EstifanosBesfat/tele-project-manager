import type { PoolConfig } from 'pg';

function hostnameOf(databaseUrl: string): string {
  try {
    return new URL(databaseUrl.replace(/^postgresql:/i, 'http:')).hostname;
  } catch {
    return '';
  }
}

function urlRequiresTls(databaseUrl: string): boolean {
  const lower = databaseUrl.toLowerCase();
  if (lower.includes('sslmode=disable')) {
    return false;
  }
  if (
    lower.includes('sslmode=require') ||
    lower.includes('sslmode=verify-ca') ||
    lower.includes('sslmode=verify-full')
  ) {
    return true;
  }

  const host = hostnameOf(databaseUrl).toLowerCase();
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return false;
  }

  return true;
}

/**
 * TLS settings for pg.Pool. Remote hosts (Neon, Railway, etc.) get a verified
 * TLS connection. Local Docker/Postgres stays unencrypted.
 */
export function resolvePoolSsl(databaseUrl: string): PoolConfig['ssl'] {
  if (!urlRequiresTls(databaseUrl)) {
    return undefined;
  }

  return { rejectUnauthorized: true };
}
