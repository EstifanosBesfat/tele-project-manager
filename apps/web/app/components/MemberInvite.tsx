'use client';

import { useState } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import type { ProjectRole } from '@/app/types/project';

interface Props {
  projectId: string;
  canManage: boolean;
  onMemberAdded?: () => void;
  showHeading?: boolean;
}

export default function MemberInvite({
  projectId,
  canManage,
  onMemberAdded,
  showHeading = true,
}: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('MEMBER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const inviteByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/projects/${projectId}/members`, {
        email: email.trim().toLowerCase(),
        role,
      });
      setSuccess(`Invited ${email.trim().toLowerCase()} as ${role === 'OWNER' ? 'Owner' : 'Member'}`);
      setEmail('');
      onMemberAdded?.();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to invite member'));
    } finally {
      setLoading(false);
    }
  };

  if (!canManage) return null;

  return (
    <div className="space-y-3">
      {showHeading && (
        <>
          <h4 className="text-sm font-semibold text-gray-700">Invite member</h4>
          <p className="text-xs text-gray-500">
            Enter the email of an existing registered user.
          </p>
        </>
      )}

      <form onSubmit={inviteByEmail} className="flex flex-wrap items-end gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
            setSuccess('');
          }}
          placeholder="user@ethiotelecom.et"
          required
          className="flex-1 min-w-[180px] rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ProjectRole)}
          className="rounded-md border border-gray-300 px-2 py-2 text-sm"
        >
          <option value="MEMBER">Member</option>
          <option value="OWNER">Owner</option>
        </select>
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Inviting…' : 'Invite'}
        </button>
      </form>

      {error && <p className="text-xs text-danger">{error}</p>}
      {success && <p className="text-xs text-green-600">{success}</p>}
    </div>
  );
}
