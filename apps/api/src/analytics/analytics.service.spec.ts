import { Role } from '@ethio/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { AnalyticsService } from './analytics.service';

function createPrismaMock() {
  return {
    project: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    task: {
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function buildUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    role: Role.USER,
    name: 'Test User',
    ...overrides,
  };
}

describe('AnalyticsService.getDashboard', () => {
  it('scopes every query to the caller\'s projects for a non-admin user', async () => {
    const prismaMock = createPrismaMock();
    const service = new AnalyticsService(
      prismaMock as unknown as PrismaService,
    );
    const user = buildUser({ id: 'member-1', role: Role.USER });

    await service.getDashboard(user);

    const expectedProjectWhere = { members: { some: { userId: 'member-1' } } };
    const expectedTaskWhere = {
      project: { members: { some: { userId: 'member-1' } } },
    };

    expect(prismaMock.project.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedProjectWhere }),
    );

    // task.groupBy is called for status, category, and priority — all scoped.
    expect(prismaMock.task.groupBy).toHaveBeenCalledTimes(3);
    for (const call of prismaMock.task.groupBy.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ where: expectedTaskWhere }));
    }

    expect(prismaMock.task.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['priority'] }),
    );

    expect(prismaMock.task.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining(expectedTaskWhere),
      }),
    );

    // Only the 7-day trend loads rows, and only createdAt.
    expect(prismaMock.task.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining(expectedTaskWhere),
        select: { createdAt: true },
      }),
    );
  });

  it('does not scope queries for an ADMIN user (org-wide dashboard)', async () => {
    const prismaMock = createPrismaMock();
    const service = new AnalyticsService(
      prismaMock as unknown as PrismaService,
    );
    const admin = buildUser({ id: 'admin-1', role: Role.ADMIN });

    await service.getDashboard(admin);

    expect(prismaMock.project.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );

    expect(prismaMock.task.groupBy).toHaveBeenCalledTimes(3);
    for (const call of prismaMock.task.groupBy.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ where: {} }));
    }

    expect(prismaMock.task.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: expect.any(Object) }),
        select: { createdAt: true },
      }),
    );
  });

  it('aggregates totalTasks from status groupBy instead of loading every row', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.task.groupBy.mockImplementation(async (args: { by: string[] }) => {
      if (args.by[0] === 'status') {
        return [
          { status: 'TODO', _count: { _all: 2 } },
          { status: 'DONE', _count: { _all: 3 } },
        ];
      }
      return [];
    });
    const service = new AnalyticsService(
      prismaMock as unknown as PrismaService,
    );

    const result = await service.getDashboard(buildUser({ role: Role.ADMIN }));

    expect(result.totalTasks).toBe(5);
    expect(prismaMock.task.findMany).toHaveBeenCalledTimes(1);
  });
});
