'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell, StatusPill } from '@/components/layout/PageShell';
import { FormSection } from '@/components/layout/FormSection';
import { DataTable, type DataTableColumn } from '@/components/layout/DataTable';

type Coupon = {
  id: string;
  code: string;
  discount_percent?: number;
  discount_amount?: number;
  active?: boolean;
};

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

  const items = (listQ.data || []) as Coupon[];
  const columns: DataTableColumn<Coupon>[] = [
    { key: 'code', header: 'Código', cell: (c) => <span className="font-bold">{c.code}</span> },
    {
      key: 'discount',
      header: 'Descuento',
      cell: (c) =>
        c.discount_percent ? `${c.discount_percent}%` : `$${c.discount_amount}`,
    },
    {
      key: 'active',
      header: 'Estado',
      cell: (c) => (
        <StatusPill tone={c.active ? 'success' : 'neutral'}>
          {c.active ? 'activo' : 'inactivo'}
        </StatusPill>
      ),
    },
  ];

  return (
    <PageShell
      kicker="Ventas"
      title="Descuentos"
      description="Cupones porcentuales para promociones."
      variant="table"
    >
      <FormSection title="Crear cupón">
        <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
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
      </FormSection>
      <DataTable columns={columns} rows={items} loading={listQ.isLoading} empty="Sin cupones todavía." />
    </PageShell>
  );
}
