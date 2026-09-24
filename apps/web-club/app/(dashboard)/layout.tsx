'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ClubProvider, useClub } from '@/contexts/ClubContext';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { EmptyState } from '@/components/club/DashboardCards';
import { Skeleton } from '@/components/ui/skeleton';

function RequireClubGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { clubs, clubsLoading } = useClub();

  useEffect(() => {
    if (clubsLoading) return;
    if (clubs.length > 0) return;
    if (pathname === '/perfil' || pathname.startsWith('/perfil/')) return;
    router.replace('/perfil');
  }, [clubs.length, clubsLoading, pathname, router]);

  if (clubsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  if (clubs.length === 0 && pathname !== '/perfil' && !pathname.startsWith('/perfil/')) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!token || !user) {
      router.replace('/login');
      return;
    }
    if (!isClub(user.role)) {
      logout();
      router.replace('/login?error=role');
    }
  }, [loading, token, user, router, logout]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  if (!token || !user || !isClub(user.role)) {
    return (
      <div className="p-8">
        <EmptyState
          title="Acceso restringido"
          description="Solo cuentas de club pueden usar este panel."
        />
      </div>
    );
  }

  return (
    <ClubProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-x-hidden px-4 pb-10 pt-20 lg:px-8 lg:pt-8">
          <div className="mx-auto max-w-7xl">
            <RequireClubGate>{children}</RequireClubGate>
          </div>
        </main>
      </div>
    </ClubProvider>
  );
}
