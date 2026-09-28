import { Injectable } from '@nestjs/common';
import { Prisma, ProjectStatus, TaskStatus } from '@ethio/database';
import { PrismaService } from '../prisma/prisma.service';

type CompletionDb = {
  task: Pick<Prisma.TransactionClient['task'], 'findMany'>;
  project: Pick<Prisma.TransactionClient['project'], 'findUnique' | 'update'>;
  activityLog: Pick<Prisma.TransactionClient['activityLog'], 'create'>;
};

@Injectable()
export class ProjectCompletionService {
  constructor(private readonly prisma: PrismaService) {}

  async syncProjectCompletion(
    projectId: string,
    actorId: string,
    db: CompletionDb = this.prisma,
  ) {
    const [tasks, project] = await Promise.all([
      db.task.findMany({
        where: { projectId },
        select: { status: true },
      }),
      db.project.findUnique({
        where: { id: projectId },
        select: { id: true, status: true },
      }),
    ]);

    if (!project || tasks.length === 0) {
      return project;
    }

    const allDone = tasks.every((task) => task.status === TaskStatus.DONE);

    if (allDone && project.status !== ProjectStatus.COMPLETED) {
      await db.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.COMPLETED },
      });

      await db.activityLog.create({
        data: {
          projectId,
          actorId,
          action: 'PROJECT_AUTO_COMPLETED',
          oldValue: ProjectStatus.ACTIVE,
          newValue: ProjectStatus.COMPLETED,
        },
      });

      return { ...project, status: ProjectStatus.COMPLETED };
    }

    if (!allDone && project.status === ProjectStatus.COMPLETED) {
      await db.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.ACTIVE },
      });

      await db.activityLog.create({
        data: {
          projectId,
          actorId,
          action: 'PROJECT_REOPENED',
          oldValue: ProjectStatus.COMPLETED,
          newValue: ProjectStatus.ACTIVE,
        },
      });

      return { ...project, status: ProjectStatus.ACTIVE };
    }

    return project;
  }

  async getProjectProgress(projectId: string) {
    const [project, tasks] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { status: true },
      }),
      this.prisma.task.findMany({
        where: { projectId },
        select: { status: true },
      }),
    ]);

    const total = tasks.length;
    const done = tasks.filter((task) => task.status === TaskStatus.DONE).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    return {
      total,
      done,
      percent,
      status: project?.status ?? ProjectStatus.ACTIVE,
    };
  }
}
