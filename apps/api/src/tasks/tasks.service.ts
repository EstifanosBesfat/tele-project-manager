import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectRole, Role, TaskStatus } from '@ethio/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { ProjectCompletionService } from '../projects/project-completion.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskDto, TaskFiltersDto, UpdateTaskDto } from './dto/task.dto';

const taskListInclude = {
  reporter: { select: { id: true, name: true, email: true, image: true } },
  assignee: { select: { id: true, name: true, email: true, image: true } },
  division: { select: { id: true, name: true } },
  images: true,
  project: { select: { id: true, name: true, status: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

const taskDetailInclude = {
  ...taskListInclude,
  comments: {
    include: {
      author: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  activityLogs: {
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' as const },
    take: 50,
  },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly projectCompletion: ProjectCompletionService,
  ) {}

  async findByProject(projectId: string, filters: TaskFiltersDto, user: AuthUser) {
    await this.projectsService.ensureCanAccess(projectId, user);

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TaskWhereInput = { projectId };

    if (filters.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.category) where.category = filters.category;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: taskListInclude,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(projectId: string, dto: CreateTaskDto, user: AuthUser) {
    await this.projectsService.ensureCanAccess(projectId, user);

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        category: dto.category,
        projectId,
        divisionId: dto.divisionId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        reporterId: user.id,
        assigneeId: dto.assigneeId,
        images: dto.imageUrls?.length
          ? { create: dto.imageUrls.map((url) => ({ url })) }
          : undefined,
      },
      include: taskDetailInclude,
    });

    await this.prisma.activityLog.create({
      data: {
        projectId,
        taskId: task.id,
        actorId: user.id,
        action: 'TASK_CREATED',
      },
    });

    if (dto.status === TaskStatus.DONE || task.status === TaskStatus.DONE) {
      await this.projectCompletion.syncProjectCompletion(projectId, user.id);
    }

    return task;
  }

  async findOne(taskId: string, user: AuthUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: taskDetailInclude,
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.projectsService.ensureCanAccess(task.projectId, user);
    return task;
  }

  async update(taskId: string, dto: UpdateTaskDto, user: AuthUser) {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    await this.ensureCanModifyTask(existing.projectId, user);

    const task = await this.prisma.$transaction(async (tx) => {
      if (dto.imageUrls) {
        await tx.taskImage.deleteMany({ where: { taskId } });
      }

      return tx.task.update({
        where: { id: taskId },
        data: {
          title: dto.title,
          description: dto.description,
          status: dto.status,
          priority: dto.priority,
          category: dto.category,
          divisionId: dto.divisionId,
          dueDate:
            dto.dueDate === null
              ? null
              : dto.dueDate
                ? new Date(dto.dueDate)
                : undefined,
          assigneeId: dto.assigneeId,
          images: dto.imageUrls?.length
            ? { create: dto.imageUrls.map((url) => ({ url })) }
            : undefined,
        },
        include: taskDetailInclude,
      });
    });

    await this.prisma.activityLog.create({
      data: {
        projectId: existing.projectId,
        taskId,
        actorId: user.id,
        action: 'TASK_UPDATED',
        oldValue: existing.status,
        newValue: task.status,
      },
    });

    if (dto.status !== undefined || existing.status !== task.status) {
      await this.projectCompletion.syncProjectCompletion(
        existing.projectId,
        user.id,
      );
    }

    return task;
  }

  async remove(taskId: string, user: AuthUser) {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, title: true },
    });

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    await this.ensureCanDeleteTask(existing.projectId, user);

    // Do not set taskId: the Task row is gone, and a pre-delete log would
    // cascade-delete with it. Title is kept on newValue for the timeline.
    await this.prisma.$transaction(async (tx) => {
      await tx.task.delete({ where: { id: taskId } });

      await tx.activityLog.create({
        data: {
          projectId: existing.projectId,
          actorId: user.id,
          action: 'TASK_DELETED',
          newValue: existing.title,
        },
      });

      await this.projectCompletion.syncProjectCompletion(
        existing.projectId,
        user.id,
        tx,
      );
    });

    return { message: 'Task deleted' };
  }

  async exportCsv(projectId: string, filters: TaskFiltersDto, user: AuthUser) {
    const result = await this.findByProject(
      projectId,
      { ...filters, page: 1, limit: 10000 },
      user,
    );

    const header = [
      'id',
      'title',
      'status',
      'priority',
      'category',
      'assignee',
      'dueDate',
      'createdAt',
    ];

    const rows = result.items.map((task) => [
      task.id,
      this.escapeCsv(task.title),
      task.status,
      task.priority,
      task.category,
      task.assignee?.email ?? '',
      task.dueDate?.toISOString() ?? '',
      task.createdAt.toISOString(),
    ]);

    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join(
      '\n',
    );

    return csv;
  }

  private escapeCsv(value: string) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private async ensureCanModifyTask(projectId: string, user: AuthUser) {
    if (user.role === Role.ADMIN) return;
    await this.projectsService.ensureCanAccess(projectId, user);
  }

  private async ensureCanDeleteTask(projectId: string, user: AuthUser) {
    if (user.role === Role.ADMIN) return;

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: user.id },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this project');
    }

    if (membership.role !== ProjectRole.OWNER) {
      throw new ForbiddenException('Only owners can delete tasks');
    }
  }
}
