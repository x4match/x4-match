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

const NAV = [
  { href: '/dashboard/resumen', label: 'Resumen', icon: LayoutDashboard },
  { href: '/dashboard/apariencia', label: 'Apariencia', icon: Palette },
  { href: '/dashboard/productos', label: 'Productos', icon: Package },
  { href: '/dashboard/categorias', label: 'Categorías', icon: Boxes },
  { href: '/dashboard/descuentos', label: 'Descuentos', icon: Percent },
  { href: '/dashboard/envios', label: 'Envíos', icon: Truck },
  { href: '/dashboard/pagos', label: 'Pagos', icon: CreditCard },
  { href: '/dashboard/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/dashboard/dominio', label: 'Dominio', icon: Globe },
  { href: '/dashboard/contacto', label: 'Contacto', icon: Contact },
  { href: '/dashboard/ajustes', label: 'Ajustes', icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const { sponsors, activeSponsorId, setSelectedSponsorId } = useSponsor();
  const router = useRouter();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          x4 match
        </p>
        <h1 className="mt-1 text-xl font-extrabold tracking-tight">Panel Partner</h1>
        <p className="mt-1 truncate text-sm text-muted-foreground">{user?.name}</p>
      </div>

      {sponsors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Sponsor activo</p>
          <Select
            value={activeSponsorId || undefined}
            onValueChange={(v) => setSelectedSponsorId(v)}
          >
            <SelectTrigger className="w-full bg-surface-1">
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
        {activeSponsorId && sponsors.find((s) => s.id === activeSponsorId)?.slug ? (
          <Button variant="outline" className="w-full justify-start gap-2" asChild>
            <Link
              href={`/${sponsors.find((s) => s.id === activeSponsorId)!.slug}`}
              target="_blank"
              onClick={onNavigate}
            >
              <Tag className="size-4" />
              Ver tienda
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => {
            logout();
            router.replace('/login');
            onNavigate?.();
          }}
        >
          <LogOut className="size-4" />
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
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarBody />
      </aside>

      <div className="fixed left-0 right-0 top-0 z-40 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Menú">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SidebarBody onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <p className="font-semibold">Panel Partner</p>
      </div>
    </>
  );
}
