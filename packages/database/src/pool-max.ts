const MAX_ALLOWED_POOL_SIZE = 50;
const DEFAULT_LOCAL_POOL_SIZE = 10;
const DEFAULT_SERVERLESS_POOL_SIZE = 1;

/**
 * pg.Pool `max` per process. Serverless hosts (Vercel sets VERCEL=1) default
 * to 1 so many cold instances do not exhaust Neon's connection limit.
 * Override with DATABASE_POOL_MAX.
 */
export function resolvePoolMax(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.DATABASE_POOL_MAX;
  if (raw !== undefined && raw.trim() !== '') {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('DATABASE_POOL_MAX must be a positive integer');
    }
    return Math.min(parsed, MAX_ALLOWED_POOL_SIZE);
  }

  if (env.VERCEL === '1') {
    return DEFAULT_SERVERLESS_POOL_SIZE;
  }

  return DEFAULT_LOCAL_POOL_SIZE;
}
