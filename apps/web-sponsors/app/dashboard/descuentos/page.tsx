'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  EmptyHint,
  ListRow,
  PageShell,
  PanelCard,
  StatusPill,
} from '@/components/layout/PageShell';

export default function DescuentosPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['partner-coupons', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/coupons`)).data,
    enabled: !!activeSponsorId,
  });
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState('');
  const create = useMutation({
    mutationFn: async () =>
      api.post(`/sponsors/me/${activeSponsorId}/coupons`, {
        code,
        discountPercent: Number(percent),
      }),
    onSuccess: () => {
      setCode('');
      setPercent('');
      toast.success('Cupón creado');
      qc.invalidateQueries({ queryKey: ['partner-coupons', activeSponsorId] });
    },
    onError: () => toast.error('No se pudo crear el cupón'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  const items = (listQ.data || []) as Array<{
    id: string;
    code: string;
    discount_percent?: number;
    discount_amount?: number;
    active?: boolean;
  }>;

  return (
    <PageShell
      kicker="Ventas"
      title="Descuentos"
      description="Cupones porcentuales para promociones."
    >
      <PanelCard>
        <form onSubmit={onSubmit} className="mb-4 flex flex-wrap gap-2">
          <Input
            className="min-h-11 min-w-[160px] flex-1"
            placeholder="Código"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <Input
            className="min-h-11 w-24"
            placeholder="%"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            required
          />
          <Button type="submit" className="min-h-11 font-bold" disabled={create.isPending}>
            Crear
          </Button>
        </form>
        {listQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <EmptyHint>Sin cupones todavía.</EmptyHint>
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <ListRow
                key={c.id}
                title={c.code}
                meta={
                  c.discount_percent
                    ? `${c.discount_percent}%`
                    : `$${c.discount_amount}`
                }
                actions={
                  <StatusPill tone={c.active ? 'success' : 'neutral'}>
                    {c.active ? 'activo' : 'inactivo'}
                  </StatusPill>
                }
              />
            ))}
          </div>
        )}
      </PanelCard>
    </PageShell>
  );
}
