'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SponsorProvider } from '@/contexts/SponsorContext';
import { useAuth } from '@/contexts/AuthContext';
import { isPartner } from '@/lib/roles';
import { AppSidebar } from '@/components/layout/AppSidebar';
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
    if (!isPartner(user.role)) {
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

  if (!token || !user || !isPartner(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Acceso restringido a partners.</p>
      </div>
    );
  }

  return (
    <SponsorProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-x-hidden px-4 pb-10 pt-20 lg:px-8 lg:pt-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </SponsorProvider>
  );
}
