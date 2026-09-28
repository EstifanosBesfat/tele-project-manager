import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectRole, Role } from '@ethio/database';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectCompletionService } from '../projects/project-completion.service';
import { ProjectsService } from '../projects/projects.service';
import { AuthUser } from '../common/types/auth-user.type';
import { TasksService } from './tasks.service';

function createPrismaMock() {
  const prismaMock = {
    task: {
      findUnique: jest.fn(),
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

function adminUser(): AuthUser {
  return {
    id: 'admin-1',
    email: 'admin@example.com',
    role: Role.ADMIN,
    name: 'Admin',
  };
}

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
