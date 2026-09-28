'use client';

import Link from 'next/link';
import type { Task, TaskStatus } from '@/app/types/task';
import PriorityBadge from './PriorityBadge';
import OverdueBadge from './OverdueBadge';
import { getDueDateStatus } from '@/app/lib/dueDateUtils';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'TODO', label: 'To Do' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'DONE', label: 'Done' },
];

interface Props {
  tasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  updatingId?: string | null;
}

export default function KanbanBoard({ tasks, onStatusChange, updatingId }: Props) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-full gap-4">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div
            key={col.status}
            className="min-h-[200px] min-w-72 flex-1 rounded-lg border border-gray-200 bg-gray-50/50 p-3"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              {col.label}
              <span className="ml-1 text-gray-400">({columnTasks.length})</span>
            </h3>
            <div className="space-y-3">
              {columnTasks.map((task) => {
                const overdue =
                  task.dueDate &&
                  task.status !== 'DONE' &&
                  getDueDateStatus(task.dueDate, task.status) === 'overdue';
                return (
                  <div
                    key={task.id}
                    className="rounded-md border border-gray-200 bg-white p-3 shadow-sm hover:border-primary/40 transition-colors"
                  >
                    <Link
                      href={`/tasks/${task.id}`}
                      className="block text-sm font-semibold text-gray-900 hover:text-secondary mb-2"
                    >
                      {task.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <PriorityBadge priority={task.priority} />
                      {overdue && <OverdueBadge />}
                    </div>
                    {task.assignee && (
                      <p className="text-xs text-gray-500 mb-2">
                        {task.assignee.name ?? task.assignee.email}
                      </p>
                    )}
                    <select
                      value={task.status}
                      disabled={updatingId === task.id}
                      onChange={(e) =>
                        onStatusChange(task.id, e.target.value as TaskStatus)
                      }
                      className="w-full text-xs rounded border border-gray-300 px-2 py-1 focus:ring-1 focus:ring-primary disabled:opacity-50"
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.status} value={c.status}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {columnTasks.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No tasks</p>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
