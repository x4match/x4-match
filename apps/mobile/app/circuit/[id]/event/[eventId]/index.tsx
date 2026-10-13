import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasCircuitPermission, mapViewerAccess } from '@/lib/circuits/staff';
import { describeBracketResult, type EnsureBracketsResult } from '@/lib/tournament/brackets';
import { formatShortDate } from '@/lib/format';
import { registrationCountdown } from '@/lib/tournament/types';
import type { CircuitSponsor } from '@/lib/circuits/organizer';
import { SponsorStrip } from '@/components/circuit/CircuitOrganizerSections';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  SectionHeader,
  PrimaryButton,
  StatusPill,
  EmptyState,
  SegmentedControl,
  withCircuitsEnabled,
} from '@/components/x4match';

type LiveTab = 'grid' | 'mine' | 'categories';

type ScheduleMatch = {
  id: string;
  tournamentId: string;
  tournamentName?: string;
  categoryLabel?: string | null;
  roundLabel?: string | null;
  clubId?: string | null;
  clubName?: string | null;
  clubCity?: string | null;
  courtLabel?: string | null;
  teamAName?: string | null;
  teamBName?: string | null;
  status: string;
  scheduledAt?: string | null;
  score?: unknown;
};

export default withCircuitsEnabled(CircuitEventLiveScreen);

