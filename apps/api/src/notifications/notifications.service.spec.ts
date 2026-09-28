import { NotificationsService } from './notifications.service';
import { NotificationBusService } from './notification-bus.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService.notify', () => {
  it('persists a row and emits on the in-process bus', async () => {
    const created = {
      id: 'n-1',
      userId: 'user-2',
      type: 'TASK_ASSIGNED',
      message: 'assigned',
    };
    const prisma = {
      notification: {
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const bus = { emitToUser: jest.fn() };
    const service = new NotificationsService(
      prisma as unknown as PrismaService,
      bus as unknown as NotificationBusService,
    );

    const result = await service.notify({
      userId: 'user-2',
      projectId: 'proj-1',
      taskId: 'task-1',
      type: 'TASK_ASSIGNED',
      message: 'assigned',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-2',
        projectId: 'proj-1',
        taskId: 'task-1',
        type: 'TASK_ASSIGNED',
        message: 'assigned',
      },
    });
    expect(bus.emitToUser).toHaveBeenCalledWith('user-2', 'notification', created);
    expect(result).toEqual(created);
  });
});
