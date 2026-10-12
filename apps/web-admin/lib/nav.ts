import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarRange,
  CreditCard,
  Handshake,
  LayoutDashboard,
  Swords,
  Timer,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operación',
    items: [
      { href: '/monitor', label: 'Monitoreo', icon: LayoutDashboard },
      { href: '/trials', label: 'Trials', icon: Timer },
      { href: '/activity', label: 'Actividad', icon: Activity },
      { href: '/calendar', label: 'Agenda', icon: CalendarRange },
    ],
  },
  {
    label: 'Red',
    items: [
      { href: '/club-registrations', label: 'Altas de clubes', icon: BadgeCheck },
      { href: '/clubs', label: 'Clubes', icon: Building2 },
      { href: '/users', label: 'Usuarios', icon: Users },
      { href: '/matches', label: 'Partidos', icon: Swords },
      { href: '/tournaments', label: 'Torneos', icon: Trophy },
    ],
  },
  {
    label: 'Comercio',
    items: [
      { href: '/payments', label: 'Pagos', icon: CreditCard },
      { href: '/partners', label: 'Partners', icon: Handshake },
    ],
  },
];

export function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavLocation(pathname: string) {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((entry) => isNavActive(pathname, entry.href));
    if (item) {
      return { group: group.label, item, isDetail: pathname !== item.href };
    }
  }
  return null;
}
