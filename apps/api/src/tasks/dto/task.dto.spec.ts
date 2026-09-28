import { validate } from 'class-validator';
import { CreateTaskDto } from './task.dto';

const CUID = 'clh5x2k4x0000123456789012';
const UUID = '550e8400-e29b-41d4-a716-446655440000';

function buildDto(overrides: Partial<CreateTaskDto> = {}) {
  const dto = new CreateTaskDto();
  dto.title = 'Repair fiber cut';
  dto.description = 'Site visit required';
  Object.assign(dto, overrides);
  return dto;
}

describe('CreateTaskDto assigneeId and divisionId', () => {
  it('accepts Prisma cuid values for assignee and division', async () => {
    const dto = buildDto({ assigneeId: CUID, divisionId: CUID });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects UUID values that previously passed IsUUID but are not user/division ids', async () => {
    const dto = buildDto({ assigneeId: UUID, divisionId: UUID });
    const errors = await validate(dto);
    const properties = errors.map((error) => error.property).sort();
    expect(properties).toEqual(['assigneeId', 'divisionId']);
  });
});
