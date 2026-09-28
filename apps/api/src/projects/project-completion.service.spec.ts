import { ProjectStatus, TaskStatus } from '@ethio/database';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectCompletionService } from './project-completion.service';

function createDbMock(tasks: { status: TaskStatus }[], projectStatus: ProjectStatus) {
  return {
    task: {
      findMany: jest.fn().mockResolvedValue(tasks),
    },
    project: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'proj-1',
        name: 'Core Infra',
        status: projectStatus,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    activityLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    projectMember: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    notification: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

function stubNotifications() {
  return { notify: jest.fn().mockResolvedValue(undefined) };
}

function buildService(notifications = stubNotifications()) {
  return {
    notifications,
    service: new ProjectCompletionService(
      {} as PrismaService,
      notifications as unknown as NotificationsService,
    ),
  };
}

describe('ProjectCompletionService.syncProjectCompletion', () => {
  it('uses the injected db client so callers can run inside a transaction', async () => {
    const db = createDbMock(
      [{ status: TaskStatus.DONE }],
      ProjectStatus.ACTIVE,
    );
    const { service } = buildService();

    await service.syncProjectCompletion('proj-1', 'actor-1', db);

    expect(db.task.findMany).toHaveBeenCalled();
    expect(db.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: { status: ProjectStatus.COMPLETED },
    });
    expect(db.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'PROJECT_AUTO_COMPLETED' }),
    });
  });

  it('notifies other project members when a project auto-completes', async () => {
    const db = createDbMock(
      [{ status: TaskStatus.DONE }],
      ProjectStatus.ACTIVE,
    );
    db.projectMember.findMany.mockResolvedValue([
      { userId: 'actor-1' },
      { userId: 'member-2' },
    ]);
    const { service, notifications } = buildService();

    await service.syncProjectCompletion('proj-1', 'actor-1', db);

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(
      {
        userId: 'member-2',
        projectId: 'proj-1',
        type: 'PROJECT_AUTO_COMPLETED',
        message: 'Project "Core Infra" was completed',
      },
      db,
    );
  });

  it('reopens a completed project when any task is not DONE', async () => {
    const db = createDbMock(
      [{ status: TaskStatus.DONE }, { status: TaskStatus.TODO }],
      ProjectStatus.COMPLETED,
    );
    const { service } = buildService();

    const result = await service.syncProjectCompletion('proj-1', 'actor-1', db);

    expect(result?.status).toBe(ProjectStatus.ACTIVE);
    expect(db.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: { status: ProjectStatus.ACTIVE },
    });
    expect(db.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'PROJECT_REOPENED' }),
    });
  });

  it('does not change status when a project has no tasks', async () => {
    const db = createDbMock([], ProjectStatus.ACTIVE);
    const { service } = buildService();

    await service.syncProjectCompletion('proj-1', 'actor-1', db);

    expect(db.project.update).not.toHaveBeenCalled();
    expect(db.activityLog.create).not.toHaveBeenCalled();
  });

  it('reopens a completed project whose progress is below 100%', async () => {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          status: ProjectStatus.COMPLETED,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([
          { status: TaskStatus.DONE },
          { status: TaskStatus.DONE },
          { status: TaskStatus.TODO },
        ]),
      },
    };
    const service = new ProjectCompletionService(
      prisma as unknown as PrismaService,
      stubNotifications() as unknown as NotificationsService,
    );

    await expect(service.getProjectProgress('proj-1')).resolves.toEqual({
      total: 3,
      done: 2,
      percent: 67,
      status: ProjectStatus.ACTIVE,
    });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: { status: ProjectStatus.ACTIVE },
    });
  });

  it('does not write a second auto-complete when already COMPLETED', async () => {
    const db = createDbMock(
      [{ status: TaskStatus.DONE }],
      ProjectStatus.COMPLETED,
    );
    const { service, notifications } = buildService();

    await service.syncProjectCompletion('proj-1', 'actor-1', db);

    expect(db.project.update).not.toHaveBeenCalled();
    expect(db.activityLog.create).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
