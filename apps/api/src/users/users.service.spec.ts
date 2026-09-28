import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@ethio/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { UsersService } from './users.service';

function createPrismaMock() {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    projectMember: {
      findUnique: jest.fn(),
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

describe('UsersService.searchUsers', () => {
  it('rejects queries shorter than 2 characters', async () => {
    const prismaMock = createPrismaMock();
    const service = new UsersService(prismaMock as unknown as PrismaService);

    await expect(service.searchUsers(buildUser(), 'a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('scopes a non-admin with no projectId to users who share a project', async () => {
    const prismaMock = createPrismaMock();
    const service = new UsersService(prismaMock as unknown as PrismaService);
    const caller = buildUser({ id: 'member-1' });

    await service.searchUsers(caller, 'ab');

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          memberships: {
            some: {
              project: { members: { some: { userId: 'member-1' } } },
            },
          },
        }),
        select: expect.not.objectContaining({ role: true }),
      }),
    );
    expect(prismaMock.project.findUnique).not.toHaveBeenCalled();
  });

  it('scopes a non-admin with projectId to that project\'s members after checking membership', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.project.findUnique.mockResolvedValue({ id: 'proj-1' });
    prismaMock.projectMember.findUnique.mockResolvedValue({
      id: 'mem-1',
      role: 'MEMBER',
    });
    const service = new UsersService(prismaMock as unknown as PrismaService);
    const caller = buildUser({ id: 'member-1' });

    await service.searchUsers(caller, 'ab', 'proj-1');

    expect(prismaMock.projectMember.findUnique).toHaveBeenCalledWith({
      where: {
        projectId_userId: { projectId: 'proj-1', userId: 'member-1' },
      },
    });
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberships: { some: { projectId: 'proj-1' } },
        }),
      }),
    );
  });

  it('forbids a non-admin from searching a project they do not belong to', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.project.findUnique.mockResolvedValue({ id: 'proj-1' });
    prismaMock.projectMember.findUnique.mockResolvedValue(null);
    const service = new UsersService(prismaMock as unknown as PrismaService);

    await expect(
      service.searchUsers(buildUser(), 'ab', 'proj-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('returns 404 when the project does not exist', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.project.findUnique.mockResolvedValue(null);
    const service = new UsersService(prismaMock as unknown as PrismaService);

    await expect(
      service.searchUsers(buildUser(), 'ab', 'missing-proj'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('lets ADMIN search a project without a membership check, still scoped to members', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.project.findUnique.mockResolvedValue({ id: 'proj-1' });
    const service = new UsersService(prismaMock as unknown as PrismaService);
    const admin = buildUser({ id: 'admin-1', role: Role.ADMIN });

    await service.searchUsers(admin, 'ab', 'proj-1');

    expect(prismaMock.projectMember.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberships: { some: { projectId: 'proj-1' } },
        }),
        select: expect.objectContaining({ role: true }),
      }),
    );
  });

  it('lets ADMIN search the org when no projectId is given, including role', async () => {
    const prismaMock = createPrismaMock();
    const service = new UsersService(prismaMock as unknown as PrismaService);
    const admin = buildUser({ id: 'admin-1', role: Role.ADMIN });

    await service.searchUsers(admin, 'ab');

    const call = prismaMock.user.findMany.mock.calls[0][0];
    expect(call.where.memberships).toBeUndefined();
    expect(call.select.role).toBe(true);
  });
});
