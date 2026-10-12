'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BadgeCheck, ChevronRight, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { initials } from '@/lib/format';
import { findNavLocation } from '@/lib/nav';
import { usePendingClubRegistrations } from '@/lib/use-pending-club-registrations';

export function OpsTopbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { data: pendingClubs = 0 } = usePendingClubRegistrations();
  const location = findNavLocation(pathname);

  return (
    <header className="ops-topbar">
      <button
        type="button"
        className="btn btn-ghost ops-icon-btn ops-menu-btn"
        aria-label="Abrir menú"
        onClick={onOpenMenu}
      >
        <Menu size={18} aria-hidden />
      </button>

      <nav className="ops-breadcrumb" aria-label="Ubicación">
        {location ? (
          <>
            <span className="ops-breadcrumb-group">{location.group}</span>
            <ChevronRight size={14} aria-hidden className="ops-breadcrumb-sep" />
            {location.isDetail ? (
              <>
                <Link href={location.item.href} className="ops-breadcrumb-link">
                  {location.item.label}
                </Link>
                <ChevronRight size={14} aria-hidden className="ops-breadcrumb-sep" />
                <span className="ops-breadcrumb-current" aria-current="page">
                  Detalle
                </span>
              </>
            ) : (
              <span className="ops-breadcrumb-current" aria-current="page">
                {location.item.label}
              </span>
            )}
          </>
        ) : (
          <span className="ops-breadcrumb-current">Backoffice</span>
        )}
      </nav>

      <div className="ops-topbar-actions">
        {pendingClubs > 0 ? (
          <Link href="/club-registrations" className="ops-topbar-pill">
            <BadgeCheck size={15} aria-hidden />
            <span>
              <strong className="num">{pendingClubs}</strong>
              <span className="ops-topbar-pill-label">
                {pendingClubs === 1 ? ' alta pendiente' : ' altas pendientes'}
              </span>
            </span>
          </Link>
        ) : null}
        <span className="ops-avatar ops-avatar--sm" title={user?.name} aria-hidden>
          {initials(user?.name)}
        </span>
      </div>
    </header>
  );
}
