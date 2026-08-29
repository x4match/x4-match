import { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { canOrganizeEvents } from '@/lib/roles';
import {
  fetchMyTournaments,
  type OrganizerTournamentRow,
} from '@/lib/tournament/api';
import {
  formatTournamentCategory,
  formatLabel,
} from '@/lib/tournament/types';
import { formatShortDate } from '@/lib/format';
import { ui } from '@/theme/tokens';
import { getTabScreenPaddingBottom, tabScreenPadding } from '@/lib/layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Screen,
  AppHeader,
  AppCard,
  SectionHeader,
  EmptyState,
  PrimaryButton,
  StatusPill,
  SegmentedControl,
} from '@/components/padely';

type HistoryFilter = 'active' | 'finished' | 'all';

function matchesFilter(t: OrganizerTournamentRow, filter: HistoryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'finished') return t.status === 'FINISHED' || t.status === 'CANCELLED';
  return t.status === 'DRAFT' || t.status === 'OPEN_REGISTRATION' || t.status === 'IN_PROGRESS';
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const canManage = canOrganizeEvents(user?.role);
  const [filter, setFilter] = useState<HistoryFilter>('active');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['organizer-tournaments-mine'],
    queryFn: () => fetchMyTournaments('ALL'),
    enabled: canManage,
  });

  const tournaments = data || [];
  const filtered = useMemo(
    () => tournaments.filter((t) => matchesFilter(t, filter)),
    [tournaments, filter],
  );

  const counts = useMemo(() => {
    const active = tournaments.filter((t) => matchesFilter(t, 'active')).length;
    const finished = tournaments.filter((t) => matchesFilter(t, 'finished')).length;
    return { active, finished, all: tournaments.length };
  }, [tournaments]);

  if (!canManage) {
    return (
      <Screen>
        <AppHeader title="Historial" />
        <EmptyState
          icon={<Ionicons name="lock-closed-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
          description="Creá torneos desde Perfil → Mis torneos y circuitos."
          action={<PrimaryButton label="Volver" onPress={() => router.replace('/(tabs)/home')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Historial" />
      <ScrollView
        contentContainerStyle={{
          ...tabScreenPadding,
          paddingBottom: getTabScreenPaddingBottom(insets.bottom),
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching || isLoading} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >
        <AppCard style={{ marginBottom: ui.spacing.lg, backgroundColor: ui.colors.surfaceAlt }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: ui.colors.textPrimary, marginBottom: 6 }}>
            Microcosmos de torneos
          </Text>
          <Text style={{ fontSize: 13, color: ui.colors.textSecondary, lineHeight: 18 }}>
            Acá vivís tus torneos: equipos, fixture, resultados y, más adelante, ascensos internos (sin cambiar la
            categoría global del jugador en la app).
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <View style={{ flex: 1, backgroundColor: ui.colors.surface, borderRadius: ui.radius.md, padding: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.primary }}>{counts.active}</Text>
              <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>En curso</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: ui.colors.surface, borderRadius: ui.radius.md, padding: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.accent }}>{counts.finished}</Text>
              <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>Cerrados</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: ui.colors.surface, borderRadius: ui.radius.md, padding: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.textPrimary }}>{counts.all}</Text>
              <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>Total</Text>
            </View>
          </View>
        </AppCard>

        <SegmentedControl
          options={[
            { value: 'active', label: 'En curso' },
            { value: 'finished', label: 'Cerrados' },
            { value: 'all', label: 'Todos' },
          ]}
          value={filter}
          onChange={setFilter}
        />

        <View style={{ height: 16 }} />

        <SectionHeader
          title={filter === 'finished' ? 'Torneos cerrados' : filter === 'active' ? 'Torneos activos' : 'Todos tus torneos'}
          subtitle={`${filtered.length} torneo${filtered.length === 1 ? '' : 's'}`}
          dark
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="trophy-outline" size={32} color={ui.colors.textMuted} />}
            title={filter === 'finished' ? 'Sin historial todavía' : 'Sin torneos en esta vista'}
            description={
              filter === 'finished'
                ? 'Cuando finalices un torneo, va a aparecer acá.'
                : 'Creá un torneo desde Gestión para empezar tu microcosmos.'
            }
            action={
              <PrimaryButton
                label="Ir a Gestión"
                onPress={() => router.push('/(tabs)/organizer' as any)}
                size="sm"
              />
            }
          />
        ) : (
          filtered.map((t) => {
            const matchesTotal = t.matches_count ?? 0;
            const matchesDone = t.matches_finished_count ?? 0;
            return (
              <AppCard
                key={t.id}
                onPress={() => router.push(`/history/${t.id}` as any)}
                style={{ marginBottom: 10 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: ui.colors.warningSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="trophy" size={24} color={ui.colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={{ fontWeight: '800', color: ui.colors.textPrimary, flex: 1 }} numberOfLines={1}>
                        {t.name}
                      </Text>
                      <StatusPill status={t.status} />
                    </View>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                      {formatTournamentCategory(t.category, t.gender)}
                      {' · '}
                      {formatLabel(t.format)}
                    </Text>
                    <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>
                      {t.start_date ? formatShortDate(t.start_date) : 'Sin fecha'}
                      {' · '}
                      {t.approved_count ?? 0} aprobadas
                      {(t.pending_count ?? 0) > 0 ? ` · ${t.pending_count} pendientes` : ''}
                      {matchesTotal > 0 ? ` · ${matchesDone}/${matchesTotal} partidos` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} style={{ marginTop: 14 }} />
                </View>
              </AppCard>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
