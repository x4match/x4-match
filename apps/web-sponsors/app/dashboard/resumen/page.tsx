'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Circle,
  CreditCard,
  ExternalLink,
  MessageCircle,
  Package,
  Palette,
  ShoppingBag,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PageShell, PanelCard, StatusPill } from '@/components/layout/PageShell';
import { StatBento } from '@/components/layout/FormSection';
import { cn } from '@/lib/utils';

export default function ResumenPage() {
  const { activeSponsorId, activeSponsor } = useSponsor();
  const ordersQ = useQuery({
    queryKey: ['partner-orders', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/orders`)).data,
    enabled: !!activeSponsorId,
  });
  const payQ = useQuery({
    queryKey: ['partner-pay', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/payments/status`)).data,
    enabled: !!activeSponsorId,
  });
  const productsQ = useQuery({
    queryKey: ['partner-products', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/products`)).data,
    enabled: !!activeSponsorId,
  });

  const orders = (ordersQ.data || []) as Array<{
    id: string;
    buyer_name?: string;
    total: number | string;
    status: string;
  }>;
  const products = productsQ.data || [];
  const recent = orders.slice(0, 5);

  const setup = [
    { done: !!activeSponsor?.name, label: 'Nombre de tienda', href: '/dashboard/apariencia' },
    { done: products.length > 0, label: 'Al menos 1 producto', href: '/dashboard/productos' },
    { done: !!payQ.data?.mpEnabled, label: 'Mercado Pago', href: '/dashboard/pagos' },
    { done: !!payQ.data?.whatsappEnabled, label: 'WhatsApp pagos', href: '/dashboard/pagos' },
  ];
  const setupDone = setup.filter((s) => s.done).length;
  const setupPct = Math.round((setupDone / setup.length) * 100);

  return (
    <PageShell
      kicker="Commerce hub"
      title="Resumen"
      description={activeSponsor?.name || 'Elegí un sponsor'}
      actions={
        activeSponsor?.slug ? (
          <Button asChild className="min-h-11 gap-2 font-bold">
            <Link href={`/${activeSponsor.slug}`} target="_blank">
              Ver tienda
              <ExternalLink className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="dash-bento">
        <StatBento
          label="Pedidos"
          value={orders.length}
          hint="Total registrados"
          icon={<ShoppingBag className="size-5" aria-hidden />}
        />
        <StatBento
          label="Productos"
          value={products.length}
          hint="En el catálogo"
          icon={<Package className="size-5" aria-hidden />}
        />
        <StatBento
          label="Mercado Pago"
          value={payQ.data?.mpEnabled ? 'ON' : 'OFF'}
          hint={payQ.data?.mpEnabled ? 'Listo para cobrar' : 'Conectá en Pagos'}
          icon={<CreditCard className="size-5" aria-hidden />}
        />
        <StatBento
          label="WhatsApp"
          value={payQ.data?.whatsappEnabled ? 'ON' : 'OFF'}
          icon={<MessageCircle className="size-5" aria-hidden />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <PanelCard title="Setup de tienda" className="lg:col-span-2" description={`${setupDone}/${setup.length} listos`}>
          <Progress value={setupPct} className="mb-4 h-2" />
          <ul className="space-y-2">
            {setup.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-muted/60"
                >
                  {item.done ? (
                    <CheckCircle2 className="size-4 text-success" aria-hidden />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" aria-hidden />
                  )}
                  <span className={cn('text-sm', item.done && 'text-muted-foreground')}>
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard title="Pedidos recientes" className="lg:col-span-3">
          {ordersQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay pedidos.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold">{o.buyer_name || 'Cliente'}</p>
                    <p className="text-xs text-muted-foreground">
                      ${Number(o.total).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <StatusPill
                    tone={
                      o.status === 'FULFILLED' || o.status === 'PAID'
                        ? 'success'
                        : o.status === 'CANCELLED'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {o.status}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" className="mt-4 min-h-11 w-full">
            <Link href="/dashboard/pedidos">Ver todos los pedidos</Link>
          </Button>
        </PanelCard>
      </div>

      <PanelCard title="Atajos" className="mt-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/dashboard/productos', label: 'Cargar productos', icon: Package },
            { href: '/dashboard/pedidos', label: 'Ver pedidos', icon: ShoppingBag },
            { href: '/dashboard/pagos', label: 'Configurar pagos', icon: CreditCard },
            { href: '/dashboard/apariencia', label: 'Personalizar tienda', icon: Palette },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 text-sm font-semibold transition-colors duration-150 hover:border-primary/40 hover:bg-primary/10"
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          ))}
        </div>
      </PanelCard>
    </PageShell>
  );
}
