import { ForbiddenException } from '@nestjs/common';
import { Role } from '@ethio/database';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { ProjectCompletionService } from './project-completion.service';
import { ProjectsService } from './projects.service';

function buildUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    role: Role.USER,
    name: 'Member',
    ...overrides,
  };
}

function createPrismaMock() {
  return {
    project: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    projectMember: {
      findUnique: jest.fn(),
    },
  };
}

function buildService(prismaMock: ReturnType<typeof createPrismaMock>) {
  return new ProjectsService(
    prismaMock as unknown as PrismaService,
    {} as ProjectCompletionService,
    {} as NotificationsService,
  );
}

describe('ProjectsService access', () => {
  it('lists every project for ADMIN and only memberships for a regular user', async () => {
    const prismaMock = createPrismaMock();
    const service = buildService(prismaMock);

    await service.findAll(buildUser({ role: Role.ADMIN }));
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );

    await service.findAll(buildUser({ id: 'member-1', role: Role.USER }));
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { members: { some: { userId: 'member-1' } } },
      }),
    );
  });

  it('lets ADMIN access any project without a membership lookup', async () => {
    const prismaMock = createPrismaMock();
    const service = buildService(prismaMock);

    await expect(
      service.ensureCanAccess('proj-1', buildUser({ role: Role.ADMIN })),
    ).resolves.toBeUndefined();
    expect(prismaMock.projectMember.findUnique).not.toHaveBeenCalled();
  });

  it('lets a project member through and forbids a non-member', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.projectMember.findUnique
      .mockResolvedValueOnce({ id: 'mem-1' })
      .mockResolvedValueOnce(null);
    const service = buildService(prismaMock);
    const user = buildUser({ id: 'member-1' });

    await expect(service.ensureCanAccess('proj-1', user)).resolves.toBeUndefined();
    await expect(service.ensureCanAccess('proj-1', user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
