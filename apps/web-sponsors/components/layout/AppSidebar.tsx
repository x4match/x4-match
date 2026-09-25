'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes,
  Contact,
  CreditCard,
  Globe,
  LayoutDashboard,
  Package,
  Palette,
  Percent,
  Settings,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const NAV_GROUPS = [
  {
    label: 'Tienda',
    items: [
      { href: '/dashboard/resumen', label: 'Resumen', icon: LayoutDashboard },
      { href: '/dashboard/apariencia', label: 'Apariencia', icon: Palette },
      { href: '/dashboard/productos', label: 'Productos', icon: Package },
      { href: '/dashboard/categorias', label: 'Categorías', icon: Boxes },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { href: '/dashboard/descuentos', label: 'Descuentos', icon: Percent },
      { href: '/dashboard/envios', label: 'Envíos', icon: Truck },
      { href: '/dashboard/pagos', label: 'Pagos', icon: CreditCard },
      { href: '/dashboard/pedidos', label: 'Pedidos', icon: ShoppingBag },
    ],
  },
  {
    label: 'Cuenta',
    items: [
      { href: '/dashboard/dominio', label: 'Dominio', icon: Globe },
      { href: '/dashboard/contacto', label: 'Contacto', icon: Contact },
      { href: '/dashboard/ajustes', label: 'Ajustes', icon: Settings },
    ],
  },
];

export function SidebarNav({
  onNavigate,
  pendingOrders,
}: {
  onNavigate?: () => void;
  pendingOrders?: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4" aria-label="Navegación partner">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {group.label}
          </p>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const showBadge = href === '/dashboard/pedidos' && (pendingOrders ?? 0) > 0;
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{label}</span>
                {showBadge ? (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      active ? 'bg-primary-foreground/20' : 'bg-primary text-primary-foreground',
                    )}
                  >
                    {pendingOrders}
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

export function AppSidebar({ pendingOrders }: { pendingOrders?: number }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/90 backdrop-blur-md lg:flex">
      <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-extrabold text-primary-foreground"
          aria-hidden
        >
          x4
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">x4 match</p>
          <p className="truncate text-sm font-extrabold tracking-tight">Commerce OS</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <SidebarNav pendingOrders={pendingOrders} />
      </div>
    </aside>
  );
}
