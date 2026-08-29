'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useClub } from '@/contexts/ClubContext';
import { PageHeader } from '@/components/layout/AppSidebar';
import { DashboardSkeleton, EmptyState } from '@/components/club/DashboardCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/currency';
import { formatShortDate } from '@/lib/format';

type Court = {
  id: string;
  name: string;
  surface?: string;
  isIndoor?: boolean;
  is_indoor?: boolean;
};

type CourtSlot = {
  id: string;
  court_id?: string;
  court_label: string;
  slot_date: string;
  start_hour: string | number;
  end_hour: string | number;
  price_per_hour?: number;
  pricePerHour?: number;
  status?: string;
};

type Promotion = {
  id: string;
  label: string;
  day_of_week?: number | null;
  start_hour?: string | number;
  end_hour?: string | number;
  bonus_points?: number;
};

type Schedule = {
  id: string;
  dayOfWeek?: number;
  day_of_week?: number;
  startHour?: string;
  start_hour?: string;
  endHour?: string;
  end_hour?: string;
};

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function GestionInner() {
  const params = useSearchParams();
  const { activeClubId, activeClub } = useClub();
  const queryClient = useQueryClient();
  const initialTab = params.get('tab') || 'slots';
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (params.get('tab')) setTab(params.get('tab')!);
  }, [params]);

  const courtsQuery = useQuery({
    queryKey: ['club-courts', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/courts`);
      return res.data as Court[];
    },
    enabled: !!activeClubId,
  });

  const slotsQuery = useQuery({
    queryKey: ['court-slots', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/court-slots`);
      return res.data as CourtSlot[];
    },
    enabled: !!activeClubId,
  });

  const promotionsQuery = useQuery({
    queryKey: ['club-promotions', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/promotions`);
      return res.data as Promotion[];
    },
    enabled: !!activeClubId,
  });

  const dashboardQuery = useQuery({
    queryKey: ['club-dashboard', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/dashboard`);
      return res.data as Record<string, unknown>;
    },
    enabled: !!activeClubId && tab === 'stats',
  });

  const insightsQuery = useQuery({
    queryKey: ['club-demand-insights', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/demand-insights`);
      return res.data as { valleys?: Array<{ title?: string; detail?: string }> };
    },
    enabled: !!activeClubId && tab === 'stats',
  });

  const clubQuery = useQuery({
    queryKey: ['club-detail', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}`);
      return res.data as {
        autoFillGapsEnabled?: boolean;
        auto_fill_gaps_enabled?: boolean;
        courtPricePerHour?: number;
        court_price_per_hour?: number;
        gapFillHoursBefore?: number;
        gap_fill_hours_before?: number;
        gapFillAutoCreateMatch?: boolean;
        gap_fill_auto_create_match?: boolean;
        gapFillNotifyEnabled?: boolean;
        gap_fill_notify_enabled?: boolean;
      };
    },
    enabled: !!activeClubId,
  });

  const [hoursBefore, setHoursBefore] = useState('8');
  const [autoCreateMatch, setAutoCreateMatch] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);

  useEffect(() => {
    const c = clubQuery.data;
    if (!c) return;
    setHoursBefore(String(c.gapFillHoursBefore ?? c.gap_fill_hours_before ?? 8));
    setAutoCreateMatch(!!(c.gapFillAutoCreateMatch ?? c.gap_fill_auto_create_match));
    const notify = c.gapFillNotifyEnabled ?? c.gap_fill_notify_enabled;
    setNotifyEnabled(notify !== false);
  }, [clubQuery.data]);

  const autoFillEnabled = !!(
    clubQuery.data?.autoFillGapsEnabled ?? clubQuery.data?.auto_fill_gaps_enabled
  );

  const autoFillMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await api.patch(`/clubs/${activeClubId}/auto-fill-gaps`, {
        enabled,
        hoursBefore: Number(hoursBefore) || 8,
        autoCreateMatch,
        notifyEnabled,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['club-detail', activeClubId] }),
        queryClient.invalidateQueries({ queryKey: ['club-manager-report', activeClubId] }),
        queryClient.invalidateQueries({ queryKey: ['club-demand-insights', activeClubId] }),
      ]);
      toast.success('Smart Fill actualizado');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Error');
    },
  });

  const saveRulesMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/clubs/${activeClubId}/auto-fill-gaps`, {
        enabled: autoFillEnabled,
        hoursBefore: Number(hoursBefore) || 8,
        autoCreateMatch,
        notifyEnabled,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-detail', activeClubId] });
      toast.success('Reglas guardadas');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Error');
    },
  });

  useEffect(() => {
    if (params.get('autofill') === '1' && clubQuery.data && !autoFillEnabled) {
      autoFillMutation.mutate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, autoFillEnabled]);

  // Slot form
  const [slotOpen, setSlotOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [courtId, setCourtId] = useState('');
  const [courtLabel, setCourtLabel] = useState('Cancha 1');
  const [slotDate, setSlotDate] = useState(todayISO());
  const [startHour, setStartHour] = useState('18:00');
  const [endHour, setEndHour] = useState('19:30');
  const [slotPrice, setSlotPrice] = useState('');
  const [notifyPlayers, setNotifyPlayers] = useState(false);

  // Court form
  const [courtOpen, setCourtOpen] = useState(false);
  const [newCourtName, setNewCourtName] = useState('');
  const [expandedCourtId, setExpandedCourtId] = useState<string | null>(null);

  const schedulesQuery = useQuery({
    queryKey: ['court-schedules', activeClubId, expandedCourtId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/courts/${expandedCourtId}/schedules`);
      return res.data as Schedule[];
    },
    enabled: !!activeClubId && !!expandedCourtId,
  });

  // Promo form
  const [promoLabel, setPromoLabel] = useState('Horario valle');
  const [promoDay, setPromoDay] = useState('1');
  const [promoStart, setPromoStart] = useState('10:00');
  const [promoEnd, setPromoEnd] = useState('12:00');

  const defaultPrice = useMemo(() => {
    const hourly = Number(
      clubQuery.data?.courtPricePerHour ?? clubQuery.data?.court_price_per_hour ?? 0,
    );
    return String(Math.round(hourly) || '');
  }, [clubQuery.data?.courtPricePerHour, clubQuery.data?.court_price_per_hour]);

  const openNewSlot = () => {
    setEditingSlotId(null);
    setCourtId(courtsQuery.data?.[0]?.id || '');
    setCourtLabel(courtsQuery.data?.[0]?.name || 'Cancha 1');
    setSlotDate(todayISO());
    setStartHour('18:00');
    setEndHour('19:30');
    setSlotPrice(defaultPrice);
    setNotifyPlayers(false);
    setSlotOpen(true);
  };

  const openEditSlot = (slot: CourtSlot) => {
    setEditingSlotId(slot.id);
    setCourtId(slot.court_id || '');
    setCourtLabel(slot.court_label);
    setSlotDate(String(slot.slot_date).slice(0, 10));
    setStartHour(String(slot.start_hour).slice(0, 5));
    setEndHour(String(slot.end_hour).slice(0, 5));
    setSlotPrice(
      String(Math.round(Number(slot.price_per_hour ?? slot.pricePerHour ?? defaultPrice))),
    );
    setSlotOpen(true);
  };

  const saveSlot = useMutation({
    mutationFn: async () => {
      const parsedPrice = Number(String(slotPrice).replace(',', '.'));
      const payload = {
        courtId: courtId || undefined,
        courtLabel: courtLabel.trim() || 'Cancha 1',
        slotDate,
        startHour,
        endHour,
        pricePerHour: Number.isFinite(parsedPrice) ? parsedPrice : undefined,
      };
      if (editingSlotId) {
        await api.patch(`/clubs/${activeClubId}/court-slots/${editingSlotId}`, payload);
      } else {
        await api.post(`/clubs/${activeClubId}/court-slots`, { ...payload, notifyPlayers });
      }
    },
    onSuccess: async () => {
      setSlotOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['court-slots', activeClubId] });
      toast.success(editingSlotId ? 'Horario actualizado' : 'Horario publicado');
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      toast.error(err.response?.data?.message || err.message || 'Error al guardar');
    },
  });

  const deleteSlot = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clubs/${activeClubId}/court-slots/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['court-slots', activeClubId] });
      toast.success('Horario eliminado');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo eliminar');
    },
  });

  const saveCourt = useMutation({
    mutationFn: async () => {
      await api.post(`/clubs/${activeClubId}/courts`, { name: newCourtName.trim() });
    },
    onSuccess: async () => {
      setCourtOpen(false);
      setNewCourtName('');
      await queryClient.invalidateQueries({ queryKey: ['club-courts', activeClubId] });
      toast.success('Cancha creada');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Error');
    },
  });

  const deleteCourt = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clubs/${activeClubId}/courts/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-courts', activeClubId] });
      toast.success('Cancha eliminada');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Error');
    },
  });

  const generateSlots = useMutation({
    mutationFn: async (courtIdToGen: string) => {
      await api.post(`/clubs/${activeClubId}/courts/${courtIdToGen}/generate-slots`, {
        daysAhead: 14,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['court-slots', activeClubId] });
      toast.success('Slots generados');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Error al generar');
    },
  });

  const addSchedule = useMutation({
    mutationFn: async () => {
      await api.post(`/clubs/${activeClubId}/courts/${expandedCourtId}/schedules`, {
        dayOfWeek: 1,
        startHour: '09:00',
        endHour: '22:00',
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['court-schedules', activeClubId, expandedCourtId],
      });
      toast.success('Horario fijo agregado');
    },
  });

  const deleteSchedule = useMutation({
    mutationFn: async (scheduleId: string) => {
      await api.delete(
        `/clubs/${activeClubId}/courts/${expandedCourtId}/schedules/${scheduleId}`,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['court-schedules', activeClubId, expandedCourtId],
      });
    },
  });

  const createPromo = useMutation({
    mutationFn: async () => {
      await api.post(`/clubs/${activeClubId}/promotions`, {
        label: promoLabel.trim() || 'Horario valle',
        dayOfWeek: Number(promoDay),
        startHour: promoStart,
        endHour: promoEnd,
        bonusPoints: 0,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-promotions', activeClubId] });
      toast.success('Promoción creada');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Error');
    },
  });

  const deletePromo = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clubs/${activeClubId}/promotions/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-promotions', activeClubId] });
      toast.success('Promoción eliminada');
    },
  });

  if (!activeClubId) {
    return <EmptyState title="Seleccioná un club" />;
  }

  if (courtsQuery.isLoading && slotsQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión"
        subtitle={activeClub?.name}
        actions={
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2">
            <Switch
              checked={autoFillEnabled}
              onCheckedChange={(v) => autoFillMutation.mutate(v)}
            />
            <Label className="text-sm">Smart Fill</Label>
          </div>
        }
      />

      <Card className="border-primary/20 bg-gradient-to-br from-card to-surface-0">
        <CardHeader>
          <CardTitle className="text-base">Smart Fill · reglas tipo SmartClub</CardTitle>
          <p className="text-sm text-muted-foreground">
            Si un turno valle sigue vacío N horas antes, avisamos jugadores o publicamos un partido
            abierto automáticamente.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label>Horas antes del turno</Label>
            <Input
              value={hoursBefore}
              onChange={(e) => setHoursBefore(e.target.value)}
              className="rounded-xl"
              type="number"
              min={1}
              max={72}
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2">
            <Switch checked={autoCreateMatch} onCheckedChange={setAutoCreateMatch} />
            <Label className="text-sm">Auto-publicar partido abierto</Label>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2">
            <Switch checked={notifyEnabled} onCheckedChange={setNotifyEnabled} />
            <Label className="text-sm">Notificar candidatos</Label>
          </div>
          <Button
            className="rounded-xl self-end"
            onClick={() => saveRulesMutation.mutate()}
            disabled={saveRulesMutation.isPending}
          >
            Guardar reglas
          </Button>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl bg-surface-0 p-1">
          <TabsTrigger value="slots" className="rounded-lg">
            Turnos
          </TabsTrigger>
          <TabsTrigger value="courts" className="rounded-lg">
            Canchas
          </TabsTrigger>
          <TabsTrigger value="promotions" className="rounded-lg">
            Promos
          </TabsTrigger>
          <TabsTrigger value="stats" className="rounded-lg">
            Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="slots" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button className="rounded-xl" onClick={openNewSlot}>
              Nuevo turno
            </Button>
          </div>
          <div className="space-y-2">
            {(slotsQuery.data || []).map((slot) => (
              <Card key={slot.id} className="bg-card">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">
                      {slot.court_label} · {formatShortDate(slot.slot_date)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {String(slot.start_hour).slice(0, 5)} – {String(slot.end_hour).slice(0, 5)} ·{' '}
                      {formatCurrency(slot.price_per_hour ?? slot.pricePerHour ?? 0)}/h
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{slot.status || 'OPEN'}</Badge>
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => openEditSlot(slot)}>
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => deleteSlot.mutate(slot.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!slotsQuery.data?.length ? (
              <EmptyState title="Sin turnos" description="Publicá el primer horario disponible." />
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="courts" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button className="rounded-xl" onClick={() => setCourtOpen(true)}>
              Nueva cancha
            </Button>
          </div>
          {(courtsQuery.data || []).map((court) => (
            <Card key={court.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{court.name}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() =>
                      setExpandedCourtId(expandedCourtId === court.id ? null : court.id)
                    }
                  >
                    Horarios fijos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => generateSlots.mutate(court.id)}
                  >
                    Generar slots
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => deleteCourt.mutate(court.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </CardHeader>
              {expandedCourtId === court.id ? (
                <CardContent className="space-y-2">
                  {(schedulesQuery.data || []).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-xl bg-surface-0 px-3 py-2 text-sm"
                    >
                      <span>
                        Día {s.dayOfWeek ?? s.day_of_week} ·{' '}
                        {String(s.startHour ?? s.start_hour)}–
                        {String(s.endHour ?? s.end_hour)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSchedule.mutate(s.id)}
                      >
                        Quitar
                      </Button>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => addSchedule.mutate()}>
                    Agregar Lun 09–22
                  </Button>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="promotions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nueva promoción valle</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Label</Label>
                <Input value={promoLabel} onChange={(e) => setPromoLabel(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Día (0=Dom)</Label>
                <Input value={promoDay} onChange={(e) => setPromoDay(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Desde</Label>
                <Input value={promoStart} onChange={(e) => setPromoStart(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Hasta</Label>
                <Input value={promoEnd} onChange={(e) => setPromoEnd(e.target.value)} className="rounded-xl" />
              </div>
              <Button className="rounded-xl sm:col-span-2 lg:col-span-4" onClick={() => createPromo.mutate()}>
                Crear promoción
              </Button>
            </CardContent>
          </Card>
          {(promotionsQuery.data || []).map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-sm text-muted-foreground">
                    Día {p.day_of_week ?? '—'} · {String(p.start_hour)}–{String(p.end_hour)}
                  </p>
                </div>
                <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => deletePromo.mutate(p.id)}>
                  Eliminar
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="stats" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dashboard operativo</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-xl bg-surface-0 p-4 text-xs text-muted-foreground">
                {JSON.stringify(dashboardQuery.data || {}, null, 2)}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Demand insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(insightsQuery.data?.valleys || []).map((v, i) => (
                <div key={i} className="rounded-xl bg-surface-0 p-3">
                  <p className="font-medium">{v.title}</p>
                  <p className="text-sm text-muted-foreground">{v.detail}</p>
                </div>
              ))}
              {!insightsQuery.data?.valleys?.length ? (
                <p className="text-sm text-muted-foreground">Sin insights por ahora.</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={slotOpen} onOpenChange={setSlotOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingSlotId ? 'Editar turno' : 'Nuevo turno'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Cancha</Label>
              <Select
                value={courtId || undefined}
                onValueChange={(v) => {
                  setCourtId(v);
                  const c = courtsQuery.data?.find((x) => x.id === v);
                  if (c) setCourtLabel(c.name);
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Elegir cancha" />
                </SelectTrigger>
                <SelectContent>
                  {(courtsQuery.data || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Label</Label>
              <Input value={courtLabel} onChange={(e) => setCourtLabel(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Desde</Label>
                <Input value={startHour} onChange={(e) => setStartHour(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Hasta</Label>
                <Input value={endHour} onChange={(e) => setEndHour(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Precio/hora</Label>
              <Input value={slotPrice} onChange={(e) => setSlotPrice(e.target.value)} className="rounded-xl" />
            </div>
            {!editingSlotId ? (
              <div className="flex items-center gap-2">
                <Switch checked={notifyPlayers} onCheckedChange={setNotifyPlayers} />
                <Label>Notificar jugadores</Label>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button className="rounded-xl" onClick={() => saveSlot.mutate()} disabled={saveSlot.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={courtOpen} onOpenChange={setCourtOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nueva cancha</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nombre"
            value={newCourtName}
            onChange={(e) => setNewCourtName(e.target.value)}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button className="rounded-xl" onClick={() => saveCourt.mutate()} disabled={!newCourtName.trim()}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GestionPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <GestionInner />
    </Suspense>
  );
}
