import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@ethio/database';
import { PrismaService } from '../prisma/prisma.service';
import { MarkNotificationsDto } from './dto/mark-notifications.dto';
import { NotificationBusService } from './notification-bus.service';

export type NotifyInput = {
  userId: string;
  type: string;
  message: string;
  projectId?: string | null;
  taskId?: string | null;
};

type NotificationStore = {
  notification: Pick<Prisma.TransactionClient['notification'], 'create'>;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationBus: NotificationBusService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async notify(input: NotifyInput, db: NotificationStore = this.prisma) {
    const notification = await db.notification.create({
      data: {
        userId: input.userId,
        projectId: input.projectId ?? undefined,
        taskId: input.taskId ?? undefined,
        type: input.type,
        message: input.message,
      },
    });

    this.notificationBus.emitToUser(input.userId, 'notification', notification);
    return notification;
  }

  async markRead(userId: string, dto: MarkNotificationsDto) {
    if (dto.id) {
      const notification = await this.prisma.notification.findFirst({
        where: { id: dto.id, userId },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return this.prisma.notification.update({
        where: { id: dto.id },
        data: { read: dto.read ?? true },
      });
    }

    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: dto.read ?? true },
    });

    return { message: 'Notifications updated' };
  }
}
