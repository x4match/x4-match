'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClubProvider } from '@/contexts/ClubContext';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { EmptyState } from '@/components/club/DashboardCards';
import { Skeleton } from '@/components/ui/skeleton';

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
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </ClubProvider>
  );
}
