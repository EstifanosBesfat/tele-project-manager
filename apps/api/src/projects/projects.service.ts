import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectRole, Role } from '@ethio/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { InviteMemberDto, UpdateMemberDto } from './dto/member.dto';
import {
  CreateProjectDto,
  ListProjectsQueryDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ProjectCompletionService } from './project-completion.service';

const projectListInclude = {
  createdBy: { select: { id: true, name: true, email: true, image: true } },
  division: { select: { id: true, name: true } },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  },
  _count: { select: { tasks: true, members: true } },
} satisfies Prisma.ProjectInclude;

const projectDetailInclude = {
  ...projectListInclude,
  activityLogs: {
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' as const },
    take: 30,
  },
  tasks: {
    select: { id: true, status: true, dueDate: true, title: true },
  },
} satisfies Prisma.ProjectInclude;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectCompletion: ProjectCompletionService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(user: AuthUser, filters: ListProjectsQueryDto = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;
    const q = filters.q?.trim();

    const where: Prisma.ProjectWhereInput = {
      ...(user.role === Role.ADMIN
        ? {}
        : { members: { some: { userId: user.id } } }),
      ...(filters.status ? { status: filters.status } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: projectListInclude,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, user: AuthUser) {
    await this.ensureCanAccess(id, user);
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: projectDetailInclude,
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async create(dto: CreateProjectDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          divisionId: dto.divisionId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          createdById: user.id,
          members: {
            create: {
              userId: user.id,
              role: ProjectRole.OWNER,
            },
          },
        },
        include: projectDetailInclude,
      });

      await tx.activityLog.create({
        data: {
          projectId: project.id,
          actorId: user.id,
          action: 'PROJECT_CREATED',
        },
      });

      return project;
    });
  }

  async update(id: string, dto: UpdateProjectDto, user: AuthUser) {
    await this.ensureCanManage(id, user);

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        divisionId: dto.divisionId,
        dueDate:
          dto.dueDate === null
            ? null
            : dto.dueDate
              ? new Date(dto.dueDate)
              : undefined,
      },
      include: projectDetailInclude,
    });

    await this.prisma.activityLog.create({
      data: {
        projectId: id,
        actorId: user.id,
        action: 'PROJECT_UPDATED',
      },
    });

    return project;
  }

  async remove(id: string, user: AuthUser) {
    await this.ensureIsOwner(id, user);

    await this.prisma.project.delete({ where: { id } });
    return { message: 'Project deleted' };
  }

  async inviteMember(projectId: string, dto: InviteMemberDto, user: AuthUser) {
    await this.ensureCanManage(projectId, user);

    if (!dto.userId && !dto.email) {
      throw new BadRequestException('userId or email is required');
    }

    const memberUser = dto.userId
      ? await this.prisma.user.findUnique({ where: { id: dto.userId } })
      : await this.prisma.user.findUnique({
          where: { email: dto.email!.toLowerCase() },
        });

    if (!memberUser || !memberUser.isActive) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: memberUser.id },
      },
    });

    if (existing) {
      return this.prisma.projectMember.update({
        where: { id: existing.id },
        data: { role: dto.role ?? ProjectRole.MEMBER },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });
    }

    const membership = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: memberUser.id,
        role: dto.role ?? ProjectRole.MEMBER,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    if (memberUser.id !== user.id) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });
      await this.notifications.notify({
        userId: memberUser.id,
        projectId,
        type: 'PROJECT_INVITED',
        message: `${user.name ?? user.email} added you to "${project?.name ?? 'a project'}"`,
      });
    }

    return membership;
  }

  async updateMember(
    projectId: string,
    memberUserId: string,
    dto: UpdateMemberDto,
    user: AuthUser,
  ) {
    await this.ensureCanManage(projectId, user);

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: memberUserId },
      },
    });

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    if (
      membership.role === ProjectRole.OWNER &&
      dto.role !== ProjectRole.OWNER
    ) {
      const ownerCount = await this.prisma.projectMember.count({
        where: { projectId, role: ProjectRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException('Project must have at least one owner');
      }
    }

    return this.prisma.projectMember.update({
      where: { id: membership.id },
      data: { role: dto.role },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
  }

  async removeMember(projectId: string, memberUserId: string, user: AuthUser) {
    await this.ensureCanManage(projectId, user);

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: memberUserId },
      },
    });

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    if (membership.role === ProjectRole.OWNER) {
      const ownerCount = await this.prisma.projectMember.count({
        where: { projectId, role: ProjectRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException('Cannot remove the only owner');
      }
    }

    await this.prisma.projectMember.delete({ where: { id: membership.id } });
    return { message: 'Member removed' };
  }

  getProgress(projectId: string) {
    return this.projectCompletion.getProjectProgress(projectId);
  }

  async ensureCanAccess(projectId: string, user: AuthUser) {
    if (user.role === Role.ADMIN) return;

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: user.id },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this project');
    }
  }

  private async ensureCanManage(projectId: string, user: AuthUser) {
    if (user.role === Role.ADMIN) return;

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: user.id },
      },
    });

    if (!membership || membership.role !== ProjectRole.OWNER) {
      throw new ForbiddenException('Only project owners can manage members');
    }
  }

  private async ensureIsOwner(projectId: string, user: AuthUser) {
    if (user.role === Role.ADMIN) return;

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: user.id },
      },
    });

    if (!membership || membership.role !== ProjectRole.OWNER) {
      throw new ForbiddenException('Only project owners can delete projects');
    }
  }
}
