import { useMemo, useState, useEffect } from 'react';
import { ScrollView, Text, View, Alert, TouchableOpacity, Switch } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { formatShortDate, startOfDay } from '@/lib/format';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  AppHeader,
  AppCard,
  PrimaryButton,
  InputField,
  EmptyState,
  SectionHeader,
  SelectionChip,
  MonthlyCalendar,
  useToast,
} from '@/components/padely';
import { ClubCourtsManager } from '@/components/club/ClubCourtsManager';
import type { ClubCourt } from '@/components/club/ClubCourtsManager';
import {
  ClubPicker,
  resolveActiveClubId,
  useMineClubs,
} from '@/components/club/ClubPicker';
import { ManagerQuickActions } from '@/components/club/ManagerQuickActions';

const SLOT_START_MINUTES = 8 * 60;
const SLOT_END_MINUTES = 24 * 60;
const SLOT_STEP_MINUTES = 30;
const DEFAULT_SLOT_DURATION = 90;
const TIME_SLOTS = Array.from(
  { length: (SLOT_END_MINUTES - SLOT_START_MINUTES) / SLOT_STEP_MINUTES + 1 },
  (_, i) => SLOT_START_MINUTES + i * SLOT_STEP_MINUTES,
);
/** Horarios válidos como inicio (hasta 23:30). */
const START_TIME_SLOTS = TIME_SLOTS.filter((m) => m < SLOT_END_MINUTES);
/** Horarios válidos como fin (desde 08:30 hasta 00:00). */
const END_TIME_SLOTS = TIME_SLOTS.filter((m) => m > SLOT_START_MINUTES);
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEK_DAY_COUNT = 7;

