'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import type { Task } from '@/app/types/task';
import PriorityBadge from '@/app/components/PriorityBadge';
import OverdueBadge from '@/app/components/OverdueBadge';
import DueDateDisplay from '@/app/components/DueDateDisplay';
import ImageThumbnails from '@/app/components/ImageThumbnails';
import CommentSection from '@/app/components/CommentSection';
import ActivityTimeline from '@/app/components/ActivityTimeline';
import Avatar from '@/app/components/Avatar';
import { buttonVariants } from '@/components/ui/button';
import { getDueDateStatus } from '@/app/lib/dueDateUtils';

export default function TaskDetailPage() {
  const routeParams = useParams<{ id: string }>();
  const raw = routeParams?.id;
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : '';
  const { user } = useAuth();

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: async () => {
      const { data } = await api.get<Task>(`/tasks/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading task…</p>;
  }

  if (!task) {
    return <p className="text-sm text-danger">Task not found.</p>;
  }

  const statusColor =
    task.status === 'TODO'
      ? 'bg-gray-100 text-gray-700 ring-gray-200'
      : task.status === 'IN_PROGRESS'
        ? 'bg-warning/15 text-warning-foreground ring-warning/30'
        : 'bg-success/10 text-success ring-success/20';

  const overdue =
    task.dueDate &&
    task.status !== 'DONE' &&
    getDueDateStatus(task.dueDate, task.status) === 'overdue';

  const imageUrls = task.images?.map((img) => img.url) ?? [];
  const activityLogs = task.activityLogs ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        {task.project && (
          <Link
            href={`/projects/${task.project.id}`}
            onClick={(e) => {
              e.preventDefault();
              const projectId = task.project?.id;
              if (projectId) window.location.assign(`/projects/${projectId}`);
            }}
            className="text-sm text-secondary hover:underline"
          >
            ← Back to {task.project.name}
          </Link>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-4">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="text-2xl font-bold text-gray-900 break-words">{task.title}</h1>
              {overdue && <OverdueBadge />}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${statusColor}`}
              >
                {task.status.replace('_', ' ')}
              </span>
              <PriorityBadge priority={task.priority} />
              {task.division && (
                <span className="text-xs text-gray-500">{task.division.name}</span>
              )}
            </div>
          </div>
          <Link
            href={`/tasks/${id}/edit`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Edit
          </Link>
        </div>

        <p className="text-gray-700 text-sm whitespace-pre-wrap mb-4">{task.description}</p>

        <ImageThumbnails urls={imageUrls} />

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400 block text-xs uppercase tracking-wider mb-1">
              Reporter
            </span>
            {task.reporter ? (
              <div className="flex items-center gap-2">
                <Avatar
                  image={task.reporter.image}
                  name={task.reporter.name ?? 'User'}
                  size={24}
                />
                <span>{task.reporter.name ?? task.reporter.email}</span>
              </div>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </div>
          <div>
            <span className="text-gray-400 block text-xs uppercase tracking-wider mb-1">
              Assignee
            </span>
            {task.assignee ? (
              <div className="flex items-center gap-2">
                <Avatar
                  image={task.assignee.image}
                  name={task.assignee.name ?? 'User'}
                  size={24}
                />
                <span>{task.assignee.name ?? task.assignee.email}</span>
              </div>
            ) : (
              <span className="text-gray-500">Unassigned</span>
            )}
          </div>
          <div>
            <span className="text-gray-400 block text-xs uppercase tracking-wider mb-1">
              Due Date
            </span>
            <DueDateDisplay dueDate={task.dueDate} status={task.status} />
          </div>
          <div>
            <span className="text-gray-400 block text-xs uppercase tracking-wider mb-1">
              Category
            </span>
            <span className="text-gray-700">{task.category.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>

      {activityLogs.length > 0 && <ActivityTimeline activityLogs={activityLogs} />}

      <CommentSection
        taskId={id}
        projectId={task.project?.id ?? task.projectId}
        initialComments={task.comments ?? []}
        currentUserId={user?.id}
        userRole={user?.role}
      />
    </div>
  );
}
