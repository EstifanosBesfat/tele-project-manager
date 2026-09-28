import { isDatabaseUnavailableError } from './prisma-exception.filter';

describe('isDatabaseUnavailableError', () => {
  it('detects connection timeouts and refused hosts', () => {
    expect(isDatabaseUnavailableError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isDatabaseUnavailableError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isDatabaseUnavailableError({ code: 'P1001' })).toBe(true);
    expect(isDatabaseUnavailableError({ code: 'P2002' })).toBe(false);
    expect(isDatabaseUnavailableError(new Error('nope'))).toBe(false);
  });
});
