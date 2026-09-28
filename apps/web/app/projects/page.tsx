'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueries } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import type { Project, ProjectListResponse, ProjectProgress } from '@/app/types/project';
import ProgressRing from '@/app/components/ProgressRing';
import ProjectStatusBadge from '@/app/components/ProjectStatusBadge';
import OverdueBadge from '@/app/components/OverdueBadge';
import { getDueDateStatus } from '@/app/lib/dueDateUtils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select } from '@/components/ui/select';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { cn } from '@/lib/utils';

type ProjectRow = Project & { progress?: ProjectProgress };

const PAGE_SIZE = 20;

export default function ProjectsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['projects', page, statusFilter],
    queryFn: async () => {
      const { data: result } = await api.get<ProjectListResponse>('/projects', {
        params: {
          page,
          limit: PAGE_SIZE,
          ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
        },
      });
      return result;
    },
  });

  const projects = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const progressQueries = useQueries({
    queries: projects.map((p) => ({
      queryKey: ['project-progress', p.id],
      queryFn: async () => {
        const { data } = await api.get<ProjectProgress>(`/projects/${p.id}/progress`);
        return data;
      },
      enabled: projects.length > 0,
    })),
  });

  const rows: ProjectRow[] = useMemo(() => {
    return projects.map((p, i) => ({
      ...p,
      progress: progressQueries[i]?.data,
    }));
  }, [projects, progressQueries]);

  function changeStatus(next: string) {
    setPage(1);
    setStatusFilter(next);
  }

  function renderStatusSelect() {
    return (
      <Select
        value={statusFilter}
        onChange={(e) => changeStatus(e.target.value)}
        className="w-[160px]"
      >
        <option value="ALL">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="COMPLETED">Completed</option>
      </Select>
    );
  }

  const pagination =
    totalPages > 1 ? (
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={page <= 1 || isLoading}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((current) => current + 1)}
          disabled={page >= totalPages || isLoading}
        >
          Next
        </Button>
      </div>
    ) : null;

  const columns = useMemo<ColumnDef<ProjectRow>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={
              table.getIsSomePageRowsSelected() &&
              !table.getIsAllPageRowsSelected()
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: 'progressRing',
        header: '',
        cell: ({ row }) => (
          <ProgressRing percent={row.original.progress?.percent ?? 0} size={40} />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <Link
            href={`/projects/${row.original.id}`}
            className="font-medium text-foreground hover:text-secondary"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => <ProjectStatusBadge status={row.original.status} />,
      },
      {
        id: 'percent',
        accessorFn: (row) => row.progress?.percent ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Progress" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {row.original.progress?.percent ?? 0}%
          </span>
        ),
      },
      {
        id: 'division',
        accessorFn: (row) => row.division?.name ?? '',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Division" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.division?.name ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'dueDate',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Due Date" />
        ),
        cell: ({ row }) => {
          const due = row.original.dueDate;
          if (!due) return <span className="text-muted-foreground">—</span>;
          const overdue =
            row.original.status !== 'COMPLETED' &&
            getDueDateStatus(due, row.original.status) === 'overdue';
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {new Date(due).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {overdue && <OverdueBadge />}
            </div>
          );
        },
      },
      {
        id: 'members',
        accessorFn: (row) => row.members?.length ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Members" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.members?.length ?? 0}
          </span>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
          const project = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                )}
              >
                <span className="sr-only">Open menu</span>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => navigator.clipboard.writeText(project.id)}
                  >
                    Copy project ID
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    View project
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [router],
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your projects and track progress.
          </p>
        </div>
        <Link
          href="/projects/new"
          className={buttonVariants({
            className: 'bg-primary text-primary-foreground hover:opacity-90',
          })}
        >
          New Project
        </Link>
      </div>

      {!isLoading && total === 0 && statusFilter === 'ALL' && (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 px-6 py-12 text-center">
          <p className="text-base font-semibold text-foreground">No projects yet</p>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Create your first project to start assigning tasks.
          </p>
          <Link
            href="/projects/new"
            className={buttonVariants({
              className: 'bg-primary text-primary-foreground',
            })}
          >
            Create project
          </Link>
        </div>
      )}

      <div className="flex lg:hidden">{renderStatusSelect()}</div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading projects…</p>
        ) : total === 0 && statusFilter !== 'ALL' ? (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            No projects match your filters.
          </p>
        ) : (
          rows.map((p) => (
            <Card key={p.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <ProgressRing percent={p.progress?.percent ?? 0} size={44} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/projects/${p.id}`}
                      className="block truncate font-semibold text-foreground hover:text-secondary"
                    >
                      {p.name}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ProjectStatusBadge status={p.status} />
                      {p.division && (
                        <span className="text-xs text-muted-foreground">
                          {p.division.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.members?.length ?? 0} members · {p.progress?.percent ?? 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="hidden lg:block">
        {(total > 0 || isLoading || statusFilter !== 'ALL') && (
          <DataTable
            columns={columns}
            data={rows}
            filterColumn="name"
            filterPlaceholder="Filter projects..."
            isLoading={isLoading}
            emptyMessage="No projects found."
            pageSize={PAGE_SIZE}
            showPagination={false}
            toolbar={renderStatusSelect()}
          />
        )}
      </div>

      {pagination}
    </div>
  );
}
