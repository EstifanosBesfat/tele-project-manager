import type { CookieOptions, Request, Response } from 'express';

export const AUTH_COOKIE_NAME = 'ethio_pm_token';
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const UNIT_MS = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

export function parseJwtExpiresToMs(raw: string | undefined): number {
  if (!raw || raw.trim() === '') {
    return DEFAULT_MAX_AGE_MS;
  }

  const match = /^(\d+)([smhd])$/i.exec(raw.trim());
  if (!match) {
    return DEFAULT_MAX_AGE_MS;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase() as keyof typeof UNIT_MS;
  return value * UNIT_MS[unit];
}

export function buildAuthCookieOptions(
  env: Record<string, string | undefined> = process.env,
): CookieOptions {
  const isProd = env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: parseJwtExpiresToMs(env.JWT_EXPIRES_IN),
  };
}

export function extractJwtFromCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    if (trimmed.slice(0, eq) !== AUTH_COOKIE_NAME) {
      continue;
    }
    return decodeURIComponent(trimmed.slice(eq + 1));
  }

  return null;
}

export function attachAuthCookie(res: Pick<Response, 'cookie'>, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, buildAuthCookieOptions());
}

export function clearAuthCookie(res: Pick<Response, 'clearCookie'>) {
  const options = buildAuthCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  });
}
