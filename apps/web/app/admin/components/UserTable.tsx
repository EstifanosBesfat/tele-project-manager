'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
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

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive?: boolean;
  createdAt?: string;
}

interface Props {
  currentUserId: string;
}

export default function UserTable({ currentUserId }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const { data: users = [], refetch, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await api.get<User[]>('/users');
      return data;
    },
  });

  const patch = async (id: string, data: object) => {
    setLoading(id);
    try {
      await api.patch(`/users/${id}`, data);
      await refetch();
    } finally {
      setLoading(null);
    }
  };

  const columns = useMemo<ColumnDef<User>[]>(
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
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        accessorKey: 'role',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <Select
              value={user.role}
              disabled={user.id === currentUserId || loading === user.id}
              onChange={(e) => patch(user.id, { role: e.target.value })}
              className="h-8 w-[110px] text-xs"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </Select>
          );
        },
      },
      {
        id: 'status',
        accessorFn: (row) => (row.isActive === false ? 'Inactive' : 'Active'),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const active = row.original.isActive !== false;
          return (
            <Badge variant={active ? 'secondary' : 'destructive'}>
              {active ? 'Active' : 'Inactive'}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
          const user = row.original;
          const active = user.isActive !== false;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                )}
                disabled={loading === user.id}
              >
                <span className="sr-only">Open menu</span>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => navigator.clipboard.writeText(user.email)}
                  >
                    Copy email
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {user.id !== currentUserId && (
                    <DropdownMenuItem
                      variant={active ? 'destructive' : 'default'}
                      onClick={() =>
                        patch(user.id, { isActive: user.isActive === false })
                      }
                    >
                      {active ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [currentUserId, loading],
  );

  return (
    <DataTable
      columns={columns}
      data={users}
      filterColumn="email"
      filterPlaceholder="Filter emails..."
      isLoading={isLoading}
      emptyMessage="No users found."
    />
  );
}
