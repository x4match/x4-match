'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ExternalLink, LogOut, Menu, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSponsor } from '@/contexts/SponsorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SidebarNav } from '@/components/layout/AppSidebar';

const PAGE_HINTS: Array<{ href: string; label: string; keywords: string }> = [
  { href: '/dashboard/resumen', label: 'Resumen', keywords: 'home inicio kpi' },
  { href: '/dashboard/productos', label: 'Productos', keywords: 'catalogo stock' },
  { href: '/dashboard/pedidos', label: 'Pedidos', keywords: 'ordenes ventas' },
  { href: '/dashboard/pagos', label: 'Pagos', keywords: 'mercadopago whatsapp' },
  { href: '/dashboard/apariencia', label: 'Apariencia', keywords: 'branding color logo' },
  { href: '/dashboard/categorias', label: 'Categorías', keywords: 'rubros' },
  { href: '/dashboard/descuentos', label: 'Descuentos', keywords: 'cupones promo' },
  { href: '/dashboard/envios', label: 'Envíos', keywords: 'shipping entrega' },
  { href: '/dashboard/dominio', label: 'Dominio', keywords: 'dns url' },
  { href: '/dashboard/contacto', label: 'Contacto', keywords: 'email whatsapp' },
  { href: '/dashboard/ajustes', label: 'Ajustes', keywords: 'cuenta settings' },
];

export function DashboardTopBar() {
  const { user, logout } = useAuth();
  const { sponsors, activeSponsorId, activeSponsor, setSelectedSponsorId } = useSponsor();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PAGE_HINTS.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.keywords.includes(q) ||
        p.href.includes(q),
    ).slice(0, 6);
  }, [query]);

  const initials = (user?.name || 'P')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="dash-topbar">
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="size-10" aria-label="Menú">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
            <div className="p-4">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                Navegación
              </p>
              <SidebarNav onNavigate={() => setMenuOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="relative hidden min-w-0 flex-1 md:block md:max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar sección…"
          className="h-10 border-border/80 bg-surface-2 pl-9"
          aria-label="Buscar en el panel"
        />
        {matches.length > 0 ? (
          <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
            {matches.map((m) => (
              <button
                key={m.href}
                type="button"
                className="flex w-full items-center px-3 py-2.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setQuery('');
                  router.push(m.href);
                }}
              >
                {m.label}
                {pathname.startsWith(m.href) ? (
                  <span className="ml-auto text-[10px] font-bold text-primary">ACTUAL</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {sponsors.length > 0 ? (
          <Select
            value={activeSponsorId || undefined}
            onValueChange={(v) => setSelectedSponsorId(v)}
          >
            <SelectTrigger className="hidden h-10 min-w-[160px] bg-surface-2 sm:flex">
              <SelectValue placeholder="Sponsor" />
            </SelectTrigger>
            <SelectContent>
              {sponsors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {activeSponsor?.slug ? (
          <Button variant="outline" className="h-10 gap-2 font-semibold" asChild>
            <Link href={`/${activeSponsor.slug}`} target="_blank">
              <ExternalLink className="size-4" aria-hidden />
              <span className="hidden sm:inline">Ver tienda</span>
            </Link>
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 px-2" aria-label="Menú de usuario">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-sm font-medium lg:inline">
                {user?.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/dashboard/ajustes')}>
              Ajustes
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                logout();
                router.replace('/login');
              }}
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
