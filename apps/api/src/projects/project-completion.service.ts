import { Injectable } from '@nestjs/common';
import { Prisma, ProjectStatus, TaskStatus } from '@ethio/database';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

type CompletionDb = {
  task: Pick<Prisma.TransactionClient['task'], 'findMany'>;
  project: Pick<Prisma.TransactionClient['project'], 'findUnique' | 'update'>;
  activityLog: Pick<Prisma.TransactionClient['activityLog'], 'create'>;
  projectMember: Pick<Prisma.TransactionClient['projectMember'], 'findMany'>;
  notification: Pick<Prisma.TransactionClient['notification'], 'create'>;
};

@Injectable()
export class ProjectCompletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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
        select: { id: true, status: true, name: true },
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

      await this.notifyProjectMembers(
        projectId,
        actorId,
        'PROJECT_AUTO_COMPLETED',
        `Project "${project.name}" was completed`,
        db,
      );

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

  private async notifyProjectMembers(
    projectId: string,
    actorId: string,
    type: string,
    message: string,
    db: CompletionDb,
  ) {
    const members = await db.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });

    for (const member of members) {
      if (member.userId === actorId) continue;
      await this.notifications.notify(
        { userId: member.userId, projectId, type, message },
        db,
      );
    }
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
    const allDone = total > 0 && done === total;

    let status = project?.status ?? ProjectStatus.ACTIVE;
    if (project && total > 0 && !allDone && status === ProjectStatus.COMPLETED) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.ACTIVE },
      });
      status = ProjectStatus.ACTIVE;
    }

    return {
      total,
      done,
      percent,
      status,
    };
  }
}
