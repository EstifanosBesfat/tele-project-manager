import { IsOptional, validate } from 'class-validator';
import { isCuid, IsCuid } from './cuid.util';

class SampleDto {
  @IsOptional()
  @IsCuid()
  id?: string | null;
}

describe('isCuid', () => {
  it('accepts a Prisma cuid v1', () => {
    expect(isCuid('clh5x2k4x0000123456789012')).toBe(true);
  });

  it('rejects UUIDs, short strings, and non-strings', () => {
    expect(isCuid('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    expect(isCuid('short')).toBe(false);
    expect(isCuid('')).toBe(false);
    expect(isCuid(null)).toBe(false);
    expect(isCuid(undefined)).toBe(false);
  });
});

describe('IsCuid DTO decorator', () => {
  it('accepts a cuid on optional fields', async () => {
    const dto = new SampleDto();
    dto.id = 'clh5x2k4x0000123456789012';
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a UUID where a cuid is required', async () => {
    const dto = new SampleDto();
    dto.id = '550e8400-e29b-41d4-a716-446655440000';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('must be a cuid');
  });

  it('allows null and undefined because the field is optional', async () => {
    const unset = new SampleDto();
    expect(await validate(unset)).toHaveLength(0);

    const cleared = new SampleDto();
    cleared.id = null;
    expect(await validate(cleared)).toHaveLength(0);
  });
});
