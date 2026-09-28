'use client';

import { usePathname } from 'next/navigation';
import AppSidebar from './AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import CommandPalette from './CommandPalette';
import NotificationBell from './NotificationBell';
import AuthGuard from './AuthGuard';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/auth');

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          <NotificationBell />
          <CommandPalette />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-5">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
