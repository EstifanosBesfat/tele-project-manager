import { resolvePoolMax } from '@ethio/database';

describe('resolvePoolMax', () => {
  it('defaults to 10 locally and 1 on Vercel', () => {
    expect(resolvePoolMax({})).toBe(10);
    expect(resolvePoolMax({ VERCEL: '1' })).toBe(1);
  });

  it('honors DATABASE_POOL_MAX and rejects invalid values', () => {
    expect(resolvePoolMax({ DATABASE_POOL_MAX: '3' })).toBe(3);
    expect(resolvePoolMax({ VERCEL: '1', DATABASE_POOL_MAX: '4' })).toBe(4);
    expect(resolvePoolMax({ DATABASE_POOL_MAX: '999' })).toBe(50);
    expect(() => resolvePoolMax({ DATABASE_POOL_MAX: '0' })).toThrow(
      /positive integer/,
    );
  });
});
