'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth-context';

interface ProjectResult {
  id: string;
  name: string;
  status: string;
}

const QUICK_ACTIONS = [
  { id: 'qa-dashboard', label: 'Go to Dashboard', icon: '🏠', href: '/' },
  { id: 'qa-projects', label: 'View Projects', icon: '📁', href: '/projects' },
  { id: 'qa-new', label: 'New Project', icon: '➕', href: '/projects/new' },
  { id: 'qa-admin', label: 'Admin Panel', icon: '🛡️', href: '/admin', adminOnly: true },
];

export default function CommandPalette() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProjectResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const quickActions = QUICK_ACTIONS.filter(
    (a) => !a.adminOnly || user?.role === 'ADMIN',
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get<{ items: ProjectResult[] }>('/projects', {
          params: { q: q.trim(), limit: 6 },
        });
        setResults(data.items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  useEffect(() => {
    search(query);
  }, [query, search]);

  const allItems = query.trim()
    ? results.map((r) => ({
        id: r.id,
        label: r.name,
        href: `/projects/${r.id}`,
        meta: r,
      }))
    : quickActions.map((a) => ({
        id: a.id,
        label: a.label,
        href: a.href,
        icon: a.icon,
        meta: null,
      }));

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIdx]) {
      router.push(allItems[selectedIdx].href);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 text-sm text-muted-foreground bg-muted/60 hover:bg-muted rounded-md px-3 py-1.5 border border-border transition-colors"
        aria-label="Open command palette"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Search projects...</span>
        <kbd className="ml-1 text-xs bg-background border border-border rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden shadow-2xl" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Command Palette</DialogTitle>

          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search projects or jump to a page..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {loading && (
              <svg className="animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            )}
            <kbd className="text-xs bg-muted border border-border rounded px-1.5 py-0.5 font-mono text-muted-foreground">Esc</kbd>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!query.trim() && (
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</p>
            )}
            {query.trim() && results.length === 0 && !loading && (
              <p className="px-4 py-8 text-sm text-muted-foreground text-center">No projects found for &ldquo;{query}&rdquo;</p>
            )}
            {allItems.map((item, idx) => {
              const meta = item.meta as ProjectResult | null;
              const isSelected = idx === selectedIdx;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    router.push(item.href);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                  }`}
                >
                  {meta ? (
                    <>
                      <span className="flex-1 truncate text-sm text-foreground">{meta.name}</span>
                      <span className="text-xs text-muted-foreground">{meta.status}</span>
                    </>
                  ) : (
                    <>
                      <span className="shrink-0 w-6 text-center">{(item as { icon?: string }).icon}</span>
                      <span className="flex-1 text-sm text-foreground">{item.label}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex gap-4 px-4 py-2 border-t border-border bg-muted/30">
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><kbd className="font-mono text-xs bg-background border border-border rounded px-1">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><kbd className="font-mono text-xs bg-background border border-border rounded px-1">↵</kbd> open</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><kbd className="font-mono text-xs bg-background border border-border rounded px-1">Esc</kbd> close</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
