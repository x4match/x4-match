'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OpsSidebar } from '@/components/OpsSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { isPlatformAdmin } from '@/lib/roles';

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!token || !user) router.replace('/login');
    else if (!isPlatformAdmin(user.role)) {
      logout();
      router.replace('/login');
    }
  }, [loading, token, user, router, logout]);

  if (loading || !user || !isPlatformAdmin(user.role)) {
    return <div style={{ padding: 32, color: 'var(--muted)' }}>Cargando…</div>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <OpsSidebar />
      <main style={{ flex: 1, padding: 24, overflowX: 'auto' }}>{children}</main>
    </div>
  );
}
