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

export default function DominioPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const sponsorQ = useQuery({
    queryKey: ['partner-sponsor', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}`)).data,
    enabled: !!activeSponsorId,
  });
  const [domain, setDomain] = useState('');
  const [dns, setDns] = useState<{ cname?: string; txt?: string } | null>(null);

  const setDomainMut = useMutation({
    mutationFn: async () =>
      (await api.post(`/sponsors/me/${activeSponsorId}/domain`, { domain })).data,
    onSuccess: (data) => {
      setDns(data.dns_instructions);
      toast.success('Dominio guardado — verificá el DNS');
      qc.invalidateQueries({ queryKey: ['partner-sponsor', activeSponsorId] });
    },
    onError: (err: unknown) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error',
      ),
  });

  const verify = useMutation({
    mutationFn: async () => api.post(`/sponsors/me/${activeSponsorId}/domain/verify`),
    onSuccess: () => {
      toast.success('Dominio verificado');
      qc.invalidateQueries({ queryKey: ['partner-sponsor', activeSponsorId] });
    },
    onError: (err: unknown) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'DNS no verificado',
      ),
  });

  const remove = useMutation({
    mutationFn: async () => api.delete(`/sponsors/me/${activeSponsorId}/domain`),
    onSuccess: () => {
      toast.success('Dominio quitado');
      setDns(null);
      qc.invalidateQueries({ queryKey: ['partner-sponsor', activeSponsorId] });
    },
  });

  const s = sponsorQ.data;
  const status = s?.custom_domain_status || 'NONE';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setDomainMut.mutate();
  }

  return (
    <PageShell
      kicker="Cuenta"
      title="Dominio"
      description="URL pública y dominio propio de la tienda."
      variant="form"
    >
      <FormSection title="URL de la tienda">
        <p className="text-sm text-muted-foreground">
          Default:{' '}
          <a
            className="font-semibold text-primary underline-offset-2 hover:underline"
            href={s?.store_url}
            target="_blank"
            rel="noreferrer"
          >
            {s?.store_url || `…/${s?.slug}`}
          </a>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Dominio propio:</span>
          <span className="font-semibold">{s?.custom_domain || '—'}</span>
          <StatusPill tone={status === 'VERIFIED' ? 'success' : 'warning'}>{status}</StatusPill>
        </div>
      </FormSection>

      <FormSection title="Configurar dominio">
        <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="min-h-11 flex-1"
            placeholder="tienda.tudominio.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
          />
          <Button type="submit" className="min-h-11 font-bold" disabled={setDomainMut.isPending}>
            Guardar
          </Button>
        </form>
        {dns ? (
          <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed">
            <p>CNAME → {dns.cname}</p>
            <p>TXT → {dns.txt}</p>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => verify.mutate()}
            disabled={verify.isPending}
          >
            Verificar DNS
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 text-destructive hover:text-destructive"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            Quitar dominio
          </Button>
        </div>
      </FormSection>
    </PageShell>
  );
}
