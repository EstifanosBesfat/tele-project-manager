/** Shared auth rate-limit policy. Applied only to public /auth routes. */
export const AUTH_THROTTLE_TTL_MS = 60_000;
export const AUTH_THROTTLE_LIMIT = 5;

export const AUTH_THROTTLE = {
  default: {
    limit: AUTH_THROTTLE_LIMIT,
    ttl: AUTH_THROTTLE_TTL_MS,
  },
};
