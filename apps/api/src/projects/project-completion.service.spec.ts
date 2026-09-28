import { ProjectStatus, TaskStatus } from '@ethio/database';
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
        status: projectStatus,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    activityLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('ProjectCompletionService.syncProjectCompletion', () => {
  it('uses the injected db client so callers can run inside a transaction', async () => {
    const db = createDbMock(
      [{ status: TaskStatus.DONE }],
      ProjectStatus.ACTIVE,
    );
    const service = new ProjectCompletionService({} as PrismaService);

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

  it('reopens a completed project when any task is not DONE', async () => {
    const db = createDbMock(
      [{ status: TaskStatus.DONE }, { status: TaskStatus.TODO }],
      ProjectStatus.COMPLETED,
    );
    const service = new ProjectCompletionService({} as PrismaService);

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
    const service = new ProjectCompletionService({} as PrismaService);

    await service.syncProjectCompletion('proj-1', 'actor-1', db);

    expect(db.project.update).not.toHaveBeenCalled();
    expect(db.activityLog.create).not.toHaveBeenCalled();
  });

  it('does not write a second auto-complete when already COMPLETED', async () => {
    const db = createDbMock(
      [{ status: TaskStatus.DONE }],
      ProjectStatus.COMPLETED,
    );
    const service = new ProjectCompletionService({} as PrismaService);

    await service.syncProjectCompletion('proj-1', 'actor-1', db);

    expect(db.project.update).not.toHaveBeenCalled();
    expect(db.activityLog.create).not.toHaveBeenCalled();
  });
});
