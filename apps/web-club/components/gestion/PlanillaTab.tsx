'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, MessageCircle, Phone } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency';
import { AGENDA_END_HOUR, formatHourLabel, hourToMinutes, slotDateKey } from '@/lib/slot-time';
import {
  addDaysISO,
  formatHours,
  planillaRows,
  slotCourtKey,
  slotHolderLabel,
  startOfWeekISO,
  summarizeDay,
  todayLocalISO,
  type PlanillaCourt,
  type PlanillaSchedule,
  type PlanillaSlot,
} from '@/lib/planilla';
import { outreachPublishMessage } from '@/components/club/OutreachStatsCard';
import { AgendaDayBoard } from '@/components/gestion/AgendaDayBoard';
import { WeekOccupancyGrid } from '@/components/gestion/WeekOccupancyGrid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type PlanillaTabProps = {
  clubId: string;
  courts: PlanillaCourt[];
  defaultPricePerHour: number;
  defaultDurationHours: number;
  slotOfferRadiusKm: number;
};

type ApiError = { response?: { data?: { message?: string | string[] } }; message?: string };

type SlotForm = {
  slotId: string | null;
  kind: 'reserva' | 'libre';
  courtId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  price: string;
  name: string;
  phone: string;
  notify: boolean;
  wasManualBooking: boolean;
};

const selectClass = 'flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm';

function errorMessage(err: ApiError, fallback: string) {
  const msg = err.response?.data?.message;
  return Array.isArray(msg) ? msg.join(' · ') : msg || err.message || fallback;
}

function longDateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function whatsappLink(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: 'red' | 'green' }) {
  return (
    <Card className="bg-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {tone ? (
            <span className={cn('size-2.5 rounded-full', tone === 'red' ? 'bg-rose-600' : 'bg-emerald-500')} />
          ) : null}
          {label}
        </div>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Legend() {
  const items = [
    { className: 'bg-rose-600', label: 'Ocupado (reservado)' },
    { className: 'bg-emerald-500', label: 'Libre publicado en la app' },
    { className: 'bg-emerald-100 border border-emerald-300', label: 'Libre sin publicar' },
    { className: 'bg-amber-500', label: 'Bloqueado / mantenimiento' },
    { className: 'bg-muted border border-border', label: 'Cerrado' },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={cn('size-3 rounded-sm', item.className)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function PlanillaTab({
  clubId,
  courts,
  defaultPricePerHour,
  defaultDurationHours,
  slotOfferRadiusKm,
}: PlanillaTabProps) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(todayLocalISO());
  const [form, setForm] = useState<SlotForm | null>(null);
  const [detail, setDetail] = useState<PlanillaSlot | null>(null);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');

  const slotsQuery = useQuery({
    queryKey: ['court-slots', clubId],
    queryFn: async () => (await api.get(`/clubs/${clubId}/court-slots`)).data as PlanillaSlot[],
  });

  const schedulesQuery = useQuery({
    queryKey: ['club-court-schedules', clubId],
    queryFn: async () => (await api.get(`/clubs/${clubId}/court-schedules`)).data as PlanillaSchedule[],
  });

  const slots = useMemo(() => slotsQuery.data || [], [slotsQuery.data]);
  const schedules = useMemo(() => schedulesQuery.data || [], [schedulesQuery.data]);
  const summary = useMemo(() => summarizeDay(courts, date, slots, schedules), [courts, date, slots, schedules]);
  const weekStart = startOfWeekISO(date);
  const timeOptions = useMemo(() => [...planillaRows(), AGENDA_END_HOUR * 60], []);
  const durationMinutes = Math.round((defaultDurationHours || 1.5) * 60);

  const refreshSlots = () => queryClient.invalidateQueries({ queryKey: ['court-slots', clubId] });

  const onError = (fallback: string) => (err: ApiError) => toast.error(errorMessage(err, fallback));

  const saveForm = useMutation({
    mutationFn: async (f: SlotForm) => {
      const court = courts.find((c) => c.id === f.courtId);
      const parsedPrice = Number(String(f.price).replace(',', '.'));
      const payload = {
        courtId: f.courtId || undefined,
        courtLabel: court?.name || 'Cancha 1',
        slotDate: f.date,
        startHour: f.startMinutes / 60,
        endHour: f.endMinutes / 60,
        pricePerHour: Number.isFinite(parsedPrice) && f.price !== '' ? parsedPrice : undefined,
      };
      if (f.slotId) {
        await api.patch(`/clubs/${clubId}/court-slots/${f.slotId}`, payload);
        if (f.wasManualBooking && f.name.trim()) {
          await api.post(`/clubs/${clubId}/court-slots/${f.slotId}/manual-booking`, {
            name: f.name.trim(),
            phone: f.phone.trim() || undefined,
          });
        }
        return { message: 'Turno actualizado' };
      }
      if (f.kind === 'reserva') {
        await api.post(`/clubs/${clubId}/court-slots`, {
          ...payload,
          notifyPlayers: false,
          bookedByName: f.name.trim(),
          bookedByPhone: f.phone.trim() || undefined,
        });
        return { message: 'Reserva anotada' };
      }
      const res = await api.post(`/clubs/${clubId}/court-slots`, { ...payload, notifyPlayers: f.notify });
      const created = res.data as { notifiedCount?: number; notifyScheduledFor?: string | null };
      if (f.notify) {
        await queryClient.invalidateQueries({ queryKey: ['club-outreach-stats', clubId] });
        return { message: outreachPublishMessage(created.notifiedCount ?? 0, created.notifyScheduledFor) };
      }
      return { message: 'Turno libre publicado' };
    },
    onSuccess: async ({ message }) => {
      setForm(null);
      await refreshSlots();
      toast.success(message);
    },
    onError: onError('No se pudo guardar'),
  });

  const manualBooking = useMutation({
    mutationFn: async ({ slotId, name, phone }: { slotId: string; name: string; phone: string }) => {
      await api.post(`/clubs/${clubId}/court-slots/${slotId}/manual-booking`, {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setDetail(null);
      await refreshSlots();
      toast.success('Reserva anotada');
    },
    onError: onError('No se pudo anotar la reserva'),
  });

  const cancelManualBooking = useMutation({
    mutationFn: async (slotId: string) => {
      await api.delete(`/clubs/${clubId}/court-slots/${slotId}/manual-booking`);
    },
    onSuccess: async () => {
      setDetail(null);
      await refreshSlots();
      toast.success('Turno liberado');
    },
    onError: onError('No se pudo liberar el turno'),
  });

  const blockSlot = useMutation({
    mutationFn: async (slotId: string) => {
      await api.post(`/clubs/${clubId}/court-slots/${slotId}/block`, {
        kind: 'MAINTENANCE',
        reason: 'Mantenimiento',
      });
    },
    onSuccess: async () => {
      setDetail(null);
      await refreshSlots();
      toast.success('Turno bloqueado');
    },
    onError: onError('No se pudo bloquear'),
  });

  const unblockSlot = useMutation({
    mutationFn: async (slotId: string) => {
      await api.post(`/clubs/${clubId}/court-slots/${slotId}/unblock`);
    },
    onSuccess: async () => {
      setDetail(null);
      await refreshSlots();
      toast.success('Turno desbloqueado');
    },
    onError: onError('No se pudo desbloquear'),
  });

  const deleteSlot = useMutation({
    mutationFn: async (slotId: string) => {
      await api.delete(`/clubs/${clubId}/court-slots/${slotId}`);
    },
    onSuccess: async () => {
      setDetail(null);
      await refreshSlots();
      toast.success('Turno eliminado');
    },
    onError: onError('No se pudo eliminar'),
  });

  const moveSlot = useMutation({
    mutationFn: async (payload: {
      slotId: string;
      courtId: string;
      courtLabel: string;
      slotDate: string;
      startHour: number;
      endHour: number;
    }) => {
      const { slotId, ...body } = payload;
      await api.patch(`/clubs/${clubId}/court-slots/${slotId}`, body);
    },
    onSuccess: async () => {
      await refreshSlots();
      toast.success('Turno movido');
    },
    onError: onError('No se pudo mover el turno'),
  });

  const nextFreeEnd = (courtId: string, day: string, startMinutes: number) => {
    const wanted = Math.min(startMinutes + durationMinutes, AGENDA_END_HOUR * 60);
    const nextStart = slots
      .filter(
        (s) =>
          slotDateKey(s.slot_date) === day &&
          slotCourtKey(s) === courtId &&
          hourToMinutes(s.start_hour) > startMinutes,
      )
      .map((s) => hourToMinutes(s.start_hour))
      .sort((a, b) => a - b)[0];
    return nextStart != null ? Math.min(wanted, nextStart) : wanted;
  };

  const openNewForm = (court: PlanillaCourt | undefined, day: string, startMinutes: number, kind: SlotForm['kind']) => {
    const courtId = court?.id || courts[0]?.id || '';
    setForm({
      slotId: null,
      kind,
      courtId,
      date: day,
      startMinutes,
      endMinutes: nextFreeEnd(courtId, day, startMinutes),
      price: defaultPricePerHour ? String(Math.round(defaultPricePerHour)) : '',
      name: '',
      phone: '',
      notify: false,
      wasManualBooking: false,
    });
  };

  const openEditForm = (slot: PlanillaSlot) => {
    setDetail(null);
    const isManual = slot.status === 'BOOKED' && slot.booking_source === 'MANUAL';
    setForm({
      slotId: slot.id,
      kind: isManual ? 'reserva' : 'libre',
      courtId: slot.court_id || '',
      date: slotDateKey(slot.slot_date),
      startMinutes: hourToMinutes(slot.start_hour),
      endMinutes: hourToMinutes(slot.end_hour),
      price: String(Math.round(Number(slot.price_per_hour ?? slot.pricePerHour ?? defaultPricePerHour) || 0)),
      name: slot.booked_by_name || '',
      phone: slot.booked_by_phone || '',
      notify: false,
      wasManualBooking: isManual,
    });
  };

  const openDetail = (slot: PlanillaSlot) => {
    setQuickName('');
    setQuickPhone('');
    setDetail(slot);
  };

  const formInvalid =
    !form ||
    form.endMinutes <= form.startMinutes ||
    (form.kind === 'reserva' && (!form.slotId || form.wasManualBooking) && !form.name.trim());

  const detailIsManual = detail?.status === 'BOOKED' && detail.booking_source === 'MANUAL';
  const detailIsApp = detail?.status === 'BOOKED' && detail.booking_source !== 'MANUAL';
  const detailIsBlocked = detail?.status === 'BLOCKED' || detail?.status === 'MAINTENANCE';
  const detailPhone = detail?.booked_by_phone || '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border bg-surface-0 p-1">
            {(['day', 'week'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'rounded-lg px-3 py-1 text-sm font-medium',
                  view === v ? 'bg-card shadow-sm' : 'text-muted-foreground',
                )}
              >
                {v === 'day' ? 'Día' : 'Semana'}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            aria-label="Anterior"
            onClick={() => setDate(addDaysISO(date, view === 'day' ? -1 : -7))}
          >
            <ChevronLeft />
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => setDate(todayLocalISO())}>
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            aria-label="Siguiente"
            onClick={() => setDate(addDaysISO(date, view === 'day' ? 1 : 7))}
          >
            <ChevronRight />
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-40 rounded-xl"
          />
          <span className="text-sm font-medium capitalize">
            {view === 'day'
              ? longDateLabel(date)
              : `Semana del ${new Date(`${weekStart}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => openNewForm(undefined, date, 18 * 60, 'libre')}
          >
            Publicar turno libre
          </Button>
          <Button className="rounded-xl" onClick={() => openNewForm(undefined, date, 18 * 60, 'reserva')}>
            Anotar reserva
          </Button>
        </div>
      </div>

      {view === 'day' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Horas ocupadas" value={formatHours(summary.occupiedHours)} tone="red" />
          <SummaryTile label="Horas libres" value={formatHours(summary.freeHours)} tone="green" />
          <SummaryTile label="Ocupación del día" value={`${summary.occupancyPct}%`} />
          <SummaryTile label="Facturación estimada" value={formatCurrency(summary.bookedRevenue)} />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <Legend />
        <p className="text-xs text-muted-foreground">
          {view === 'day'
            ? 'Tocá un hueco verde para anotar una reserva que te hicieron por teléfono o WhatsApp. Arrastrá turnos para moverlos; los reservados desde la app no se mueven.'
            : 'Cada celda muestra canchas ocupadas sobre canchas abiertas. Tocá un día para ver el detalle.'}
        </p>
      </div>

      {slotsQuery.isLoading || schedulesQuery.isLoading ? (
        <div className="h-96 animate-pulse rounded-xl bg-surface-0" />
      ) : view === 'day' ? (
        <AgendaDayBoard
          date={date}
          courts={courts}
          slots={slots}
          schedules={schedules}
          moving={moveSlot.isPending}
          onMove={(payload) => moveSlot.mutate(payload)}
          onCellClick={(court, minutes) => openNewForm(court, date, minutes, 'reserva')}
          onSlotClick={openDetail}
        />
      ) : (
        <WeekOccupancyGrid
          weekStart={weekStart}
          courts={courts}
          slots={slots}
          schedules={schedules}
          onPickDay={(d) => {
            setDate(d);
            setView('day');
          }}
        />
      )}

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {form?.slotId ? 'Editar turno' : form?.kind === 'reserva' ? 'Anotar reserva' : 'Publicar turno libre'}
            </DialogTitle>
            <DialogDescription>
              {form?.kind === 'reserva'
                ? 'Queda en rojo en la planilla y ya no se ofrece en la app.'
                : 'Queda en verde y los jugadores lo pueden reservar desde la app.'}
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="grid gap-3">
              {!form.slotId ? (
                <div className="grid grid-cols-2 gap-1 rounded-xl border bg-surface-0 p-1">
                  {(['reserva', 'libre'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setForm({ ...form, kind: k })}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium',
                        form.kind === k ? 'bg-card shadow-sm' : 'text-muted-foreground',
                      )}
                    >
                      <span className={cn('size-2.5 rounded-full', k === 'reserva' ? 'bg-rose-600' : 'bg-emerald-500')} />
                      {k === 'reserva' ? 'Ocupado' : 'Libre'}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Cancha</Label>
                  <select
                    className={selectClass}
                    value={form.courtId}
                    onChange={(e) => setForm({ ...form, courtId: e.target.value })}
                  >
                    {courts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Desde</Label>
                  <select
                    className={selectClass}
                    value={form.startMinutes}
                    onChange={(e) => {
                      const start = Number(e.target.value);
                      const length = form.endMinutes - form.startMinutes;
                      setForm({
                        ...form,
                        startMinutes: start,
                        endMinutes: Math.min(start + (length > 0 ? length : durationMinutes), AGENDA_END_HOUR * 60),
                      });
                    }}
                  >
                    {timeOptions.slice(0, -1).map((m) => (
                      <option key={m} value={m}>
                        {formatHourLabel(m / 60)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Hasta</Label>
                  <select
                    className={selectClass}
                    value={form.endMinutes}
                    onChange={(e) => setForm({ ...form, endMinutes: Number(e.target.value) })}
                  >
                    {timeOptions
                      .filter((m) => m > form.startMinutes)
                      .map((m) => (
                        <option key={m} value={m}>
                          {m === AGENDA_END_HOUR * 60 ? '24:00' : formatHourLabel(m / 60)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              {form.kind === 'reserva' && (!form.slotId || form.wasManualBooking) ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>A nombre de</Label>
                    <Input
                      autoFocus
                      placeholder="Juan Pérez"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Teléfono (opcional)</Label>
                    <Input
                      placeholder="11 5555-5555"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>
              ) : null}
              <div className="space-y-1">
                <Label>Precio por hora</Label>
                <Input
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              {form.kind === 'libre' && !form.slotId ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.notify} onCheckedChange={(v) => setForm({ ...form, notify: v })} />
                    <Label>Avisar a jugadores cercanos</Label>
                  </div>
                  {form.notify ? (
                    <p className="text-xs text-muted-foreground">
                      Avisamos a jugadores a menos de {slotOfferRadiusKm} km (máx. 3 avisos por día de tu club), nunca
                      entre las 23 y las 8 hs.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              className={cn('rounded-xl', form?.kind === 'reserva' && !form?.slotId && 'bg-rose-600 hover:bg-rose-700')}
              disabled={formInvalid || saveForm.isPending}
              onClick={() => form && saveForm.mutate(form)}
            >
              {form?.slotId ? 'Guardar cambios' : form?.kind === 'reserva' ? 'Marcar ocupado' : 'Publicar libre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="rounded-2xl">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span
                    className={cn(
                      'size-3 rounded-full',
                      detail.status === 'BOOKED' ? 'bg-rose-600' : detailIsBlocked ? 'bg-amber-500' : 'bg-emerald-500',
                    )}
                  />
                  {detail.court_label} · {formatHourLabel(hourToMinutes(detail.start_hour) / 60)}–
                  {hourToMinutes(detail.end_hour) === AGENDA_END_HOUR * 60
                    ? '24:00'
                    : formatHourLabel(hourToMinutes(detail.end_hour) / 60)}
                </DialogTitle>
                <DialogDescription className="capitalize">{longDateLabel(slotDateKey(detail.slot_date))}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                {detail.status === 'BOOKED' ? (
                  <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30">
                    <p className="font-semibold text-rose-700 dark:text-rose-300">Ocupado</p>
                    <p>{slotHolderLabel(detail)}</p>
                    {detailIsApp ? (
                      <p className="text-xs text-muted-foreground">
                        Reservado desde la app{detail.match_title ? ` · ${detail.match_title}` : ''}. Se gestiona desde el
                        partido.
                      </p>
                    ) : null}
                    {detailPhone ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm" className="rounded-xl">
                          <a href={`tel:${detailPhone}`}>
                            <Phone /> {detailPhone}
                          </a>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="rounded-xl">
                          <a href={whatsappLink(detailPhone)} target="_blank" rel="noreferrer">
                            <MessageCircle /> WhatsApp
                          </a>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : detailIsBlocked ? (
                  <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
                    <p className="font-semibold text-amber-700 dark:text-amber-300">Bloqueado</p>
                    <p>{detail.block_reason || 'Sin motivo'}</p>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Libre · publicado en la app
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Reservado a nombre de"
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        className="rounded-xl bg-background"
                      />
                      <Input
                        placeholder="Teléfono (opcional)"
                        value={quickPhone}
                        onChange={(e) => setQuickPhone(e.target.value)}
                        className="rounded-xl bg-background"
                      />
                    </div>
                    <Button
                      className="w-full rounded-xl bg-rose-600 hover:bg-rose-700"
                      disabled={!quickName.trim() || manualBooking.isPending}
                      onClick={() => manualBooking.mutate({ slotId: detail.id, name: quickName, phone: quickPhone })}
                    >
                      Marcar ocupado
                    </Button>
                  </div>
                )}
                <p className="text-muted-foreground">
                  Precio: {formatCurrency(detail.price_per_hour ?? detail.pricePerHour ?? 0)}/h
                </p>
              </div>

              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {detailIsManual ? (
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      disabled={cancelManualBooking.isPending}
                      onClick={() => cancelManualBooking.mutate(detail.id)}
                    >
                      Liberar turno
                    </Button>
                  ) : null}
                  {detail.status === 'OPEN' ? (
                    <Button variant="outline" className="rounded-xl" onClick={() => blockSlot.mutate(detail.id)}>
                      Bloquear
                    </Button>
                  ) : null}
                  {detailIsBlocked ? (
                    <Button variant="outline" className="rounded-xl" onClick={() => unblockSlot.mutate(detail.id)}>
                      Desbloquear
                    </Button>
                  ) : null}
                  {!detailIsApp ? (
                    <Button variant="outline" className="rounded-xl" onClick={() => openEditForm(detail)}>
                      Editar
                    </Button>
                  ) : null}
                </div>
                {!detailIsApp ? (
                  <Button
                    variant="destructive"
                    className="rounded-xl"
                    disabled={deleteSlot.isPending}
                    onClick={() => {
                      if (window.confirm('¿Eliminar este turno de la planilla?')) deleteSlot.mutate(detail.id);
                    }}
                  >
                    Eliminar
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