function CircuitEventLiveScreen() {
  const { id: circuitId, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: access } = useQuery({
    queryKey: ['circuit-access', circuitId, user?.id],
    queryFn: async () => mapViewerAccess((await api.get(`/circuits/${circuitId}/me`)).data),
    enabled: !!circuitId && !!user?.id,
  });
  const canManage = hasCircuitPermission(access, 'circuit.schedule');
  const canSeeDraft = hasCircuitPermission(access, 'circuit.view_internal');

  const [tab, setTab] = useState<LiveTab>('grid');
  const [clubFilter, setClubFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const { data: event, refetch: refetchEvent, isRefetching } = useQuery({
    queryKey: ['circuit-event', circuitId, eventId],
    queryFn: async () => {
      const res = await api.get(`/circuits/${circuitId}/events/${eventId}`);
      return res.data as {
        id: string;
        name: string;
        start_date: string;
        end_date?: string;
        schedule_status: string;
        venues: Array<{ club_id: string; club_name: string; courts_count: number; is_primary: boolean }>;
        stages: Array<{
          id: string;
          tournament_id?: string;
          category_label?: string;
          category_gender?: string;
          matches_count?: number;
          matches_finished?: number;
          tournament_status?: string;
          max_teams?: number | null;
          registration_closes_at?: string | null;
          registration_closed_at?: string | null;
          teams_approved?: number;
          teams_pending?: number;
          groups_count?: number;
          champion_name?: string | null;
        }>;
        sponsors?: CircuitSponsor[];
        matches_by_day?: Array<{ day: string; total: number; finished: number }>;
        totals?: { teams: number; matches: number; finished: number };
      };
    },
    enabled: !!circuitId && !!eventId,
    refetchInterval: 45_000,
  });

  const includeDraft = canSeeDraft && event?.schedule_status === 'DRAFT';

  const { data: schedule, refetch: refetchSchedule } = useQuery({
    queryKey: ['circuit-event-schedule', circuitId, eventId, includeDraft, clubFilter, dateFilter],
    queryFn: async () => {
      const res = await api.get(`/circuits/${circuitId}/events/${eventId}/schedule`, {
        params: {
          includeDraft: includeDraft ? '1' : undefined,
          clubId: clubFilter || undefined,
          date: dateFilter || undefined,
        },
      });
      return res.data as {
        scheduleStatus: string;
        matches: ScheduleMatch[];
        progress: { total: number; finished: number };
      };
    },
    enabled: !!circuitId && !!eventId && !!event,
    refetchInterval: 30_000,
  });

  const { data: myMatches } = useQuery({
    queryKey: ['circuit-event-my-matches', circuitId, eventId],
    queryFn: async () => {
      const res = await api.get(`/circuits/${circuitId}/events/${eventId}/my-matches`);
      return res.data as { matches: ScheduleMatch[] };
    },
    enabled: !!circuitId && !!eventId && !!user?.id && tab === 'mine',
    refetchInterval: 30_000,
  });

  const refresh = useCallback(() => {
    void refetchEvent();
    void refetchSchedule();
    queryClient.invalidateQueries({ queryKey: ['circuit-event-my-matches', circuitId, eventId] });
  }, [refetchEvent, refetchSchedule, queryClient, circuitId, eventId]);

  const ensureBrackets = useMutation({
    mutationFn: async (opts: { regenerate?: boolean }) => {
      const res = await api.post(`/circuits/${circuitId}/events/${eventId}/brackets`, {
        regenerate: !!opts.regenerate,
      });
      return res.data as { results: EnsureBracketsResult[] };
    },
    onSuccess: (data, vars) => {
      const results = data?.results ?? [];
      const lines = results.map((r) => `• ${r.categoryLabel || 'Categoría'}: ${describeBracketResult(r)}`);
      const canRegenerate =
        !vars.regenerate && results.some((r) => r.skipped && /ya tiene fixture/i.test(r.skipped));
      Alert.alert(
        'Cuadros por categoría',
        lines.join('\n') || 'No hay categorías con torneo publicado.',
        canRegenerate
          ? [
              { text: 'Listo', style: 'cancel' },
              {
                text: 'Rearmar sin resultados',
                style: 'destructive',
                onPress: () => ensureBrackets.mutate({ regenerate: true }),
              },
            ]
          : undefined,
      );
      refresh();
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message || 'No se pudieron generar los cuadros'),
  });

  const previewSchedule = useMutation({
    mutationFn: () =>
      api.post(`/circuits/${circuitId}/events/${eventId}/schedule/preview`, {
        strictAvailability: false,
      }),
    onSuccess: (res) => {
      const m = res.data?.metrics;
      Alert.alert(
        'Preview de horarios',
        `Asignados ${m?.assigned ?? 0} de ${m?.totalMatches ?? 0}. Sin slot: ${m?.unassigned ?? 0}. Sedes usadas: ${m?.venuesUsed ?? 0}.`,
        [
          { text: 'Cerrar', style: 'cancel' },
          {
            text: 'Guardar borrador',
            onPress: () => applySchedule.mutate({ publish: false }),
          },
          {
            text: 'Publicar en vivo',
            onPress: () => applySchedule.mutate({ publish: true }),
          },
        ],
      );
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message || 'No se pudo armar el preview'),
  });

  const applySchedule = useMutation({
    mutationFn: (opts: { publish: boolean }) =>
      api.post(`/circuits/${circuitId}/events/${eventId}/schedule/apply`, {
        publish: opts.publish,
        resetExisting: true,
        strictAvailability: false,
      }),
    onSuccess: (_res, vars) => {
      Alert.alert(
        vars.publish ? 'Horarios publicados' : 'Borrador guardado',
        vars.publish
          ? 'Los jugadores ya pueden ver la grilla en vivo.'
          : 'Solo vos ves el borrador hasta publicarlo.',
      );
      refresh();
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message || 'No se pudo aplicar'),
  });

  const publishOnly = useMutation({
    mutationFn: () => api.post(`/circuits/${circuitId}/events/${eventId}/schedule/publish`),
    onSuccess: () => {
      Alert.alert('Publicado', 'La grilla quedó visible para todos.');
      refresh();
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message || 'No se pudo publicar'),
  });

  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const m of schedule?.matches || []) {
      if (!m.scheduledAt) continue;
      set.add(m.scheduledAt.slice(0, 10));
    }
    return [...set].sort();
  }, [schedule?.matches]);

  const list =
    tab === 'mine' ? myMatches?.matches || [] : schedule?.matches || [];

  return (
    <Screen>
      <StackHeader
        title={event?.name || 'Etapa'}
        rightAction={
          canManage ? (
            <Pressable
              onPress={() => router.push(`/circuit/${circuitId}/event/${eventId}/manage` as any)}
              hitSlop={8}
            >
              <Ionicons name="settings-outline" size={22} color={ui.colors.textPrimary} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refresh} tintColor={ui.colors.primary} />
        }
      >
        <AppCard style={{ backgroundColor: ui.colors.surfaceAlt }}>
          <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
            {event?.start_date ? formatShortDate(event.start_date) : '—'}
            {event?.end_date ? ` → ${formatShortDate(event.end_date)}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <StatusPill status={event?.schedule_status === 'PUBLISHED' ? 'ACTIVE' : 'DRAFT'} />
            <Text style={{ color: ui.colors.textMuted, fontSize: 12, alignSelf: 'center' }}>
              {schedule?.progress
                ? `${schedule.progress.finished}/${schedule.progress.total} partidos`
                : `${event?.venues?.length ?? 0} sedes · ${event?.stages?.length ?? 0} categorías`}
              {event?.totals?.teams ? ` · ${event.totals.teams} parejas` : ''}
            </Text>
          </View>
          {event?.matches_by_day?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {event.matches_by_day.map((d) => (
                <View
                  key={d.day}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: ui.radius.md,
                    backgroundColor: ui.colors.cardMuted,
                  }}
                >
                  <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>
                    {new Date(`${d.day}T12:00:00`).toLocaleDateString('es-AR', {
                      weekday: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: ui.colors.textPrimary }}>
                    {d.finished}/{d.total}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </AppCard>

        {canManage ? (
          <View style={{ gap: 8 }}>
            <PrimaryButton
              label="Generar cuadros por categoría"
              variant="outline"
              fullWidth
              loading={ensureBrackets.isPending}
              onPress={() =>
                Alert.alert(
                  'Generar cuadros',
                  'Se arman zonas y cuadro de cada categoría según su formato, sembrando por el ranking del circuito.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Generar', onPress: () => ensureBrackets.mutate({}) },
                  ],
                )
              }
            />
            <PrimaryButton
              label="Armar horarios (multi-sede)"
              fullWidth
              loading={previewSchedule.isPending || applySchedule.isPending}
              onPress={() => previewSchedule.mutate()}
            />
            {event?.schedule_status === 'DRAFT' ? (
              <PrimaryButton
                label="Publicar grilla en vivo"
                variant="ghost"
                fullWidth
                loading={publishOnly.isPending}
                onPress={() => publishOnly.mutate()}
              />
            ) : null}
          </View>
        ) : null}

        <SegmentedControl
          options={[
            { value: 'grid', label: 'Grilla' },
            { value: 'mine', label: 'Mis partidos' },
            { value: 'categories', label: 'Categorías' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab !== 'categories' ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <FilterChip
                label="Todas las sedes"
                active={!clubFilter}
                onPress={() => setClubFilter(null)}
              />
              {(event?.venues || []).map((v) => (
                <FilterChip
                  key={v.club_id}
                  label={v.club_name}
                  active={clubFilter === v.club_id}
                  onPress={() => setClubFilter(clubFilter === v.club_id ? null : v.club_id)}
                />
              ))}
            </ScrollView>
            {dates.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <FilterChip label="Todas las fechas" active={!dateFilter} onPress={() => setDateFilter(null)} />
                {dates.map((d) => (
                  <FilterChip
                    key={d}
                    label={formatShortDate(d)}
                    active={dateFilter === d}
                    onPress={() => setDateFilter(dateFilter === d ? null : d)}
                  />
                ))}
              </ScrollView>
            ) : null}

            {list.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="calendar-outline" size={32} color={ui.colors.textMuted} />}
                title={
                  event?.schedule_status !== 'PUBLISHED' && !includeDraft
                    ? 'Horarios todavía no publicados'
                    : 'Sin partidos en este filtro'
                }
                description={
                  event?.schedule_status !== 'PUBLISHED' && !includeDraft
                    ? 'Cuando el organizador publique la grilla, la vas a ver acá en vivo.'
                    : 'Probá otra sede o fecha.'
                }
              />
            ) : (
              list.map((m) => (
                <AppCard
                  key={m.id}
                  style={{ marginBottom: 8 }}
                  onPress={() =>
                    m.tournamentId
                      ? router.push(`/tournament/${m.tournamentId}` as any)
                      : undefined
                  }
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ color: ui.colors.textMuted, fontSize: 11, flex: 1 }} numberOfLines={1}>
                      {[m.categoryLabel, m.roundLabel || m.tournamentName].filter(Boolean).join(' · ')}
                    </Text>
                    <StatusPill status={m.status} />
                  </View>
                  <Text style={{ color: ui.colors.textPrimary, fontWeight: '700', marginTop: 6 }}>
                    {m.teamAName || '—'} vs {m.teamBName || '—'}
                  </Text>
                  <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    {[m.clubName, m.courtLabel, m.scheduledAt ? formatShortDate(m.scheduledAt) : null]
                      .filter(Boolean)
                      .join(' · ')}
                    {m.scheduledAt
                      ? ` · ${new Date(m.scheduledAt).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : ''}
                  </Text>
                </AppCard>
              ))
            )}
          </>
        ) : (
          <>
            <SectionHeader title="Categorías de la etapa" dark />
            {(event?.stages || []).map((s) => {
              const total = s.matches_count ?? 0;
              const finished = s.matches_finished ?? 0;
              const countdown =
                s.tournament_status === 'OPEN_REGISTRATION'
                  ? registrationCountdown({
                      registration_closes_at: s.registration_closes_at,
                      registration_closed_at: s.registration_closed_at,
                    })
                  : null;
              return (
                <AppCard
                  key={s.id}
                  style={{ marginBottom: 8 }}
                  onPress={() =>
                    s.tournament_id ? router.push(`/tournament/${s.tournament_id}` as any) : undefined
                  }
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                        {[s.category_label, s.category_gender].filter(Boolean).join(' ')}
                      </Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                        {s.teams_approved ?? 0}
                        {s.max_teams ? `/${s.max_teams}` : ''} parejas
                        {canManage && s.teams_pending ? ` · ${s.teams_pending} por aprobar` : ''}
                        {s.groups_count ? ` · ${s.groups_count} zonas` : ''}
                        {total ? ` · Partidos ${finished}/${total}` : ''}
                      </Text>
                      {countdown ? (
                        <Text
                          style={{
                            fontSize: 12,
                            marginTop: 4,
                            fontWeight: '700',
                            color: countdown.urgent ? ui.colors.warning : ui.colors.primary,
                          }}
                        >
                          {countdown.label}
                        </Text>
                      ) : null}
                      {s.champion_name ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Ionicons name="trophy" size={13} color={ui.colors.warning} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: ui.colors.textPrimary }}>
                            {s.champion_name}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {s.tournament_status ? <StatusPill status={s.tournament_status} /> : null}
                  </View>
                  {total ? (
                    <View
                      style={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: ui.colors.cardMuted,
                        marginTop: 10,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.round((finished / total) * 100)}%`,
                          height: '100%',
                          backgroundColor: ui.colors.primary,
                        }}
                      />
                    </View>
                  ) : null}
                  {canManage && s.tournament_id ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <PrimaryButton
                        label="Zonas"
                        size="sm"
                        variant="outline"
                        onPress={() => router.push(`/tournament/${s.tournament_id}/zones` as any)}
                      />
                      <PrimaryButton
                        label="Resultados"
                        size="sm"
                        variant="outline"
                        onPress={() => router.push(`/tournament/${s.tournament_id}/results` as any)}
                      />
                      <PrimaryButton
                        label="Gestionar"
                        size="sm"
                        variant="ghost"
                        onPress={() => router.push(`/tournament/${s.tournament_id}/manage` as any)}
                      />
                    </View>
                  ) : null}
                </AppCard>
              );
            })}
          </>
        )}

        {event?.sponsors?.length ? (
          <>
            <SectionHeader title="Acompañan" dark />
            <SponsorStrip sponsors={event.sponsors} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: ui.radius.pill,
        backgroundColor: active ? ui.colors.primary : ui.colors.surface1,
        borderWidth: 1,
        borderColor: active ? ui.colors.primary : ui.colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: active ? ui.colors.onPrimary : ui.colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
