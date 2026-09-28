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
});