function buildWeekDays() {
  return Array.from({ length: WEEK_DAY_COUNT }, (_, offset) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const label =
      offset === 0
        ? 'Hoy'
        : offset === 1
          ? 'Mañana'
          : `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
    return { label, offset };
  });
}

const DAYS = buildWeekDays();

type Tab = 'courts' | 'slots' | 'promotions' | 'stats';

function formatSlotTime(value: number, fromApiHour = false) {
  const minutes = fromApiHour ? Math.round(value * 60) : value;
  if (minutes >= SLOT_END_MINUTES) return '00:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function minutesToApiHour(minutes: number) {
  return minutes / 60;
}

function apiHourToMinutes(hour: number) {
  return Math.round(hour * 60);
}

function toSlotDate(offset: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dayOffsetFromDate(dateStr: string) {
  const target = dateStr.slice(0, 10);
  const found = DAYS.findIndex((day) => toSlotDate(day.offset) === target);
  return found >= 0 ? found : 0;
}

function snapEndAfterStart(start: number, preferredEnd?: number) {
  if (preferredEnd != null && preferredEnd > start) return preferredEnd;
  return Math.min(SLOT_END_MINUTES, start + DEFAULT_SLOT_DURATION);
}

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function slotDateKey(slotDate: string) {
  return slotDate.slice(0, 10);
}

interface CourtSlot {
  id: string;
  court_id?: string | null;
  court_label: string;
  slot_date: string;
  start_hour: number;
  end_hour: number;
  status: string;
  bonus_points?: number;
  price_per_hour?: number | null;
  pricePerHour?: number | null;
}

interface ClubDashboard {
  openSlots: number;
  slotsThisWeek: number;
  uniquePlayers30d: number;
  matchesFinished30d: number;
  activeMatches: number;
  rotationIndex: number;
  autoFillGapsEnabled?: boolean;
}

interface DemandValley {
  dayOfWeek: number;
  hourBucket: number;
  occupancyPct: number;
  totalSlots: number;
  bookedSlots: number;
  candidateCount: number;
}

interface DemandInsights {
  historyDays: number;
  occupancyThresholdPct: number;
  valleys: DemandValley[];
}

interface Promotion {
  id: string;
  label: string;
  day_of_week: number | null;
  start_hour: number;
  end_hour: number;
  bonus_points: number;
  active?: boolean;
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'courts', label: 'Canchas' },
    { key: 'slots', label: 'Horarios' },
    { key: 'promotions', label: 'Promociones' },
    { key: 'stats', label: 'Estadísticas' },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingRight: 4 }}
      style={{ marginBottom: 16 }}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {tabs.map((tabItem) => (
          <SelectionChip
            key={tabItem.key}
            label={tabItem.label}
            selected={active === tabItem.key}
            onPress={() => onChange(tabItem.key)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

export default function CourtSlotsScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const canManage = isClub(user?.role);
  const params = useLocalSearchParams<{
    tab?: string;
    dayOfWeek?: string;
    hourBucket?: string;
  }>();

  const initialTab = (['courts', 'slots', 'promotions', 'stats'] as Tab[]).includes(
    params.tab as Tab,
  )
    ? (params.tab as Tab)
    : 'courts';
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if ((['courts', 'slots', 'promotions', 'stats'] as Tab[]).includes(params.tab as Tab)) {
      setTab(params.tab as Tab);
    }
  }, [params.tab]);

  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [calendarDate, setCalendarDate] = useState(() => startOfDay(new Date()));
  const [startMinutes, setStartMinutes] = useState(10 * 60);
  const [endMinutes, setEndMinutes] = useState(12 * 60);
  const [courtLabel, setCourtLabel] = useState('Cancha 1');
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [slotPrice, setSlotPrice] = useState('');
  const [notifyPlayers, setNotifyPlayers] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  const [promoLabel, setPromoLabel] = useState('Horario valle');
  const [promoDay, setPromoDay] = useState<number | null>(null);
  const [promoStart, setPromoStart] = useState(10 * 60);
  const [promoEnd, setPromoEnd] = useState(16 * 60);
  const [hoursBefore, setHoursBefore] = useState('8');
  const [autoCreateMatch, setAutoCreateMatch] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);

  useEffect(() => {
    const dayRaw = params.dayOfWeek;
    const hourRaw = params.hourBucket;
    if (dayRaw == null && hourRaw == null) return;
    if (params.tab === 'promotions' || dayRaw != null || hourRaw != null) {
      setTab('promotions');
    }
    if (dayRaw != null && dayRaw !== '') {
      const day = Number(dayRaw);
      if (!Number.isNaN(day) && day >= 0 && day <= 6) {
        setPromoDay(day);
        setPromoLabel(`Promo ${WEEKDAYS[day]} valle`);
      }
    }
    if (hourRaw != null && hourRaw !== '') {
      const hour = Number(hourRaw);
      if (!Number.isNaN(hour) && hour >= 0 && hour < 24) {
        const start = Math.round(hour) * 60;
        setPromoStart(start);
        setPromoEnd(snapEndAfterStart(start, start + 60));
      }
    }
  }, [params.dayOfWeek, params.hourBucket, params.tab]);

  const { data: clubs } = useMineClubs(canManage && !!user?.id);

  useEffect(() => {
    if (!selectedClubId || !clubs) return;
    if (!clubs.some((c) => c.id === selectedClubId)) {
      setSelectedClubId(null);
    }
  }, [clubs, selectedClubId]);

  const activeClubId = useMemo(
    () => resolveActiveClubId(selectedClubId, clubs),
    [selectedClubId, clubs],
  );
  const activeClub = clubs?.find((c) => c.id === activeClubId);

  const { data: clubDetail } = useQuery({
    queryKey: ['club-detail-slots', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}`);
      return res.data as {
        id: string;
        name: string;
        courtPricePerHour?: number;
        court_price_per_hour?: number;
        autoFillGapsEnabled?: boolean;
        auto_fill_gaps_enabled?: boolean;
        gapFillHoursBefore?: number;
        gap_fill_hours_before?: number;
        gapFillAutoCreateMatch?: boolean;
        gap_fill_auto_create_match?: boolean;
        gapFillNotifyEnabled?: boolean;
        gap_fill_notify_enabled?: boolean;
      };
    },
    enabled: canManage && !!activeClubId,
  });

  useEffect(() => {
    if (!clubDetail) return;
    setHoursBefore(
      String(clubDetail.gapFillHoursBefore ?? clubDetail.gap_fill_hours_before ?? 8),
    );
    setAutoCreateMatch(
      Boolean(clubDetail.gapFillAutoCreateMatch ?? clubDetail.gap_fill_auto_create_match),
    );
    const notify = clubDetail.gapFillNotifyEnabled ?? clubDetail.gap_fill_notify_enabled;
    setNotifyEnabled(notify !== false);
  }, [clubDetail]);

  const defaultSlotPrice = useMemo(() => {
    const hourly = Number(clubDetail?.courtPricePerHour ?? clubDetail?.court_price_per_hour ?? 0);
    if (hourly > 0) {
      return String(Math.round(hourly));
    }
    return '';
  }, [clubDetail]);

  const slotPricePerHour = useMemo(() => {
    const parsed = slotPrice.trim() === '' ? Number(defaultSlotPrice) : Number(slotPrice.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [slotPrice, defaultSlotPrice]);

  const estimatedSlotTotal = useMemo(() => {
    if (!slotPricePerHour) return null;
    const durationHours = (endMinutes - startMinutes) / 60;
    if (durationHours <= 0) return null;
    return Math.round(slotPricePerHour * durationHours);
  }, [slotPricePerHour, startMinutes, endMinutes]);

  const { data: courts } = useQuery({
    queryKey: ['club-courts', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/courts`);
      return res.data as ClubCourt[];
    },
    enabled: canManage && !!activeClubId,
  });

  const activeCourts = useMemo(() => (courts || []).filter((c) => c.active), [courts]);

  const { data: slots, isLoading } = useQuery({
    queryKey: ['court-slots', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/court-slots`);
      return res.data as CourtSlot[];
    },
    enabled: canManage && !!activeClubId,
  });

  const { data: dashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ['club-dashboard', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/dashboard`);
      return res.data as ClubDashboard;
    },
    enabled: canManage && !!activeClubId && tab === 'stats',
  });

  const { data: demandInsights, isLoading: loadingInsights } = useQuery({
    queryKey: ['club-demand-insights', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/demand-insights`);
      return res.data as DemandInsights;
    },
    enabled: canManage && !!activeClubId && tab === 'stats',
  });

  const { data: promotions } = useQuery({
    queryKey: ['club-promotions', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/promotions`);
      return res.data as Promotion[];
    },
    enabled: canManage && !!activeClubId && tab === 'promotions',
  });

  const activePromotions = (promotions || []).filter((p) => p.active !== false);

  const setAutoFillGaps = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!activeClubId) throw new Error('Seleccioná un club');
      const res = await api.patch(`/clubs/${activeClubId}/auto-fill-gaps`, {
        enabled,
        hoursBefore: Number(hoursBefore) || 8,
        autoCreateMatch,
        notifyEnabled,
      });
      return res.data as {
        autoFillGapsEnabled: boolean;
        gapFillHoursBefore?: number;
        gapFillAutoCreateMatch?: boolean;
        gapFillNotifyEnabled?: boolean;
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['club-dashboard', activeClubId], (old: ClubDashboard | undefined) =>
        old ? { ...old, autoFillGapsEnabled: data.autoFillGapsEnabled } : old,
      );
      queryClient.invalidateQueries({ queryKey: ['club-dashboard', activeClubId] });
      queryClient.invalidateQueries({ queryKey: ['club-detail-slots', activeClubId] });
      queryClient.invalidateQueries({ queryKey: ['club-manager-report', activeClubId] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo actualizar el relleno automático');
    },
  });

  const saveSmartFillRules = useMutation({
    mutationFn: async () => {
      if (!activeClubId) throw new Error('Seleccioná un club');
      const enabled = Boolean(
        dashboard?.autoFillGapsEnabled ??
          clubDetail?.autoFillGapsEnabled ??
          clubDetail?.auto_fill_gaps_enabled,
      );
      const res = await api.patch(`/clubs/${activeClubId}/auto-fill-gaps`, {
        enabled,
        hoursBefore: Number(hoursBefore) || 8,
        autoCreateMatch,
        notifyEnabled,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-detail-slots', activeClubId] });
      queryClient.invalidateQueries({ queryKey: ['club-dashboard', activeClubId] });
      showToast('Reglas Smart Fill guardadas', 'success');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudieron guardar las reglas');
    },
  });

  const resetSlotForm = () => {
    setShowForm(false);
    setEditingSlotId(null);
    setCourtLabel(activeCourts[0]?.name || 'Cancha 1');
    setSelectedCourtId(activeCourts[0]?.id || null);
    setSelectedDay(0);
    setStartMinutes(10 * 60);
    setEndMinutes(12 * 60);
    setSlotPrice('');
    setNotifyPlayers(true);
  };

  const openNewSlotForm = () => {
    setEditingSlotId(null);
    setSelectedCourtId(activeCourts[0]?.id || null);
    setCourtLabel(activeCourts[0]?.name || 'Cancha 1');
    setSelectedDay(0);
    setStartMinutes(10 * 60);
    setEndMinutes(12 * 60);
    setSlotPrice(defaultSlotPrice);
    setNotifyPlayers(true);
    setShowForm(true);
  };

  // Al publicar, el precio por hora arranca en la tarifa base del club (sin pisar si ya lo editaron).
  useEffect(() => {
    if (showForm && !editingSlotId && defaultSlotPrice) {
      setSlotPrice((prev) => (prev.trim() ? prev : defaultSlotPrice));
    }
  }, [showForm, editingSlotId, defaultSlotPrice]);

  const openEditSlot = (slot: CourtSlot) => {
    setEditingSlotId(slot.id);
    setCourtLabel(slot.court_label);
    setSelectedCourtId(slot.court_id || courts?.find((c) => c.name === slot.court_label)?.id || null);
    setSelectedDay(dayOffsetFromDate(slot.slot_date));
    setStartMinutes(apiHourToMinutes(slot.start_hour));
    setEndMinutes(apiHourToMinutes(slot.end_hour));
    setSlotPrice(
      slot.price_per_hour != null || slot.pricePerHour != null
        ? String(Math.round(Number(slot.price_per_hour ?? slot.pricePerHour)))
        : defaultSlotPrice,
    );
    setNotifyPlayers(false);
    setShowForm(true);
    const key = slotDateKey(slot.slot_date);
    const [y, m, d] = key.split('-').map(Number);
    if (y && m && d) setCalendarDate(startOfDay(new Date(y, m - 1, d)));
  };

  const saveSlot = useMutation({
    mutationFn: async () => {
      if (!activeClubId) throw new Error('Seleccioná un club');
      const raw = slotPrice.trim() || defaultSlotPrice;
      const parsedPrice = raw === '' ? undefined : Number(raw.replace(',', '.'));
      if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
        throw new Error('Precio por hora inválido');
      }
      if (!editingSlotId && (parsedPrice == null || parsedPrice <= 0)) {
        throw new Error('Configurá la tarifa base del club (Perfil → Datos) o ingresá un precio por hora');
      }
      const payload = {
        courtId: selectedCourtId || undefined,
        courtLabel: courtLabel.trim() || 'Cancha 1',
        slotDate: toSlotDate(DAYS[selectedDay].offset),
        startHour: minutesToApiHour(startMinutes),
        endHour: minutesToApiHour(endMinutes),
        pricePerHour: parsedPrice,
      };
      if (editingSlotId) {
        const res = await api.patch(`/clubs/${activeClubId}/court-slots/${editingSlotId}`, payload);
        return res.data;
      }
      const res = await api.post(`/clubs/${activeClubId}/court-slots`, {
        ...payload,
        notifyPlayers,
      });
      return res.data;
    },
    onSuccess: (data) => {
      const wasEditing = !!editingSlotId;
      const publishedKey = toSlotDate(DAYS[selectedDay].offset);
      const [y, m, d] = publishedKey.split('-').map(Number);
      if (y && m && d) setCalendarDate(startOfDay(new Date(y, m - 1, d)));
      resetSlotForm();
      queryClient.invalidateQueries({ queryKey: ['court-slots', activeClubId] });
      queryClient.invalidateQueries({ queryKey: ['club-dashboard', activeClubId] });
      queryClient.invalidateQueries({ queryKey: ['club-courts', activeClubId] });
      if (wasEditing) {
        Alert.alert('Listo', 'Horario actualizado');
        return;
      }
      const count = data.notifiedCount ?? 0;
      Alert.alert(
        'Horario publicado',
        count > 0
          ? `Se avisó a ${count} jugador${count === 1 ? '' : 'es'}.`
          : 'Publicado sin jugadores en la zona para notificar.',
      );
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo guardar el horario');
    },
  });

  const createValleyPromotion = useMutation({
    mutationFn: async () => {
      if (!activeClubId) return;
      await api.post(`/clubs/${activeClubId}/promotions`, {
        label: promoLabel.trim() || 'Horario valle',
        dayOfWeek: promoDay ?? undefined,
        startHour: minutesToApiHour(promoStart),
        endHour: minutesToApiHour(promoEnd),
        bonusPoints: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-promotions', activeClubId] });
      Alert.alert('Listo', 'Horario valle guardado');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'Error'),
  });

  const deletePromotion = useMutation({
    mutationFn: async (promotionId: string) => {
      if (!activeClubId) return;
      await api.delete(`/clubs/${activeClubId}/promotions/${promotionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-promotions', activeClubId] });
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo eliminar'),
  });

  const deleteSlot = useMutation({
    mutationFn: async (slotId: string) => {
      if (!activeClubId) return;
      await api.delete(`/clubs/${activeClubId}/court-slots/${slotId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['court-slots', activeClubId] });
      queryClient.invalidateQueries({ queryKey: ['club-dashboard', activeClubId] });
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo eliminar'),
  });

  const handleDeleteSlot = (slot: CourtSlot) => {
    Alert.alert('Eliminar horario', `¿Quitar ${slot.court_label} del ${formatShortDate(slot.slot_date)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteSlot.mutate(slot.id) },
    ]);
  };

  const handleDeletePromotion = (promotion: Promotion) => {
    Alert.alert('Eliminar promoción', `¿Desactivar "${promotion.label}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deletePromotion.mutate(promotion.id) },
    ]);
  };

  const occupancyRate = useMemo(() => {
    if (!dashboard) return 0;
    const total = dashboard.slotsThisWeek + dashboard.openSlots;
    if (total <= 0) return dashboard.rotationIndex;
    return Math.min(100, Math.round((dashboard.slotsThisWeek / total) * 100));
  }, [dashboard]);

  const slotDayKeys = useMemo(
    () => (slots || []).map((slot) => slotDateKey(slot.slot_date)),
    [slots],
  );

  const slotsForSelectedDay = useMemo(() => {
    const key = toDayKey(calendarDate);
    return (slots || [])
      .filter((slot) => slotDateKey(slot.slot_date) === key)
      .sort((a, b) => a.start_hour - b.start_hour || a.court_label.localeCompare(b.court_label));
  }, [slots, calendarDate]);

  if (!canManage) {
    return (
      <Screen>
        <AppHeader title="Gestión" />
        <EmptyState
          icon={<Ionicons name="time-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
          description="Esta sección es solo para cuentas de club."
        />
      </Screen>
    );
  }

  const clubPicker = (
    <ClubPicker
      selectedClubId={activeClubId}
      onSelect={setSelectedClubId}
      enabled={canManage}
    />
  );

  const quickActions = (
    <>
      <SectionHeader title="Accesos rápidos" subtitle="Atajos de operación del club" />
      <ManagerQuickActions
        actions={[
          {
            id: 'court',
            label: 'Crear cancha',
            icon: 'add-circle-outline',
            onPress: () => setTab('courts'),
          },
          {
            id: 'promo',
            label: 'Crear promoción',
            icon: 'pricetag-outline',
            onPress: () => setTab('promotions'),
          },
          {
            id: 'client',
            label: 'Ver clientes',
            icon: 'person-add-outline',
            onPress: () =>
              router.push({
                pathname: '/club-clients',
                params: { clubId: activeClubId || '', clubName: activeClub?.name || '' },
              } as any),
          },
        ]}
      />
    </>
  );

  const promoTimeRange = (
    <>
      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>Desde</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {START_TIME_SLOTS.map((minutes) => (
            <SelectionChip
              key={`start-${minutes}`}
              label={formatSlotTime(minutes)}
              selected={promoStart === minutes}
              onPress={() => {
                setPromoStart(minutes);
                setPromoEnd((prev) => snapEndAfterStart(minutes, prev));
              }}
            />
          ))}
        </View>
      </ScrollView>
      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>Hasta</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {END_TIME_SLOTS.filter((m) => m > promoStart).map((minutes) => (
            <SelectionChip
              key={`end-${minutes}`}
              label={formatSlotTime(minutes)}
              selected={promoEnd === minutes}
              onPress={() => setPromoEnd(minutes)}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );

  const promoDayPicker = (
    <>
      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>Día (vacío = todos)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SelectionChip label="Todos" selected={promoDay === null} onPress={() => setPromoDay(null)} />
          {WEEKDAYS.map((d, i) => (
            <SelectionChip key={d} label={d} selected={promoDay === i} onPress={() => setPromoDay(i)} />
          ))}
        </View>
      </ScrollView>
    </>
  );

  return (
    <Screen>
      <AppHeader title="Gestión" />
      <ScrollView contentContainerStyle={{ ...tabScreenPadding }}>
        <Text style={{ fontSize: 14, color: ui.colors.textMuted, marginBottom: ui.spacing.md }}>
          Administrá canchas, horarios, promociones y estadísticas de tu club.
        </Text>

        {!clubs?.length ? (
          <EmptyState
            icon={<Ionicons name="business-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin clubs"
            description="Creá un club para empezar a gestionar canchas y horarios."
            action={
              <PrimaryButton
                label="Crear club"
                onPress={() => router.push('/(tabs)/profile' as any)}
              />
            }
          />
        ) : (
          <>
            {clubPicker}
            {quickActions}
            <TabBar active={tab} onChange={setTab} />

            {tab === 'courts' && activeClubId && (
              <ClubCourtsManager clubId={activeClubId} clubName={activeClub?.name} />
            )}

            {tab === 'slots' && (
              <>
                {showForm ? (
                  <AppCard style={{ marginBottom: 16 }}>
                    <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary, marginBottom: 12 }}>
                      {editingSlotId ? 'Editar horario' : 'Publicar horario libre'}
                    </Text>
                    {activeCourts.length > 0 ? (
                      <>
                        <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>Cancha</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {activeCourts.map((court) => (
                              <SelectionChip
                                key={court.id}
                                label={court.name}
                                selected={selectedCourtId === court.id}
                                onPress={() => {
                                  setSelectedCourtId(court.id);
                                  setCourtLabel(court.name);
                                }}
                              />
                            ))}
                          </View>
                        </ScrollView>
                      </>
                    ) : (
                      <InputField label="Cancha" value={courtLabel} onChangeText={setCourtLabel} placeholder="Cancha 1" />
                    )}
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>Día</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {DAYS.map((day, index) => (
                          <SelectionChip
                            key={`${day.offset}-${day.label}`}
                            label={day.label}
                            selected={selectedDay === index}
                            onPress={() => setSelectedDay(index)}
                          />
                        ))}
                      </View>
                    </ScrollView>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>Desde</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {START_TIME_SLOTS.map((minutes) => (
                          <SelectionChip
                            key={minutes}
                            label={formatSlotTime(minutes)}
                            selected={startMinutes === minutes}
                            onPress={() => {
                              setStartMinutes(minutes);
                              setEndMinutes((prev) => snapEndAfterStart(minutes, prev));
                            }}
                          />
                        ))}
                      </View>
                    </ScrollView>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>Hasta</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {END_TIME_SLOTS.filter((m) => m > startMinutes).map((minutes) => (
                          <SelectionChip
                            key={minutes}
                            label={formatSlotTime(minutes)}
                            selected={endMinutes === minutes}
                            onPress={() => setEndMinutes(minutes)}
                          />
                        ))}
                      </View>
                    </ScrollView>
                    <InputField
                      label="Precio por hora"
                      value={slotPrice}
                      onChangeText={(text) => setSlotPrice(text.replace(/[^\d.,]/g, ''))}
                      placeholder={defaultSlotPrice || 'Ej: 12000'}
                      keyboardType="numeric"
                      hint={
                        estimatedSlotTotal != null
                          ? `Total estimado: $${estimatedSlotTotal.toLocaleString('es-AR')}`
                          : defaultSlotPrice
                            ? `Se usa la tarifa base del club (${defaultSlotPrice}/h). Podés cambiarla solo para este turno.`
                            : 'Configurá la tarifa base en Perfil → Datos, o ingresala acá.'
                      }
                    />
                    {!editingSlotId && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 16,
                        }}
                      >
                        <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>Avisar jugadores</Text>
                        <Switch value={notifyPlayers} onValueChange={setNotifyPlayers} />
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <SelectionChip label="Cancelar" selected={false} onPress={resetSlotForm} flex />
                      </View>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          label={editingSlotId ? 'Guardar' : 'Publicar'}
                          fullWidth
                          loading={saveSlot.isPending}
                          onPress={() => saveSlot.mutate()}
                        />
                      </View>
                    </View>
                  </AppCard>
                ) : (
                  <PrimaryButton
                    label="Publicar horario libre"
                    variant="outline"
                    fullWidth
                    onPress={openNewSlotForm}
                    style={{ marginBottom: 16 }}
                    icon={<Ionicons name="add" size={18} color={ui.colors.primary} />}
                  />
                )}

                <SectionHeader
                  title="Calendario de horarios"
                  subtitle={activeClub?.name}
                />
                {isLoading ? (
                  <Text style={{ color: ui.colors.textMuted, marginBottom: 12 }}>Cargando...</Text>
                ) : (
                  <MonthlyCalendar
                    value={calendarDate}
                    onChange={setCalendarDate}
                    minDate={null}
                    markedDates={slotDayKeys}
                  />
                )}

                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 12 }}>
                  {formatShortDate(calendarDate)}
                  {slotsForSelectedDay.length
                    ? ` · ${slotsForSelectedDay.length} horario${slotsForSelectedDay.length === 1 ? '' : 's'}`
                    : ''}
                </Text>

                {!isLoading && slotsForSelectedDay.length === 0 ? (
                  <AppCard>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                      {(slots || []).length
                        ? 'No hay horarios publicados para este día.'
                        : 'Publicá turnos libres para llenar canchas.'}
                    </Text>
                  </AppCard>
                ) : (
                  slotsForSelectedDay.map((slot) => (
                    <AppCard key={slot.id} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Ionicons name="tennisball" size={22} color={ui.colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{slot.court_label}</Text>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                            {formatSlotTime(slot.start_hour, true)} – {formatSlotTime(slot.end_hour, true)}
                            {(() => {
                              const hourly = Number(slot.price_per_hour ?? slot.pricePerHour);
                              if (!Number.isFinite(hourly) || hourly <= 0) return '';
                              const hours = Number(slot.end_hour) - Number(slot.start_hour);
                              const total =
                                hours > 0 ? ` · ≈$${Math.round(hourly * hours).toLocaleString('es-AR')}` : '';
                              return ` · $${Math.round(hourly).toLocaleString('es-AR')}/h${total}`;
                            })()}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <TouchableOpacity onPress={() => openEditSlot(slot)}>
                            <Ionicons name="create-outline" size={20} color={ui.colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteSlot(slot)}>
                            <Ionicons name="trash-outline" size={20} color={ui.colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </AppCard>
                  ))
                )}
              </>
            )}

            {tab === 'promotions' && (
              <>
                <SectionHeader
                  title="Horario valle"
                  subtitle="Si configurás una promo en un valle, las notificaciones automáticas la mencionan; si no, solo avisan cancha libre."
                />
                <AppCard style={{ marginBottom: 16 }}>
                  <InputField label="Nombre" value={promoLabel} onChangeText={setPromoLabel} placeholder="Horario valle" />
                  {promoDayPicker}
                  {promoTimeRange}
                  <PrimaryButton
                    label="Guardar horario valle"
                    size="sm"
                    fullWidth
                    loading={createValleyPromotion.isPending}
                    onPress={() => createValleyPromotion.mutate()}
                  />
                </AppCard>

                {activePromotions.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    {activePromotions.map((p) => (
                      <AppCard key={p.id} padding="sm" style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>{p.label}</Text>
                            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                              {p.day_of_week != null ? WEEKDAYS[p.day_of_week] : 'Todos los días'} ·{' '}
                              {formatSlotTime(p.start_hour, true)}–{formatSlotTime(p.end_hour, true)}
                              {p.bonus_points > 0 ? ` · +${p.bonus_points} pts` : ''}
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => handleDeletePromotion(p)}>
                            <Ionicons name="trash-outline" size={20} color={ui.colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </AppCard>
                    ))}
                  </View>
                )}
              </>
            )}

            {tab === 'stats' && (
              <>
                <SectionHeader title="Estadísticas" subtitle={`${activeClub?.name || ''} · últimos 30 días`} />

                <AppCard style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, fontSize: 15 }}>
                        Smart Fill
                      </Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4, lineHeight: 17 }}>
                        Si un turno valle sigue vacío N horas antes, avisamos jugadores o publicamos un partido abierto.
                      </Text>
                    </View>
                    <Switch
                      value={Boolean(
                        dashboard?.autoFillGapsEnabled ??
                          clubDetail?.autoFillGapsEnabled ??
                          clubDetail?.auto_fill_gaps_enabled,
                      )}
                      onValueChange={(enabled) => setAutoFillGaps.mutate(enabled)}
                      disabled={!activeClubId || setAutoFillGaps.isPending || loadingDashboard}
                    />
                  </View>

                  <View style={{ marginTop: 14, gap: 12 }}>
                    <InputField
                      label="Horas antes del turno"
                      value={hoursBefore}
                      onChangeText={setHoursBefore}
                      keyboardType="number-pad"
                      hint="Entre 1 y 72 horas"
                    />
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={{ flex: 1, fontWeight: '600', color: ui.colors.textPrimary, marginRight: 12 }}>
                        Auto-publicar partido abierto
                      </Text>
                      <Switch value={autoCreateMatch} onValueChange={setAutoCreateMatch} />
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={{ flex: 1, fontWeight: '600', color: ui.colors.textPrimary, marginRight: 12 }}>
                        Notificar candidatos
                      </Text>
                      <Switch value={notifyEnabled} onValueChange={setNotifyEnabled} />
                    </View>
                    <PrimaryButton
                      label="Guardar reglas"
                      fullWidth
                      size="sm"
                      loading={saveSmartFillRules.isPending}
                      onPress={() => saveSmartFillRules.mutate()}
                    />
                  </View>
                </AppCard>

                {loadingDashboard ? (
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando estadísticas...</Text>
                ) : dashboard ? (
                  <>
                    <AppCard style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: 'rgba(20,184,166,0.12)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="people" size={22} color={ui.colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>Jugadores únicos</Text>
                          <Text style={{ fontSize: 28, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 2 }}>
                            {dashboard.uniquePlayers30d}
                          </Text>
                        </View>
                      </View>
                    </AppCard>

                    <AppCard style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: 'rgba(245,158,11,0.12)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="pulse" size={22} color={ui.colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>Ocupación</Text>
                          <Text style={{ fontSize: 28, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 2 }}>
                            {occupancyRate}%
                          </Text>
                          <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>
                            Rotación de jugadores: {dashboard.rotationIndex}%
                          </Text>
                        </View>
                      </View>
                    </AppCard>

                    <AppCard style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: 'rgba(59,130,246,0.12)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="calendar" size={22} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>Reservas</Text>
                          <Text style={{ fontSize: 28, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 2 }}>
                            {dashboard.activeMatches}
                          </Text>
                          <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>
                            {dashboard.slotsThisWeek} horarios esta semana · {dashboard.openSlots} abiertos ahora
                          </Text>
                        </View>
                      </View>
                    </AppCard>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <AppCard style={{ width: '48%', marginBottom: 0 }} padding="sm">
                        <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Partidos jugados</Text>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 4 }}>
                          {dashboard.matchesFinished30d}
                        </Text>
                      </AppCard>
                      <AppCard style={{ width: '48%', marginBottom: 0 }} padding="sm">
                        <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Horarios semana</Text>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 4 }}>
                          {dashboard.slotsThisWeek}
                        </Text>
                      </AppCard>
                    </View>
                  </>
                ) : (
                  <AppCard>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                      Todavía no hay datos suficientes para mostrar estadísticas.
                    </Text>
                  </AppCard>
                )}

                <SectionHeader
                  title="Horarios valle detectados"
                  subtitle={
                    demandInsights
                      ? `Últimos ${demandInsights.historyDays} días · ocupación < ${demandInsights.occupancyThresholdPct}%`
                      : 'Basado en ocupación histórica'
                  }
                />
                {loadingInsights ? (
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13, marginBottom: 16 }}>
                    Analizando demanda...
                  </Text>
                ) : demandInsights?.valleys?.length ? (
                  <View style={{ marginBottom: 20 }}>
                    {demandInsights.valleys.map((v) => (
                      <AppCard
                        key={`${v.dayOfWeek}-${v.hourBucket}`}
                        padding="sm"
                        style={{ marginBottom: 8 }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
                              {WEEKDAYS[v.dayOfWeek]} · {formatSlotTime(v.hourBucket * 60)}–
                              {formatSlotTime((v.hourBucket + 1) * 60)}
                            </Text>
                            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                              Ocupación {v.occupancyPct}% · {v.bookedSlots}/{v.totalSlots} reservados
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>Candidatos</Text>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: ui.colors.primary }}>
                              {v.candidateCount}
                            </Text>
                          </View>
                        </View>
                      </AppCard>
                    ))}
                  </View>
                ) : (
                  <AppCard style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 13, color: ui.colors.textMuted, lineHeight: 18 }}>
                      Todavía no hay suficientes datos históricos para detectar franjas valle (mín. 5 turnos
                      por franja en 60 días).
                    </Text>
                  </AppCard>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
