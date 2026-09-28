import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectRole, Role, TaskStatus } from '@ethio/database';
import { CreateTaskDto } from './dto/task.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectCompletionService } from '../projects/project-completion.service';
import { ProjectsService } from '../projects/projects.service';
import { AuthUser } from '../common/types/auth-user.type';
import { TasksService } from './tasks.service';

function createPrismaMock() {
  const prismaMock = {
    task: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    projectMember: {
      findUnique: jest.fn(),
    },
    activityLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  };

  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
    fn(prismaMock),
  );

  return prismaMock;
}

function stubNotifications(): NotificationsService {
  return { notify: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService;
}

function adminUser(): AuthUser {
  return {
    id: 'admin-1',
    email: 'admin@example.com',
    role: Role.ADMIN,
    name: 'Admin',
  };
}

describe('TasksService.create', () => {
  it('syncs project completion even when the new task is not done', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.task.create = jest.fn().mockResolvedValue({
      id: 'task-2',
      title: 'Verify remaining settlements',
      status: TaskStatus.TODO,
      assigneeId: null,
    });

    const projectCompletion = {
      syncProjectCompletion: jest.fn().mockResolvedValue({}),
    };
    const projectsService = {
      ensureCanAccess: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TasksService(
      prismaMock as unknown as PrismaService,
      projectsService as unknown as ProjectsService,
      projectCompletion as unknown as ProjectCompletionService,
      stubNotifications(),
    );

    const dto = new CreateTaskDto();
    dto.title = 'Verify remaining settlements';
    dto.status = TaskStatus.TODO;

    await service.create('proj-1', dto, adminUser());

    expect(projectCompletion.syncProjectCompletion).toHaveBeenCalledWith(
      'proj-1',
      'admin-1',
    );
  });
});

describe('TasksService.remove', () => {
  it('deletes the task, writes a project-level log, and syncs completion in one transaction', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.task.findUnique.mockResolvedValue({
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Fix fiber cut',
    });

    const projectCompletion = {
      syncProjectCompletion: jest.fn().mockResolvedValue({}),
    };
    const service = new TasksService(
      prismaMock as unknown as PrismaService,
      {} as ProjectsService,
      projectCompletion as unknown as ProjectCompletionService,
      stubNotifications(),
    );

    await service.remove('task-1', adminUser());

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.task.delete).toHaveBeenCalledWith({
      where: { id: 'task-1' },
    });

    const logData = prismaMock.activityLog.create.mock.calls[0][0].data;
    expect(logData).toEqual({
      projectId: 'proj-1',
      actorId: 'admin-1',
      action: 'TASK_DELETED',
      newValue: 'Fix fiber cut',
    });
    expect(logData.taskId).toBeUndefined();

    expect(projectCompletion.syncProjectCompletion).toHaveBeenCalledWith(
      'proj-1',
      'admin-1',
      prismaMock,
    );
  });

  it('does not delete when the task is missing', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.task.findUnique.mockResolvedValue(null);
    const projectCompletion = {
      syncProjectCompletion: jest.fn(),
    };
    const service = new TasksService(
      prismaMock as unknown as PrismaService,
      {} as ProjectsService,
      projectCompletion as unknown as ProjectCompletionService,
      stubNotifications(),
    );

    await expect(service.remove('missing', adminUser())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(projectCompletion.syncProjectCompletion).not.toHaveBeenCalled();
  });

  it('forbids a non-owner member from deleting a task', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.task.findUnique.mockResolvedValue({
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Fix fiber cut',
    });
    prismaMock.projectMember.findUnique.mockResolvedValue({
      role: ProjectRole.MEMBER,
    });
    const projectCompletion = {
      syncProjectCompletion: jest.fn(),
    };
    const service = new TasksService(
      prismaMock as unknown as PrismaService,
      {} as ProjectsService,
      projectCompletion as unknown as ProjectCompletionService,
      stubNotifications(),
    );

    await expect(
      service.remove('task-1', {
        id: 'member-1',
        email: 'member@example.com',
        role: Role.USER,
        name: 'Member',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe('TasksService.exportCsv', () => {
  it('exports a slim column set with a 5000-row cap instead of the list page size', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Fix fiber',
        status: 'TODO',
        priority: 'HIGH',
        category: 'FIBER_BROADBAND',
        dueDate: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        assignee: { email: 'staff@example.com' },
      },
    ]);
    const projectsService = {
      ensureCanAccess: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TasksService(
      prismaMock as unknown as PrismaService,
      projectsService as unknown as ProjectsService,
      {} as ProjectCompletionService,
      stubNotifications(),
    );

    const csv = await service.exportCsv('proj-1', {}, adminUser());

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'proj-1' },
        take: 5000,
        select: expect.objectContaining({
          id: true,
          title: true,
          assignee: { select: { email: true } },
        }),
      }),
    );
    expect(csv).toContain('id,title,status,priority,category,assignee,dueDate,createdAt');
    expect(csv).toContain('staff@example.com');
  });
});
