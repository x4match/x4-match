'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Building2,
  CalendarRange,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Swords,
  Timer,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const NAV = [
  { href: '/monitor', label: 'Monitoreo', icon: LayoutDashboard },
  { href: '/trials', label: 'Trials', icon: Timer },
  { href: '/clubs', label: 'Clubes', icon: Building2 },
  { href: '/users', label: 'Usuarios', icon: Users },
  { href: '/matches', label: 'Partidos', icon: Swords },
  { href: '/tournaments', label: 'Torneos', icon: Trophy },
  { href: '/payments', label: 'Pagos', icon: CreditCard },
  { href: '/activity', label: 'Actividad', icon: Activity },
  { href: '/calendar', label: 'Agenda', icon: CalendarRange },
];

function SidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="ops-nav">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`ops-nav-link${active ? ' ops-nav-link--active' : ''}`}
            onClick={onNavigate}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function OpsSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header className="ops-mobile-bar">
        <button
          type="button"
          className="btn btn-outline ops-menu-btn"
          aria-label="Abrir menú"
          onClick={() => setOpen(true)}
        >
          <Menu size={18} />
        </button>
        <div className="ops-mobile-brand">
          <p className="ops-brand-kicker">X4 MATCH OPS</p>
          <p className="ops-brand-title">Backoffice</p>
        </div>
      </header>

      {open ? (
        <button
          type="button"
          className="ops-sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside className={`ops-sidebar${open ? ' ops-sidebar--open' : ''}`}>
        <div className="ops-sidebar-header">
          <div>
            <p className="ops-brand-kicker">X4 MATCH OPS</p>
            <h2 className="ops-brand-title">Backoffice</h2>
            <p className="ops-user-name">{user?.name}</p>
          </div>
          <button
            type="button"
            className="ops-sidebar-close btn btn-outline"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        <SidebarNav pathname={pathname} onNavigate={() => setOpen(false)} />

        <button
          className="btn btn-outline ops-logout-btn"
          type="button"
          onClick={() => {
            logout();
            router.replace('/login');
          }}
        >
          <LogOut size={16} />
          Salir
        </button>
      </aside>
    </>
  );
}
