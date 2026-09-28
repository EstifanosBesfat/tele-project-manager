import {
  AUTH_COOKIE_NAME,
  buildAuthCookieOptions,
  extractJwtFromCookie,
  parseJwtExpiresToMs,
} from './auth-cookie';
import type { Request } from 'express';

describe('auth cookie helpers', () => {
  it('parses JWT_EXPIRES_IN durations', () => {
    expect(parseJwtExpiresToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseJwtExpiresToMs('15m')).toBe(15 * 60 * 1000);
    expect(parseJwtExpiresToMs(undefined)).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('uses a host-only httpOnly cookie with SameSite=None in production', () => {
    expect(buildAuthCookieOptions({ NODE_ENV: 'development' })).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
    expect(
      buildAuthCookieOptions({ NODE_ENV: 'production', JWT_EXPIRES_IN: '1d' }),
    ).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000,
    });
  });

  it('reads the access token from the Cookie header', () => {
    const req = {
      headers: {
        cookie: `other=1; ${AUTH_COOKIE_NAME}=abc.def.ghi; extra=2`,
      },
    } as Request;

    expect(extractJwtFromCookie(req)).toBe('abc.def.ghi');
    expect(extractJwtFromCookie({ headers: {} } as Request)).toBeNull();
  });
});
