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

    // task.groupBy is called twice (status, category) — both must be scoped.
    for (const call of prismaMock.task.groupBy.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ where: expectedTaskWhere }));
    }

    expect(prismaMock.task.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining(expectedTaskWhere),
      }),
    );

    // task.findMany is called twice (recent trend, priority breakdown) — both scoped.
    for (const call of prismaMock.task.findMany.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          where: expect.objectContaining(expectedTaskWhere),
        }),
      );
    }
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

    for (const call of prismaMock.task.groupBy.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ where: {} }));
    }

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});
