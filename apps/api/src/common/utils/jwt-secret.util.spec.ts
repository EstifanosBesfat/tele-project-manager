import { InvalidJwtSecretError, resolveJwtSecret } from './jwt-secret.util';

describe('resolveJwtSecret', () => {
  it('throws InvalidJwtSecretError when the secret is undefined', () => {
    expect(() => resolveJwtSecret(undefined)).toThrow(InvalidJwtSecretError);
  });

  it('throws InvalidJwtSecretError when the secret is empty or whitespace', () => {
    expect(() => resolveJwtSecret('')).toThrow(InvalidJwtSecretError);
    expect(() => resolveJwtSecret('   ')).toThrow(InvalidJwtSecretError);
  });

  it('throws InvalidJwtSecretError when the secret is shorter than 32 characters', () => {
    expect(() => resolveJwtSecret('short-secret')).toThrow(
      InvalidJwtSecretError,
    );
  });

  it('never falls back to a hardcoded default secret', () => {
    expect(() => resolveJwtSecret(undefined)).not.toThrow(
      /dev-secret-change-me/,
    );

    try {
      resolveJwtSecret(undefined);
    } catch (error) {
      expect((error as Error).message).not.toContain('dev-secret-change-me');
    }
  });

  it('returns the secret unchanged when it is valid', () => {
    const validSecret = 'a'.repeat(32);
    expect(resolveJwtSecret(validSecret)).toBe(validSecret);
  });

  it('accepts secrets longer than the minimum length', () => {
    const validSecret = 'change-me-to-a-long-random-string-1234567890';
    expect(resolveJwtSecret(validSecret)).toBe(validSecret);
  });
});
