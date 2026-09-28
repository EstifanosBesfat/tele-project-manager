import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@ethio/database';
import { PrismaService } from '../prisma/prisma.service';
import {
  extractMentionHandles,
  resolveMentionedUserIds,
} from '../common/utils/mentions.util';
import { AuthUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(taskId: string, dto: CreateCommentDto, user: AuthUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, title: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.projectsService.ensureCanAccess(task.projectId, user);

    const comment = await this.prisma.comment.create({
      data: {
        content: dto.content,
        authorId: user.id,
        taskId,
      },
      include: {
        author: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        projectId: task.projectId,
        taskId,
        actorId: user.id,
        action: 'COMMENT_CREATED',
      },
    });

    await this.createMentionNotifications(
      dto.content,
      user,
      task.projectId,
      taskId,
      task.title,
    );

    return comment;
  }

  async remove(commentId: string, user: AuthUser) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        task: { select: { projectId: true } },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    return { message: 'Comment deleted' };
  }

  private async createMentionNotifications(
    content: string,
    author: AuthUser,
    projectId: string,
    taskId: string,
    taskTitle: string,
  ) {
    const handles = extractMentionHandles(content);
    if (handles.length === 0) return;

    const projectMembers = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const users = projectMembers.map((member) => member.user);
    const mentionedUserIds = resolveMentionedUserIds(handles, users, author.id);

    for (const userId of mentionedUserIds) {
      await this.notifications.notify({
        userId,
        projectId,
        taskId,
        type: 'MENTION',
        message: `${author.name ?? author.email} mentioned you on "${taskTitle}"`,
      });
    }
  }
}
