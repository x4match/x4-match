'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, X } from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { initials } from '@/lib/format';
import { USER_ROLE_LABELS } from '@/lib/labels';
import { NAV_GROUPS, isNavActive } from '@/lib/nav';
import { usePendingClubRegistrations } from '@/lib/use-pending-club-registrations';

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { data: pendingClubs = 0 } = usePendingClubRegistrations();
  const badges: Record<string, number> = { '/club-registrations': pendingClubs };

  return (
    <nav className="ops-nav" aria-label="Navegación principal">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="ops-nav-group">
          <p className="ops-nav-section">{group.label}</p>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathname, href);
            const badge = badges[href];
            return (
              <Link
                key={href}
                href={href}
                className={`ops-nav-link${active ? ' ops-nav-link--active' : ''}`}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
              >
                <span className="ops-nav-icon" aria-hidden>
                  <Icon size={16} />
                </span>
                <span className="ops-nav-label">{label}</span>
                {badge ? (
                  <span className="ops-nav-badge" aria-label={`${badge} pendientes`}>
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function OpsSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {open ? (
        <button
          type="button"
          className="ops-sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={onClose}
        />
      ) : null}

      <aside className={`ops-sidebar${open ? ' ops-sidebar--open' : ''}`}>
        <div className="ops-sidebar-header">
          <Link href="/monitor" className="ops-brand" onClick={onClose}>
            <span className="ops-brand-mark" aria-hidden>
              x4
            </span>
            <span>
              <span className="ops-brand-kicker">X4 MATCH</span>
              <span className="ops-brand-title">Ops Console</span>
            </span>
          </Link>
          <button
            type="button"
            className="ops-sidebar-close btn btn-ghost"
            aria-label="Cerrar menú"
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <SidebarNav pathname={pathname} onNavigate={onClose} />

        <div className="ops-user-card">
          <span className="ops-avatar" aria-hidden>
            {initials(user?.name)}
          </span>
          <span className="ops-user-meta">
            <span className="ops-user-name">{user?.name}</span>
            <span className="ops-user-role">
              {user?.role ? USER_ROLE_LABELS[user.role] ?? user.role : ''}
            </span>
          </span>
          <button
            className="btn btn-ghost ops-icon-btn"
            type="button"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
          >
            <LogOut size={16} aria-hidden />
          </button>
        </div>
      </aside>
    </>
  );
}
