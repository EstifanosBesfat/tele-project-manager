import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolConfig } from 'pg';
import { resolvePoolMax } from './pool-max';

export { resolvePoolMax } from './pool-max';

declare global {
  // eslint-disable-next-line no-var
  var __ethioPrisma__: PrismaClient | undefined;
}

function buildPoolConfig(databaseUrl: string): PoolConfig {
  const isNeon =
    databaseUrl.includes('neon.tech') ||
    databaseUrl.includes('sslmode=require');

  return {
    connectionString: databaseUrl,
    // Neon requires TLS; local Docker Postgres does not.
    ...(isNeon ? { ssl: { rejectUnauthorized: false } } : {}),
    max: resolvePoolMax(),
  };
}

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool(buildPoolConfig(databaseUrl));
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma =
  globalThis.__ethioPrisma__ ??
  createPrismaClient(
    process.env.DATABASE_URL ??
      'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  );

if (process.env.NODE_ENV !== 'production') {
  globalThis.__ethioPrisma__ = prisma;
}

export default prisma;
