'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import type { Division } from '@/app/types/project';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { cn } from '@/lib/utils';

export default function DivisionTable() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const { data: divisions = [], refetch, isLoading } = useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const { data } = await api.get<Division[]>('/divisions');
      return data;
    },
  });

  const patch = async (id: string, data: object) => {
    setLoading(id);
    setError('');
    try {
      await api.patch(`/divisions/${id}`, data);
      await refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update division.');
    } finally {
      setLoading(null);
    }
  };

  const createDivision = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await api.post('/divisions', { name: newName.trim() });
      setNewName('');
      await refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create division.');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (division: Division) => {
    setEditingId(division.id);
    setEditingName(division.name);
  };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    await patch(editingId, { name: editingName.trim() });
    setEditingId(null);
    setEditingName('');
  };

  const columns = useMemo<ColumnDef<Division>[]>(
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
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const division = row.original;
          if (editingId === division.id) {
            return (
              <Input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                autoFocus
                className="h-8 max-w-[220px]"
              />
            );
          }
          return <span className="font-medium">{division.name}</span>;
        },
      },
      {
        id: 'status',
        accessorFn: (row) => (row.isActive ? 'Active' : 'Inactive'),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'secondary' : 'destructive'}>
            {row.original.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
          const division = row.original;
          if (editingId === division.id) {
            return (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={saveEdit}
                  disabled={loading === division.id}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </Button>
              </div>
            );
          }
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                )}
                disabled={!!loading}
              >
                <span className="sr-only">Open menu</span>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => startEdit(division)}>
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant={division.isActive ? 'destructive' : 'default'}
                    onClick={() =>
                      patch(division.id, { isActive: !division.isActive })
                    }
                  >
                    {division.isActive ? 'Deactivate' : 'Activate'}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [editingId, editingName, loading],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') createDivision();
          }}
          placeholder="New division name (e.g. Marketing)"
          className="min-w-[200px] flex-1"
        />
        <Button
          type="button"
          onClick={createDivision}
          disabled={creating || !newName.trim()}
        >
          {creating ? 'Adding…' : '+ Add Division'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={divisions}
        filterColumn="name"
        filterPlaceholder="Filter divisions..."
        isLoading={isLoading}
        emptyMessage="No divisions found."
      />
    </div>
  );
}
