'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OpsSidebar } from '@/components/OpsSidebar';
import { OpsTopbar } from '@/components/OpsTopbar';
import { useAuth } from '@/contexts/AuthContext';
import { isPlatformAdmin } from '@/lib/roles';

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openMenu = useCallback(() => setMenuOpen(true), []);

  useEffect(() => {
    if (loading) return;
    if (!token || !user) router.replace('/login');
    else if (!isPlatformAdmin(user.role)) {
      logout();
      router.replace('/login');
    }
  }, [loading, token, user, router, logout]);

  if (loading || !user || !isPlatformAdmin(user.role)) {
    return (
      <div className="ops-boot" role="status">
        <span className="ops-brand-mark" aria-hidden>
          x4
        </span>
        <span>Cargando…</span>
      </div>
    );
  }

  return (
    <div className="ops-layout">
      <OpsSidebar open={menuOpen} onClose={closeMenu} />
      <div className="ops-shell">
        <OpsTopbar onOpenMenu={openMenu} />
        <main className="ops-main">{children}</main>
      </div>
    </div>
  );
}
