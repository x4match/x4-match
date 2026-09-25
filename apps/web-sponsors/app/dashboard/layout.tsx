'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SponsorProvider, useSponsor } from '@/contexts/SponsorContext';
import { useAuth } from '@/contexts/AuthContext';
import { isPartner } from '@/lib/roles';
import { api } from '@/lib/api';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { Skeleton } from '@/components/ui/skeleton';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { activeSponsorId } = useSponsor();
  const ordersQ = useQuery({
    queryKey: ['partner-orders', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/orders`)).data,
    enabled: !!activeSponsorId,
  });
  const pending = Array.isArray(ordersQ.data)
    ? ordersQ.data.filter((o: { status?: string }) =>
        ['AWAITING_MANUAL_PAYMENT', 'PAID', 'PENDING'].includes(String(o.status || '')),
      ).length
    : 0;

  return (
    <div className="dash-canvas flex min-h-screen">
      <AppSidebar pendingOrders={pending} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopBar />
        <main className="flex-1 overflow-x-hidden px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
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
    if (!isPartner(user.role)) {
      logout();
      router.replace('/login?error=role');
    }
  }, [loading, token, user, router, logout]);

  if (loading) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-background p-8">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  if (!token || !user || !isPartner(user.role)) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-background p-8">
        <p className="text-sm text-muted-foreground">Acceso restringido a partners.</p>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <SponsorProvider>
        <DashboardShell>{children}</DashboardShell>
      </SponsorProvider>
    </div>
  );
}
