export type ProjectStatus = 'ACTIVE' | 'COMPLETED';
export type ProjectRole = 'OWNER' | 'MEMBER';

export interface ProjectMember {
  id: string;
  role: ProjectRole;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export interface ProjectActivityLog {
  id: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: { name: string | null; image: string | null } | null;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  divisionId: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string | null; email: string };
  division?: { id: string; name: string } | null;
  members?: ProjectMember[];
  activityLogs?: ProjectActivityLog[];
  _count?: { tasks: number; members?: number };
}

export interface ProjectProgress {
  total: number;
  done: number;
  percent: number;
  status: ProjectStatus;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Division {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
