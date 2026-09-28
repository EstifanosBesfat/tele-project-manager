import {
  AUTH_THROTTLE,
  AUTH_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_MS,
} from './auth-throttle';

describe('AUTH_THROTTLE', () => {
  it('limits public auth routes to 5 requests per minute', () => {
    expect(AUTH_THROTTLE_LIMIT).toBe(5);
    expect(AUTH_THROTTLE_TTL_MS).toBe(60_000);
    expect(AUTH_THROTTLE.default).toEqual({
      limit: 5,
      ttl: 60_000,
    });
  });
});
