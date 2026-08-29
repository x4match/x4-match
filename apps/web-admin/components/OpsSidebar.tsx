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
  Swords,
  Timer,
  Trophy,
  Users,
} from 'lucide-react';
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

export function OpsSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <aside
      style={{
        width: 240,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <div>
        <p style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--primary)', fontWeight: 700 }}>
          X4 MATCH OPS
        </p>
        <h2 style={{ margin: '4px 0 0', fontSize: 18 }}>Backoffice</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>{user?.name}</p>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                background: active ? 'rgba(245,197,24,0.12)' : 'transparent',
                color: active ? 'var(--primary)' : 'var(--muted)',
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <button
        className="btn btn-outline"
        style={{ marginTop: 'auto' }}
        onClick={() => {
          logout();
          router.replace('/login');
        }}
      >
        <LogOut size={16} />
        Salir
      </button>
    </aside>
  );
}
