'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { ManagerReport } from '@/lib/club-manager';
import { useClub } from '@/contexts/ClubContext';
import { PageHeader } from '@/components/layout/AppSidebar';
import { ClientTable, DashboardSkeleton, EmptyState } from '@/components/club/DashboardCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Segment = 'new' | 'frequent' | 'inactive' | 'top';

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'new', label: 'Nuevos' },
  { id: 'frequent', label: 'Frecuentes' },
  { id: 'inactive', label: 'Inactivos' },
  { id: 'top', label: 'Top' },
];

export default function ClientesPage() {
  const { activeClubId, activeClub } = useClub();
  const [segment, setSegment] = useState<Segment>('frequent');
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['club-manager-report', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/manager-report`, {
        params: { days: 30 },
      });
      return res.data as ManagerReport;
    },
    enabled: !!activeClubId,
  });

  const campaignMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/clubs/${activeClubId}/segments/notify`, {
        segment,
        title: title.trim(),
        body: body.trim(),
        actionLabel: 'Ver club',
      });
      return res.data as { sent: number };
    },
    onSuccess: (res) => {
      setCampaignOpen(false);
      setTitle('');
      setBody('');
      toast.success(`Campaña enviada a ${res.sent} jugadores`);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo enviar');
    },
  });

  if (!activeClubId) return <EmptyState title="Seleccioná un club" />;
  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) return <EmptyState title="No se pudieron cargar los clientes" />;

  const counts = data.clientsSummary.counts;
  const rows = data.clientsSummary.segments[segment] || [];
  const segmentLabel = SEGMENTS.find((s) => s.id === segment)?.label || segment;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle={data.clientsSummary.subtitle || activeClub?.name}
        actions={
          <Button
            className="rounded-xl"
            onClick={() => {
              setTitle(
                segment === 'inactive'
                  ? `Te extrañamos en ${activeClub?.name || 'el club'}`
                  : `Novedades de ${activeClub?.name || 'tu club'}`,
              );
              setBody(
                segment === 'inactive'
                  ? 'Hay turnos libres esta semana. Volvé a jugar con nosotros.'
                  : 'Reservá tu próxima cancha desde la app.',
              );
              setCampaignOpen(true);
            }}
          >
            Enviar campaña
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSegment(s.id)}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              segment === s.id
                ? 'border-primary bg-primary/10'
                : 'border-border/60 bg-card hover:bg-surface-0'
            }`}
          >
            <p className="text-2xl font-bold tabular-nums">{counts[s.id]}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{segmentLabel}</CardTitle>
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <a href="/alertas">Ver alertas</a>
          </Button>
        </CardHeader>
        <CardContent>
          <ClientTable rows={rows} />
        </CardContent>
      </Card>

      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Campaña a {segmentLabel}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Mensaje</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="rounded-xl" />
            </div>
            <p className="text-xs text-muted-foreground">
              Se envía como notificación in-app a hasta 100 jugadores del segmento.
            </p>
          </div>
          <DialogFooter>
            <Button
              className="rounded-xl"
              disabled={!title.trim() || !body.trim() || campaignMutation.isPending}
              onClick={() => campaignMutation.mutate()}
            >
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
