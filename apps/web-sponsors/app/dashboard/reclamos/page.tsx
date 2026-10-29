'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { CLAIM_STATUS_LABELS, type PartnerClaim } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PageShell, StatusPill } from '@/components/layout/PageShell';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isActive(claim: PartnerClaim) {
  return claim.status === 'OPEN' || claim.status === 'PARTNER_RESPONDED';
}

export default function ReclamosPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const listQ = useQuery({
    queryKey: ['partner-claims', activeSponsorId],
    queryFn: async () =>
      (await api.get(`/sponsors/me/${activeSponsorId}/claims`)).data as PartnerClaim[],
    enabled: !!activeSponsorId,
  });

  const respond = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) =>
      api.post(`/sponsors/me/${activeSponsorId}/claims/${id}/respond`, { message }),
    onSuccess: (_data, vars) => {
      toast.success('Respuesta enviada al comprador');
      setDrafts((d) => ({ ...d, [vars.id]: '' }));
      qc.invalidateQueries({ queryKey: ['partner-claims', activeSponsorId] });
    },
    onError: () => toast.error('No se pudo enviar la respuesta'),
  });

  const claims = listQ.data || [];
  const unanswered = claims.filter((c) => c.status === 'OPEN').length;

  return (
    <PageShell
      kicker="Ventas"
      title="Reclamos"
      description="Respondé cada reclamo en menos de 72 h. Los reclamos sin respuesta o resueltos a favor del comprador pueden suspender tu tienda en Shop x4."
    >
      {unanswered > 0 ? (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Tenés {unanswered} reclamo{unanswered === 1 ? '' : 's'} sin responder.
        </p>
      ) : null}

      {listQ.isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
      {!listQ.isLoading && claims.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tenés reclamos. ¡Bien ahí!</p>
      ) : null}

      <div className="space-y-4">
        {claims.map((claim) => {
          const overdue =
            claim.status === 'OPEN' && new Date(claim.respond_before) < new Date();
          return (
            <article key={claim.id} className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{claim.reason_label}</p>
                  <p className="text-xs text-muted-foreground">
                    {claim.order_id
                      ? `Pedido #${claim.order_id.slice(0, 8).toUpperCase()}`
                      : 'Reporte desde la app'}
                    {claim.buyer_name ? ` · ${claim.buyer_name}` : ''}
                    {claim.total ? ` · $${Number(claim.total).toLocaleString('es-AR')}` : ''}
                    {` · ${formatDateTime(claim.created_at)}`}
                  </p>
                </div>
                <StatusPill
                  tone={
                    claim.status === 'OPEN'
                      ? 'danger'
                      : claim.status === 'PARTNER_RESPONDED'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {CLAIM_STATUS_LABELS[claim.status]}
                </StatusPill>
              </div>

              <p className="text-sm">{claim.description}</p>
              {claim.auto_created ? (
                <p className="text-xs text-muted-foreground">Abierto automáticamente por x4 match.</p>
              ) : null}

              {claim.status === 'OPEN' ? (
                <p className={`text-xs ${overdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                  {overdue ? 'Vencido: ' : 'Respondé antes del '}
                  {formatDateTime(claim.respond_before)}
                </p>
              ) : null}

              {claim.partner_response ? (
                <p className="rounded-lg bg-muted p-3 text-sm">
                  <span className="font-semibold">Tu respuesta:</span> {claim.partner_response}
                </p>
              ) : null}
              {claim.resolution_note ? (
                <p className="text-xs text-muted-foreground">{claim.resolution_note}</p>
              ) : null}

              {isActive(claim) ? (
                <div className="space-y-2">
                  <Textarea
                    value={drafts[claim.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [claim.id]: e.target.value }))}
                    placeholder="Explicale al comprador qué pasó y cómo lo resolvés (envío, número de seguimiento, devolución…)"
                  />
                  <Button
                    type="button"
                    disabled={respond.isPending || (drafts[claim.id] ?? '').trim().length < 5}
                    onClick={() => respond.mutate({ id: claim.id, message: drafts[claim.id] ?? '' })}
                  >
                    {claim.partner_response ? 'Enviar otra respuesta' : 'Responder'}
                  </Button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </PageShell>
  );
}
