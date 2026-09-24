'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Settings,
  ShoppingBag,
  Store,
  Sun,
  Trophy,
  Users,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
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
    label: 'Operación',
    items: [
      { href: '/panel', label: 'Gerente', icon: LayoutDashboard },
      { href: '/gestion', label: 'Gestión', icon: CalendarClock },
      { href: '/reportes', label: 'Reportes', icon: BarChart3 },
      { href: '/alertas', label: 'Alertas', icon: AlertTriangle },
    ],
  },
  {
    label: 'Negocio',
    items: [
      { href: '/facturacion', label: 'Facturación', icon: Receipt },
      { href: '/pagos', label: 'Pagos MP', icon: CreditCard },
      { href: '/clientes', label: 'Clientes', icon: Users },
      { href: '/tienda', label: 'Tienda', icon: ShoppingBag },
      { href: '/pos', label: 'POS', icon: Store },
    ],
  },
  {
    label: 'Club',
    items: [
      { href: '/ranking', label: 'Ranking', icon: Trophy },
      { href: '/perfil', label: 'Perfil', icon: Settings },
    ],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { clubs, clubsLoading } = useClub();
  const hasClub = clubs.length > 0;

  return (
    <nav className="flex flex-col gap-4" aria-label="Navegación club">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {group.label}
          </p>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active =
              href === '/panel' ? pathname === '/panel' : pathname.startsWith(href);
            const locked = !clubsLoading && !hasClub && href !== '/perfil';

            if (locked) {
              return (
                <span
                  key={href}
                  aria-disabled="true"
                  title="Creá tu club en Perfil para desbloquear el panel"
                  className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/35"
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {label}
                </span>
              );
            }

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
  const { clubs, clubsLoading, activeClubId, setSelectedClubId } = useClub();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const router = useRouter();

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
          <h1 className="mt-0.5 text-lg font-extrabold tracking-tight">Panel Club</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">{user?.name}</p>
        </div>
      </div>

      {clubs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Club activo</p>
          <Select
            value={activeClubId || undefined}
            onValueChange={(v) => setSelectedClubId(v)}
          >
            <SelectTrigger className="w-full min-h-11 bg-surface-1">
              <SelectValue placeholder="Elegir club" />
            </SelectTrigger>
            <SelectContent>
              {clubs.map((club) => (
                <SelectItem key={club.id} value={club.id}>
                  {club.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <NavLinks onNavigate={onNavigate} />

      {!clubsLoading && clubs.length === 0 ? (
        <p className="rounded-xl bg-sidebar-accent/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Creá tu club en <span className="font-semibold text-foreground">Perfil</span> para
          desbloquear el resto del panel.
        </p>
      ) : null}

      <div className="mt-auto space-y-3">
        <Separator />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 rounded-xl"
            onClick={() =>
              setTheme((resolvedTheme === 'dark' ? 'light' : 'dark') as string)
            }
            aria-label="Cambiar tema"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="size-4" aria-hidden />
            ) : (
              <Moon className="size-4" aria-hidden />
            )}
          </Button>
          <span className="text-xs text-muted-foreground capitalize">
            {theme === 'system' ? 'sistema' : resolvedTheme}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full min-h-11 justify-start gap-2 rounded-xl text-muted-foreground"
          onClick={() => {
            logout();
            router.replace('/login');
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
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/90 backdrop-blur-md lg:flex">
        <SidebarBody />
      </aside>

      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="size-11 rounded-xl" aria-label="Menú">
              <Menu className="size-4" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
            <SidebarBody onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">x4 match</p>
          <p className="text-sm font-bold">Panel Club</p>
        </div>
      </div>
    </>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  kicker = 'Club',
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  kicker?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{kicker}</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
