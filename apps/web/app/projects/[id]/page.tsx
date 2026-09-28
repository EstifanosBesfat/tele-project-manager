'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import type { Project, ProjectMember, ProjectProgress } from '@/app/types/project';
import type { Task, TaskStatus, TaskListResponse } from '@/app/types/task';
import ProgressRing from '@/app/components/ProgressRing';
import ProjectStatusBadge from '@/app/components/ProjectStatusBadge';
import KanbanBoard from '@/app/components/KanbanBoard';
import MemberInvite from '@/app/components/MemberInvite';
import ActivityTimeline from '@/app/components/ActivityTimeline';
import PriorityBadge from '@/app/components/PriorityBadge';
import OverdueBadge from '@/app/components/OverdueBadge';
import Avatar from '@/app/components/Avatar';
import { getDueDateStatus } from '@/app/lib/dueDateUtils';
import { API_BASE_URL, getApiErrorMessage } from '@/lib/api';
import { buttonVariants } from '@/components/ui/button';

const taskColumnHelper = createColumnHelper<Task>();

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data } = await api.get<Project>(`/projects/${id}`);
      return data;
    },
  });

  const { data: progress } = useQuery({
    queryKey: ['project-progress', id],
    queryFn: async () => {
      const { data } = await api.get<ProjectProgress>(`/projects/${id}/progress`);
      return data;
    },
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['project-tasks', id],
    queryFn: async () => {
      const { data } = await api.get<TaskListResponse>(
        `/projects/${id}/tasks?limit=100`,
      );
      return data;
    },
  });

  const tasks = tasksData?.items ?? [];

  const myMembership = project?.members?.find((m) => m.user.id === user?.id);
  const isOwner = myMembership?.role === 'OWNER' || user?.role === 'ADMIN';
  const canManage = isOwner;

  const overdueTasks = tasks.filter(
    (t) =>
      t.dueDate &&
      t.status !== 'DONE' &&
      getDueDateStatus(t.dueDate, t.status) === 'overdue',
  );

  const statusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      setUpdatingTaskId(taskId);
      await api.patch(`/tasks/${taskId}`, { status });
    },
    onSettled: () => {
      setUpdatingTaskId(null);
      queryClient.invalidateQueries({ queryKey: ['project-tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['project-progress', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  const memberRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: 'OWNER' | 'MEMBER';
    }) => {
      await api.patch(`/projects/${id}/members/${userId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/projects/${id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  const taskColumns = useMemo(
    () => [
      taskColumnHelper.accessor('title', {
        header: 'Title',
        cell: ({ row }) => (
          <Link
            href={`/tasks/${row.original.id}`}
            className="font-medium text-gray-900 hover:text-secondary"
          >
            {row.original.title}
          </Link>
        ),
      }),
      taskColumnHelper.accessor('status', {
        header: 'Status',
        cell: ({ getValue }) => (
          <span className="text-xs font-medium">{getValue().replace('_', ' ')}</span>
        ),
      }),
      taskColumnHelper.accessor('priority', {
        header: 'Priority',
        cell: ({ getValue }) => <PriorityBadge priority={getValue()} />,
      }),
      taskColumnHelper.display({
        id: 'assignee',
        header: 'Assignee',
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {row.original.assignee?.name ?? row.original.assignee?.email ?? '—'}
          </span>
        ),
      }),
      taskColumnHelper.accessor('dueDate', {
        header: 'Due',
        cell: ({ row }) => {
          const due = row.original.dueDate;
          if (!due) return '—';
          const overdue =
            row.original.status !== 'DONE' &&
            getDueDateStatus(due, row.original.status) === 'overdue';
          return (
            <div className="flex items-center gap-1">
              <span className="text-sm">
                {new Date(due).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {overdue && <OverdueBadge />}
            </div>
          );
        },
      }),
    ],
    [],
  );

  const taskTable = useReactTable({
    data: tasks,
    columns: taskColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (projectLoading) {
    return <p className="text-sm text-gray-500">Loading project…</p>;
  }

  if (!project) {
    return <p className="text-sm text-danger">Project not found.</p>;
  }

  const displayStatus = progress?.status ?? project.status;
  const justCompleted =
    displayStatus === 'COMPLETED' &&
    (progress?.percent ?? 0) === 100 &&
    (progress?.total ?? 0) > 0;

  const exportCsv = async () => {
    setExporting(true);
    setExportError('');
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${id}/tasks/export`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}-tasks.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(getApiErrorMessage(err, 'Could not export tasks.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <Link href="/projects" className="text-sm text-secondary hover:underline">
          ← Back to projects
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <ProgressRing percent={progress?.percent ?? 0} size={80} strokeWidth={6} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <ProjectStatusBadge status={displayStatus} />
              {project.dueDate &&
                displayStatus !== 'COMPLETED' &&
                getDueDateStatus(project.dueDate, displayStatus) === 'overdue' && (
                  <OverdueBadge />
                )}
            </div>
            <p className="text-gray-600 text-sm mb-3">{project.description}</p>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              {project.division && <span>Division: {project.division.name}</span>}
              {project.dueDate && (
                <span>
                  Due:{' '}
                  {new Date(project.dueDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
              <span>
                {progress?.done ?? 0}/{progress?.total ?? 0} tasks done
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Link
              href={`/projects/${id}/tasks/new`}
              className={buttonVariants({
                className: 'bg-primary text-primary-foreground',
              })}
            >
              New Task
            </Link>
            <button
              type="button"
              onClick={exportCsv}
              disabled={exporting}
              className={buttonVariants({
                variant: 'outline',
                className: 'text-gray-700',
              })}
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>
        {exportError && <p className="mt-3 text-xs text-danger">{exportError}</p>}
      </div>

      {justCompleted && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          All tasks are done — this project was <strong>auto-completed</strong> by the system.
        </div>
      )}

      {overdueTasks.length > 0 && displayStatus !== 'COMPLETED' && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <strong>{overdueTasks.length}</strong> overdue task
          {overdueTasks.length === 1 ? '' : 's'} in this project.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-800">Tasks</h2>
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 ${viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-white text-gray-600'}`}
              >
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-white text-gray-600'}`}
              >
                Table
              </button>
            </div>
          </div>

          {tasksLoading ? (
            <p className="text-sm text-gray-500">Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
              <p className="text-sm font-medium text-gray-700">No tasks yet</p>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Add the first task to start tracking progress.
              </p>
              <Link
                href={`/projects/${id}/tasks/new`}
                className={buttonVariants({
                  className: 'bg-primary text-primary-foreground',
                })}
              >
                Create first task
              </Link>
            </div>
          ) : viewMode === 'kanban' ? (
            <KanbanBoard
              tasks={tasks}
              updatingId={updatingTaskId}
              onStatusChange={(taskId, status) =>
                statusMutation.mutate({ taskId, status })
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  {taskTable.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No tasks yet.
                      </td>
                    </tr>
                  ) : (
                    taskTable.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Members ({project.members?.length ?? 0})
            </h3>
            <ul className="space-y-3 mb-4">
              {(project.members ?? []).map((member: ProjectMember) => (
                <li key={member.id} className="flex items-center gap-2">
                  <Avatar
                    image={member.user.image}
                    name={member.user.name ?? member.user.email}
                    size={28}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.user.name ?? member.user.email}
                    </p>
                    <p className="text-xs text-gray-400">{member.role}</p>
                  </div>
                  {canManage && member.user.id !== user?.id && (
                    <div className="flex items-center gap-1">
                      <select
                        value={member.role}
                        onChange={(e) =>
                          memberRoleMutation.mutate({
                            userId: member.user.id,
                            role: e.target.value as 'OWNER' | 'MEMBER',
                          })
                        }
                        className="text-xs border border-gray-300 rounded px-1 py-0.5"
                      >
                        <option value="MEMBER">Member</option>
                        <option value="OWNER">Owner</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeMemberMutation.mutate(member.user.id)}
                        className="text-xs text-danger hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <MemberInvite
              projectId={id}
              canManage={canManage}
              onMemberAdded={() =>
                queryClient.invalidateQueries({ queryKey: ['project', id] })
              }
            />
          </div>

          {(project.activityLogs?.length ?? 0) > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <ActivityTimeline activityLogs={project.activityLogs ?? []} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
