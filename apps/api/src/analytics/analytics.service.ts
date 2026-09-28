import { Injectable } from '@nestjs/common';
import { Prisma, ProjectStatus, Role, TaskStatus } from '@ethio/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';

function getLast7Days() {
  const days: { label: string; date: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const label = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    days.push({ label, date: d });
  }
  return days;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(user: AuthUser) {
    const now = new Date();

    // ADMIN sees org-wide totals. Everyone else only sees data for projects
    // they are a member of — matching the access rule ProjectsService.findAll
    // already enforces for the project list itself.
    const projectWhere: Prisma.ProjectWhereInput =
      user.role === Role.ADMIN
        ? {}
        : { members: { some: { userId: user.id } } };

    const taskWhere: Prisma.TaskWhereInput =
      user.role === Role.ADMIN
        ? {}
        : { project: { members: { some: { userId: user.id } } } };

    const [
      projectCounts,
      tasksByStatus,
      tasksByCategory,
      overdueCount,
      recentTasks,
      allTasks,
    ] = await Promise.all([
      this.prisma.project.groupBy({
        by: ['status'],
        where: projectWhere,
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: taskWhere,
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['category'],
        where: taskWhere,
        _count: { _all: true },
      }),
      this.prisma.task.count({
        where: {
          ...taskWhere,
          dueDate: { lt: now },
          status: { not: TaskStatus.DONE },
        },
      }),
      this.prisma.task.findMany({
        where: {
          ...taskWhere,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: { createdAt: true },
      }),
      this.prisma.task.findMany({
        where: taskWhere,
        select: { category: true, status: true, priority: true },
      }),
    ]);

    const projects = {
      active:
        projectCounts.find((p) => p.status === ProjectStatus.ACTIVE)?._count
          ._all ?? 0,
      completed:
        projectCounts.find((p) => p.status === ProjectStatus.COMPLETED)?._count
          ._all ?? 0,
      total: projectCounts.reduce((sum, p) => sum + p._count._all, 0),
    };

    const byStatus = [
      TaskStatus.TODO,
      TaskStatus.IN_PROGRESS,
      TaskStatus.DONE,
    ].map((status) => ({
      status,
      count:
        tasksByStatus.find((item) => item.status === status)?._count._all ?? 0,
    }));

    const categoryLabels: Record<string, string> = {
      MOBILE_NETWORK: 'Mobile',
      FIBER_BROADBAND: 'Fiber',
      TELEBIRR_BILLING: 'Telebirr',
      CORE_INFRASTRUCTURE: 'Core Infra',
      OTHER: 'Other',
    };

    const byCategory = tasksByCategory.map((item) => ({
      name: categoryLabels[item.category] ?? item.category,
      category: item.category,
      count: item._count._all,
    }));

    const days = getLast7Days();
    const trend = days.map(({ label, date }) => {
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);
      const count = recentTasks.filter(
        (task) => task.createdAt >= date && task.createdAt < nextDay,
      ).length;
      return { label, count };
    });

    const priorityMap: Record<string, number> = {};
    for (const task of allTasks) {
      priorityMap[task.priority] = (priorityMap[task.priority] ?? 0) + 1;
    }

    return {
      projects,
      byStatus,
      byCategory,
      overdue: overdueCount,
      byPriority: Object.entries(priorityMap).map(([priority, count]) => ({
        priority,
        count,
      })),
      trend,
      totalTasks: allTasks.length,
    };
  }
}
