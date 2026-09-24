'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Package, CreditCard, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: typeof Package;
  hint?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-colors duration-150 hover:border-primary/30">
      <div className="pointer-events-none absolute -right-4 -top-4 size-24 rounded-full bg-primary/10" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

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

  const orders = ordersQ.data || [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Commerce hub</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Resumen</h1>
          <p className="mt-1 text-sm text-muted-foreground">{activeSponsor?.name || 'Elegí un sponsor'}</p>
        </div>
        {activeSponsor?.slug ? (
          <Button asChild className="min-h-11 gap-2 font-bold">
            <Link href={`/${activeSponsor.slug}`} target="_blank">
              Ver tienda pública
              <ExternalLink className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Pedidos" value={orders.length} icon={Package} hint="Total registrados" />
        <KpiCard
          label="Mercado Pago"
          value={payQ.data?.mpEnabled ? 'Conectado' : 'Pendiente'}
          icon={CreditCard}
          hint={payQ.data?.mpEnabled ? 'Listo para cobrar' : 'Conectá en Pagos'}
        />
        <KpiCard
          label="WhatsApp"
          value={payQ.data?.whatsappEnabled ? 'Activo' : 'Inactivo'}
          icon={MessageCircle}
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">Atajos</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/dashboard/productos', label: 'Cargar productos' },
            { href: '/dashboard/pedidos', label: 'Ver pedidos' },
            { href: '/dashboard/pagos', label: 'Configurar pagos' },
            { href: '/dashboard/apariencia', label: 'Personalizar tienda' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface-2 px-4 text-sm font-semibold',
                'transition-colors duration-150 hover:border-primary/40 hover:bg-primary/10',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
