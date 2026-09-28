import Avatar from './Avatar';

interface ActivityLog {
  id: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date | string;
  actor: { name: string | null; image: string | null } | null;
}

interface Props {
  activityLogs: ActivityLog[];
}

const ACTION_LABELS: Record<string, string> = {
  PROJECT_CREATED: 'created this project',
  PROJECT_UPDATED: 'updated this project',
  PROJECT_AUTO_COMPLETED: 'auto-completed this project (all tasks done)',
  PROJECT_REOPENED: 'reopened the project',
  TASK_CREATED: 'created a task',
  TASK_UPDATED: 'updated a task',
  TASK_DELETED: 'deleted a task',
  COMMENT_CREATED: 'added a comment',
  COMMENT_DELETED: 'deleted a comment',
  STATUS_CHANGED: 'changed status',
  ASSIGNEE_CHANGED: 'changed assignee',
  PRIORITY_CHANGED: 'changed priority',
  DIVISION_CHANGED: 'changed division',
};

function formatTimestamp(date: Date | string): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffHours = diffMs / 3_600_000;

  if (diffHours < 24) {
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hrs = Math.floor(diffHours);
    return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  }

  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ActivityTimeline({ activityLogs }: Props) {
  if (!activityLogs.length) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Activity</h3>
      <div className="max-h-80 overflow-y-auto pl-2 pr-1">
        <ol className="relative border-l border-gray-200 space-y-6 ml-4 py-1">
          {activityLogs.map((log) => {
            const label = ACTION_LABELS[log.action] ?? log.action.toLowerCase().replace(/_/g, ' ');
            const actorName = log.actor?.name ?? 'System';

            return (
              <li key={log.id} className="ml-6">
                <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-gray-200">
                  <Avatar image={log.actor?.image} name={actorName} size={22} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold text-gray-700">{actorName}</span>{' '}
                    {label}
                  </p>
                  {log.oldValue && log.newValue && (
                    <p className="text-xs text-gray-400 break-words">
                      <span className="line-through">{log.oldValue}</span>
                      {' → '}
                      <span className="font-medium text-gray-600">{log.newValue}</span>
                    </p>
                  )}
                  {!log.oldValue && log.newValue && (
                    <p className="text-xs font-medium text-gray-500 break-words">— {log.newValue}</p>
                  )}
                  <time className="text-xs text-gray-400">{formatTimestamp(log.createdAt)}</time>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
