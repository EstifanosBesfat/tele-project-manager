import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectRole, Role } from '@ethio/database';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../types/auth-user.type';
import { ProjectMemberGuard } from './project-member.guard';
import { ProjectOwnerGuard } from './project-owner.guard';

function buildUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    role: Role.USER,
    name: 'Member',
    ...overrides,
  };
}

function createContext(
  user: AuthUser | undefined,
  params: Record<string, string> = { id: 'proj-1' },
) {
  const request: {
    user?: AuthUser;
    params: Record<string, string>;
    projectMembership?: { role: string };
  } = { user, params };

  return {
    request,
    context: {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext,
  };
}

describe('ProjectMemberGuard', () => {
  it('allows ADMIN without checking membership', async () => {
    const prisma = {
      project: { findUnique: jest.fn() },
      projectMember: { findUnique: jest.fn() },
    };
    const guard = new ProjectMemberGuard(prisma as unknown as PrismaService);
    const { context } = createContext(buildUser({ role: Role.ADMIN }));

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
  });

  it('allows a member and stores membership on the request', async () => {
    const membership = { id: 'mem-1', role: ProjectRole.MEMBER };
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ id: 'proj-1' }) },
      projectMember: { findUnique: jest.fn().mockResolvedValue(membership) },
    };
    const guard = new ProjectMemberGuard(prisma as unknown as PrismaService);
    const { context, request } = createContext(buildUser({ id: 'member-1' }));

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.projectMembership).toEqual(membership);
  });

  it('rejects a non-member and a missing project', async () => {
    const prisma = {
      project: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'proj-1' })
          .mockResolvedValueOnce(null),
      },
      projectMember: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const guard = new ProjectMemberGuard(prisma as unknown as PrismaService);

    await expect(
      guard.canActivate(createContext(buildUser()).context),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      guard.canActivate(createContext(buildUser()).context),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ProjectOwnerGuard', () => {
  it('rejects a MEMBER and allows an OWNER', async () => {
    const memberPrisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ id: 'proj-1' }) },
      projectMember: {
        findUnique: jest.fn().mockResolvedValue({ role: ProjectRole.MEMBER }),
      },
    };
    const ownerPrisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ id: 'proj-1' }) },
      projectMember: {
        findUnique: jest.fn().mockResolvedValue({ role: ProjectRole.OWNER }),
      },
    };

    const memberGuard = new ProjectOwnerGuard(
      memberPrisma as unknown as PrismaService,
    );
    const ownerGuard = new ProjectOwnerGuard(
      ownerPrisma as unknown as PrismaService,
    );

    await expect(
      memberGuard.canActivate(createContext(buildUser()).context),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      ownerGuard.canActivate(createContext(buildUser()).context),
    ).resolves.toBe(true);
  });
});
