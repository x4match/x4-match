'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Settings,
  ShoppingBag,
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

const NAV = [
  { href: '/panel', label: 'Gerente', icon: LayoutDashboard },
  { href: '/gestion', label: 'Gestión', icon: CalendarClock },
  { href: '/facturacion', label: 'Facturación', icon: Receipt },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/alertas', label: 'Alertas', icon: AlertTriangle },
  { href: '/tienda', label: 'Tienda', icon: ShoppingBag },
  { href: '/ranking', label: 'Ranking', icon: Trophy },
  { href: '/perfil', label: 'Perfil', icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active =
          href === '/panel' ? pathname === '/panel' : pathname.startsWith(href);
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
  const { clubs, activeClubId, setSelectedClubId } = useClub();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const router = useRouter();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          x4 match
        </p>
        <h1 className="mt-1 text-xl font-extrabold tracking-tight">Panel Club</h1>
        <p className="mt-1 text-sm text-muted-foreground truncate">{user?.name}</p>
      </div>

      {clubs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Club activo</p>
          <Select
            value={activeClubId || undefined}
            onValueChange={(v) => setSelectedClubId(v)}
          >
            <SelectTrigger className="w-full bg-surface-1">
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

      <div className="mt-auto space-y-3">
        <Separator />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={() =>
              setTheme((resolvedTheme === 'dark' ? 'light' : 'dark') as string)
            }
            aria-label="Cambiar tema"
          >
            {resolvedTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <span className="text-xs text-muted-foreground capitalize">
            {theme === 'system' ? 'sistema' : resolvedTheme}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start gap-2 rounded-xl text-muted-foreground"
          onClick={() => {
            logout();
            router.replace('/login');
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
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <SidebarBody />
      </aside>

      <div className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-xl">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 bg-sidebar">
            <SidebarBody onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            x4 match
          </p>
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
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
