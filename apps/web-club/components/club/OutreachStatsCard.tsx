'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const DEFAULT_SLOT_OFFER_RADIUS_KM = 10;

type OutreachTotals = {
  playersReached: number;
  notificationsSent: number;
  notificationsOpened: number;
  slotsOffered: number;
  slotsBooked: number;
};

type OutreachStats = OutreachTotals & {
  days: number;
  manual: OutreachTotals;
  auto: OutreachTotals;
};

function percent(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '–';
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-0 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Mensaje tras publicar un horario con "Notificar jugadores" (el push sale diferido). */
export function outreachPublishMessage(notifiedCount: number, notifyScheduledFor?: string | null) {
  const players = `${notifiedCount} jugador${notifiedCount === 1 ? '' : 'es'}`;
  if (notifiedCount === 0) {
    return 'Horario publicado. No había jugadores cercanos para avisar, o ya recibieron el máximo de avisos de hoy.';
  }
  const scheduledFor = notifyScheduledFor ? new Date(notifyScheduledFor) : null;
  if (scheduledFor && scheduledFor.getTime() - Date.now() > 15 * 60_000) {
    const time = scheduledFor.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    return `Horario publicado. Vamos a avisar a ${players} a las ${time}, para no molestar de noche.`;
  }
  return `Horario publicado. Vamos a avisar a ${players} en unos minutos; si publicás más horarios, les llega un solo aviso.`;
}

function RadiusSetting({ clubId, radiusKm }: { clubId: string; radiusKm: number }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(String(radiusKm));
  useEffect(() => setValue(String(radiusKm)), [radiusKm]);

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 50;

  const save = useMutation({
    mutationFn: async () => {
      await api.patch(`/clubs/${clubId}/slot-offer-settings`, { radiusKm: parsed });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-detail', clubId] });
      toast.success(`Radio de aviso: ${parsed} km`);
    },
    onError: (err: { response?: { data?: { message?: string | string[] } } }) => {
      const message = err.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message || 'No se pudo guardar el radio');
    },
  });

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 p-4">
      <div className="space-y-1">
        <Label htmlFor="slot-offer-radius">Radio de aviso</Label>
        <div className="flex items-center gap-2">
          <Input
            id="slot-offer-radius"
            type="number"
            min={1}
            max={50}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-24 rounded-xl"
          />
          <span className="text-sm text-muted-foreground">km</span>
        </div>
      </div>
      <Button
        variant="outline"
        className="rounded-xl"
        onClick={() => save.mutate()}
        disabled={!valid || parsed === radiusKm || save.isPending}
      >
        Guardar
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        “Notificar jugadores” avisa a quienes estén a menos de esta distancia del club (entre 1 y 50 km). Si el
        jugador no compartió su ubicación, se usa su ciudad.
      </p>
    </div>
  );
}

export function OutreachStatsCard({
  clubId,
  radiusKm,
  enabled = true,
}: {
  clubId?: string | null;
  radiusKm?: number;
  enabled?: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['club-outreach-stats', clubId],
    queryFn: async () =>
      (await api.get(`/clubs/${clubId}/outreach-stats`, { params: { days: 30 } })).data as OutreachStats,
    enabled: enabled && !!clubId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avisos a jugadores</CardTitle>
        <p className="text-sm text-muted-foreground">Notificar jugadores + Smart Fill · últimos 30 días</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {clubId ? <RadiusSetting clubId={clubId} radiusKm={radiusKm ?? DEFAULT_SLOT_OFFER_RADIUS_KM} /> : null}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando avisos…</p>
        ) : !data || data.notificationsSent === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no se enviaron avisos. Cuando publiques un horario con “Notificar jugadores” vas a ver acá
            cuántos lo vieron y cuántos reservaron.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Avisos" value={data.notificationsSent} hint={`${data.playersReached} jugadores`} />
              <Metric
                label="Vistos"
                value={data.notificationsOpened}
                hint={percent(data.notificationsOpened, data.notificationsSent)}
              />
              <Metric label="Reservas" value={data.slotsBooked} hint={`de ${data.slotsOffered} horarios`} />
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p>
                Manual: {data.manual.notificationsSent} avisos · {data.manual.slotsBooked} reservas
              </p>
              <p>
                Smart Fill: {data.auto.notificationsSent} avisos · {data.auto.slotsBooked} reservas
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Una reserva cuenta cuando un jugador avisado se suma al partido de ese horario.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
