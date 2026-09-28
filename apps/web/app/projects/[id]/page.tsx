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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const taskColumnHelper = createColumnHelper<Task>();

function formatProjectDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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
  const [addMemberOpen, setAddMemberOpen] = useState(false);

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
    <div className="space-y-6">
      <div>
        <Link href="/projects" className="text-sm text-secondary hover:underline">
          ← Back to projects
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ProgressRing percent={progress?.percent ?? 0} size={64} strokeWidth={6} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <ProjectStatusBadge status={displayStatus} />
              {project.dueDate &&
                displayStatus !== 'COMPLETED' &&
                getDueDateStatus(project.dueDate, displayStatus) === 'overdue' && (
                  <OverdueBadge />
                )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {project.division && <span>{project.division.name}</span>}
              {project.dueDate && <span>Due {formatProjectDate(project.dueDate)}</span>}
              <span>
                {progress?.done ?? 0}/{progress?.total ?? 0} tasks done
              </span>
              <span>{progress?.percent ?? 0}% complete</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-800">Tasks</h2>
              <div className="flex overflow-hidden rounded-md border border-gray-200 text-sm">
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
                <p className="mb-4 mt-1 text-xs text-gray-500">
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
                            className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500"
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
                    {taskTable.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-800">Project details</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{project.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-400">Status</dt>
                <dd className="mt-1">
                  <ProjectStatusBadge status={displayStatus} />
                </dd>
              </div>
              {project.division && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-gray-400">Division</dt>
                  <dd className="mt-1 text-sm text-gray-700">{project.division.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-400">Created</dt>
                <dd className="mt-1 text-sm text-gray-700">{formatProjectDate(project.createdAt)}</dd>
              </div>
              {project.dueDate && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-gray-400">Due</dt>
                  <dd className="mt-1 text-sm text-gray-700">{formatProjectDate(project.dueDate)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-400">Progress</dt>
                <dd className="mt-1 text-sm text-gray-700">
                  {progress?.percent ?? 0}% · {progress?.done ?? 0}/{progress?.total ?? 0} done
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-800">
                Team ({project.members?.length ?? 0})
              </h2>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setAddMemberOpen(true)}
                  className={buttonVariants({
                    variant: 'outline',
                    size: 'sm',
                    className: 'text-gray-700',
                  })}
                >
                  + Add Member
                </button>
              )}
            </div>
            <ul className="divide-y divide-gray-100">
              {(project.members ?? []).map((member: ProjectMember) => (
                <li key={member.id} className="flex items-center gap-2 py-2">
                  <Avatar
                    image={member.user.image}
                    name={member.user.name ?? member.user.email}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.user.name ?? member.user.email}
                    </p>
                    <p className="text-xs text-gray-400">{member.role}</p>
                  </div>
                  {canManage && member.user.id !== user?.id && (
                    <div className="flex shrink-0 items-center gap-1">
                      <select
                        value={member.role}
                        onChange={(e) =>
                          memberRoleMutation.mutate({
                            userId: member.user.id,
                            role: e.target.value as 'OWNER' | 'MEMBER',
                          })
                        }
                        className="rounded border border-gray-300 px-1 py-0.5 text-xs"
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
            {canManage && (
              <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add member</DialogTitle>
                    <DialogDescription>
                      Enter the email of an existing registered user.
                    </DialogDescription>
                  </DialogHeader>
                  <MemberInvite
                    projectId={id}
                    canManage={canManage}
                    showHeading={false}
                    onMemberAdded={() => {
                      queryClient.invalidateQueries({ queryKey: ['project', id] });
                      setAddMemberOpen(false);
                    }}
                  />
                </DialogContent>
              </Dialog>
            )}
          </section>
        </div>

        {(project.activityLogs?.length ?? 0) > 0 && (
          <aside className="min-w-0">
            <div className="rounded-lg border border-gray-200 bg-white p-4 lg:sticky lg:top-0">
              <ActivityTimeline activityLogs={project.activityLogs ?? []} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
