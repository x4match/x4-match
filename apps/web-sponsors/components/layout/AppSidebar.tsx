'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Boxes,
  Contact,
  CreditCard,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Palette,
  Percent,
  Settings,
  ShoppingBag,
  Tag,
  Truck,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSponsor } from '@/contexts/SponsorContext';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const NAV_GROUPS = [
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

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
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
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const { sponsors, activeSponsorId, setSelectedSponsorId } = useSponsor();
  const router = useRouter();
  const activeSponsor = sponsors.find((s) => s.id === activeSponsorId);

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground"
          aria-hidden
        >
          x4
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">x4 match</p>
          <h1 className="mt-0.5 text-lg font-extrabold tracking-tight">Panel Partner</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">{user?.name}</p>
        </div>
      </div>

      {sponsors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Sponsor activo</p>
          <Select
            value={activeSponsorId || undefined}
            onValueChange={(v) => setSelectedSponsorId(v)}
          >
            <SelectTrigger className="w-full min-h-11 bg-surface-1">
              <SelectValue placeholder="Elegir sponsor" />
            </SelectTrigger>
            <SelectContent>
              {sponsors.map((sponsor) => (
                <SelectItem key={sponsor.id} value={sponsor.id}>
                  {sponsor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <NavLinks onNavigate={onNavigate} />

      <div className="mt-auto space-y-3">
        <Separator />
        {activeSponsor?.slug ? (
          <Button variant="outline" className="w-full min-h-11 justify-start gap-2" asChild>
            <Link href={`/${activeSponsor.slug}`} target="_blank" onClick={onNavigate}>
              <Tag className="size-4" aria-hidden />
              Ver tienda
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="w-full min-h-11 justify-start gap-2 text-muted-foreground"
          onClick={() => {
            logout();
            router.replace('/login');
            onNavigate?.();
          }}
        >
          <LogOut className="size-4" aria-hidden />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar/90 backdrop-blur-md lg:block">
        <SidebarBody />
      </aside>

      <div className="fixed left-0 right-0 top-0 z-40 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Menú">
              <Menu className="size-4" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
            <SidebarBody onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">x4 match</p>
          <p className="font-semibold">Panel Partner</p>
        </div>
      </div>
    </>
  );
}
