import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { isClub, isPlayer } from '@/lib/roles';
import { api } from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import { formatCurrency } from '@/lib/currency';
import {
  fetchClubTournamentValidations,
  approveClubTournamentValidation,
  rejectClubTournamentValidation,
} from '@/lib/tournament/api';
import {
  FIXED_CATEGORY_OPTIONS,
  formatTournamentCategory,
  tournamentOrganizerLabel,
} from '@/lib/tournament/types';
import { invalidateRedeemablePoints, useRedeemablePoints } from '@/lib/shop/redeemable-points';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  PrimaryButton,
  SectionHeader,
  Avatar,
  SelectionChip,
  SearchableSelect,
} from '@/components/x4match';
import { ClubCommentsSection } from '@/components/club/ClubCommentsSection';
import { ClubMuteButton } from '@/components/club/ClubMuteButton';
import { ClubHeroHeader } from '@/components/club/ClubHeroHeader';
import { ClubLocationMap } from '@/components/club/ClubLocationMap';
import { ClubShopCatalog } from '@/components/shop/ClubShopCatalog';

type Tab = 'info' | 'shop' | 'ranking' | 'rewards';

interface LeaderboardEntry {
  user_id: string;
  name: string;
  nickname?: string;
  photo_url?: string;
  points: number;
  matches_at_club: number;
  rank: string | number;
  level_category?: string | null;
}

const ALL_CATEGORIES = '__all__';
const TOP_CATEGORY_OPTIONS = [
  { value: ALL_CATEGORIES, label: 'Todas las categorías' },
  ...FIXED_CATEGORY_OPTIONS.map((cat) => ({ value: cat, label: cat })),
];

type TopGender = 'male' | 'female';
const ALL_GENDERS = '__all__';
const TOP_GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: ALL_GENDERS, label: 'Todos' },
  { value: 'male', label: 'Caballeros' },
  { value: 'female', label: 'Damas' },
];

interface RewardItem {
  id: string;
  title: string;
  description?: string;
  points_required: number;
  pointsRequired?: number;
  reward_type: string;
  stock?: number | null;
  maxPerUser?: number | null;
  max_per_user?: number | null;
}

interface MyRedemption {
  id: string;
  status: string;
  pointsSpent?: number;
  points_spent?: number;
  redemptionCode?: string;
  redemption_code?: string;
  rewardTitle?: string;
  reward_title?: string;
  createdAt?: string;
  created_at?: string;
}

interface CourtSlot {
  id: string;
  court_label: string;
  slot_date: string;
  start_hour: number;
  end_hour: number;
  status: string;
  bonus_points?: number;
  price_per_hour?: number | null;
  pricePerHour?: number | null;
}

function formatSlotTime(hour: number) {
  const minutes = Math.round(Number(hour) * 60);
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function todayDateKey() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'shop', label: 'Tienda' },
    { key: 'ranking', label: 'Ranking' },
    { key: 'rewards', label: 'Premios' },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
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

const CLUB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveClubId(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value === 'undefined' || value === 'null' || !CLUB_ID_RE.test(value)) {
    return null;
  }
  return value;
}

function TopFilterSelect({
  icon,
  accessibilityLabel,
  placeholder,
  searchPlaceholder,
  value,
  options,
  active,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  placeholder: string;
  searchPlaceholder: string;
  value: string;
  options: { value: string; label: string }[];
  active: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <SearchableSelect
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      value={value}
      options={options}
      onChange={onChange}
      renderTrigger={({ open, selected, placeholder: triggerPlaceholder }) => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={open}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: active ? ui.colors.primary : 'rgba(255,255,255,0.08)',
            paddingHorizontal: 12,
            minHeight: 48,
          }}
        >
          <Ionicons name={icon} size={18} color={active ? ui.colors.primary : ui.colors.textMuted} />
          <Text
            style={{
              flex: 1,
              fontSize: 14,
              color: active ? ui.colors.textPrimary : ui.colors.textMuted,
            }}
            numberOfLines={1}
          >
            {selected?.label || triggerPlaceholder}
          </Text>
          <Ionicons name="chevron-down" size={16} color={ui.colors.textMuted} />
        </TouchableOpacity>
      )}
    />
  );
}

export default function ClubDetailScreen() {
  const { id: rawId, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const id = resolveClubId(rawId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClubAccount = isClub(user?.role);
  const isPlayerAccount = isPlayer(user?.role);
  const [tab, setTab] = useState<Tab>(
    initialTab === 'shop' || initialTab === 'ranking' || initialTab === 'rewards' ? initialTab : 'info',
  );
  const { data: club, isLoading, refetch } = useQuery({
    queryKey: ['club', id],
    queryFn: async () => {
      const res = await api.get(`/clubs/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: leaderboard, refetch: refetchLb } = useQuery({
    queryKey: ['club-leaderboard', id],
    queryFn: async () => {
      const res = await api.get(`/clubs/${id}/leaderboard`);
      return res.data as LeaderboardEntry[];
    },
    enabled: !!id,
  });

  const [topCategory, setTopCategory] = useState<string | null>(null);
  const [topGender, setTopGender] = useState<TopGender | null>(null);
  const topFiltered = Boolean(topCategory || topGender);
  const {
    data: categoryLeaderboard,
    isFetching: loadingCategoryLb,
    refetch: refetchCategoryLb,
  } = useQuery({
    queryKey: ['club-leaderboard', id, topCategory, topGender],
    queryFn: async () => {
      const res = await api.get(`/clubs/${id}/leaderboard`, {
        params: { category: topCategory ?? undefined, gender: topGender ?? undefined },
      });
      return res.data as LeaderboardEntry[];
    },
    enabled: !!id && topFiltered,
  });
  const topEntries = topFiltered ? categoryLeaderboard : leaderboard;
  const topFilterLabel = [
    topCategory,
    topGender ? TOP_GENDER_OPTIONS.find((o) => o.value === topGender)?.label : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const { data: clubDashboard } = useQuery({
    queryKey: ['club-dashboard-public', id],
    queryFn: async () => {
      const res = await api.get(`/clubs/${id}/dashboard`);
      return res.data as {
        uniquePlayers30d?: number;
        matchesFinished30d?: number;
      };
    },
    enabled: !!id,
    retry: false,
  });

  const clubStats = useMemo(() => {
    if (clubDashboard?.uniquePlayers30d != null) {
      return {
        players: clubDashboard.uniquePlayers30d,
        matches: clubDashboard.matchesFinished30d ?? 0,
        periodLabel: '30 días',
      };
    }
    const entries = leaderboard || [];
    return {
      players: entries.length,
      matches: entries.reduce((sum, entry) => sum + (entry.matches_at_club || 0), 0),
      periodLabel: 'total',
    };
  }, [clubDashboard, leaderboard]);

  const { data: rewards, refetch: refetchRewards } = useQuery({
    queryKey: ['club-rewards-catalog', id],
    queryFn: async () => {
      const res = await api.get(`/clubs/${id}/rewards-catalog`);
      return res.data as RewardItem[];
    },
    enabled: !!id && tab === 'rewards',
  });

  const { data: myRedemptions, refetch: refetchMyRedemptions } = useQuery({
    queryKey: ['club-my-redemptions', id],
    queryFn: async () => {
      const res = await api.get(`/clubs/${id}/my-redemptions`);
      return res.data as MyRedemption[];
    },
    enabled: !!id && tab === 'rewards' && isPlayerAccount,
  });

  const { data: myPoints, refetch: refetchPoints } = useRedeemablePoints(
    typeof id === 'string' ? id : undefined,
    !!user && isPlayerAccount,
  );

  const { data: courtSlots, refetch: refetchSlots, isLoading: loadingSlots } = useQuery({
    queryKey: ['club-public-court-slots', id],
    queryFn: async () => {
      const res = await api.get(`/clubs/${id}/court-slots`);
      return res.data as CourtSlot[];
    },
    enabled: !!id,
  });

  const openCourtSlots = useMemo(() => {
    const today = todayDateKey();
    return (courtSlots || [])
      .filter((slot) => slot.status === 'OPEN' && String(slot.slot_date).slice(0, 10) >= today)
      .sort((a, b) => {
        const dateCmp = String(a.slot_date).localeCompare(String(b.slot_date));
        if (dateCmp !== 0) return dateCmp;
        return Number(a.start_hour) - Number(b.start_hour);
      });
  }, [courtSlots]);

  const slotsByDay = useMemo(() => {
    const groups: { date: string; slots: CourtSlot[] }[] = [];
    for (const slot of openCourtSlots) {
      const date = String(slot.slot_date).slice(0, 10);
      const last = groups[groups.length - 1];
      if (last && last.date === date) {
        last.slots.push(slot);
      } else {
        groups.push({ date, slots: [slot] });
      }
    }
    return groups;
  }, [openCourtSlots]);

  const {
    data: pendingTournaments,
    refetch: refetchTournamentValidations,
  } = useQuery({
    queryKey: ['club-tournament-validations', id],
    queryFn: () => fetchClubTournamentValidations(id!),
    enabled: !!id && isClubAccount,
    retry: false,
  });

  const approveTournamentMutation = useMutation({
    mutationFn: (tournamentId: string) => approveClubTournamentValidation(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-tournament-validations', id] });
      queryClient.invalidateQueries({ queryKey: ['tournaments-list'] });
      Alert.alert('Torneo validado', 'Ya aparece en el listado público.');
    },
    onError: (err: any) =>
      Alert.alert('Error', err.response?.data?.message || 'No se pudo validar el torneo'),
  });

  const rejectTournamentMutation = useMutation({
    mutationFn: (tournamentId: string) => rejectClubTournamentValidation(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-tournament-validations', id] });
      Alert.alert('Torneo rechazado', 'El organizador verá el rechazo en su panel.');
    },
    onError: (err: any) =>
      Alert.alert('Error', err.response?.data?.message || 'No se pudo rechazar el torneo'),
  });

  const redeemMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      const res = await api.post(`/clubs/${id}/rewards/${rewardId}/redeem`);
      return res.data as {
        rewardTitle: string;
        remainingPoints: number;
        redemptionCode?: string;
        status?: string;
      };
    },
    onSuccess: (data) => {
      invalidateRedeemablePoints(queryClient);
      queryClient.invalidateQueries({ queryKey: ['club-my-redemptions', id] });
      queryClient.invalidateQueries({ queryKey: ['club-rewards-catalog', id] });
      Alert.alert(
        '¡Canje exitoso!',
        `${data.rewardTitle}\nCódigo: ${data.redemptionCode || '—'}\nPresentate en recepción.\nTe quedan ${data.remainingPoints} puntos.`,
      );
    },
    onError: (err: any) => {
      Alert.alert('No se pudo canjear', err.response?.data?.message || 'Error');
    },
  });

  const handleRedeem = (reward: RewardItem) => {
    const pts = myPoints?.points ?? 0;
    const required = reward.pointsRequired ?? reward.points_required;
    if (pts < required) {
      Alert.alert('Puntos globales insuficientes', `Necesitás ${required} pts. Tenés ${pts}.`);
      return;
    }
    Alert.alert('Canjear premio', `¿Canjear "${reward.title}" por ${required} puntos globales?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Canjear', onPress: () => redeemMutation.mutate(reward.id) },
    ]);
  };

  const onRefresh = () => {
    refetch();
    refetchLb();
    if (topFiltered) refetchCategoryLb();
    refetchRewards();
    refetchMyRedemptions();
    refetchPoints();
    refetchSlots();
    refetchTournamentValidations();
    queryClient.invalidateQueries({ queryKey: ['club-comments', id] });
  };

  if (!id) {
    return (
      <Screen>
        <StackHeader title="Club" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: ui.colors.textMuted, textAlign: 'center' }}>Club no encontrado</Text>
          <PrimaryButton label="Volver" variant="outline" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      </Screen>
    );
  }

  if (isLoading || !club) {
    return (
      <Screen>
        <StackHeader title="Club" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: ui.colors.textMuted }}>{isLoading ? 'Cargando...' : 'Club no encontrado'}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StackHeader
        title={club.name}
        rightAction={isPlayerAccount ? <ClubMuteButton clubId={id!} clubName={club.name} /> : undefined}
      />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={ui.colors.primary} />}
      >
        <ClubHeroHeader
          name={club.name}
          logoUrl={club.logo_url || club.logoUrl}
          coverUrl={club.cover_url || club.coverUrl}
          city={club.city}
          location={club.location}
          playersCount={clubStats.players}
          matchesCount={clubStats.matches}
          statsPeriodLabel={clubStats.periodLabel}
          pointsBalance={myPoints?.points ?? 0}
          showPoints={isPlayerAccount}
          onRedeemPress={() => setTab('rewards')}
        />

        <TabBar active={tab} onChange={setTab} />

        {tab === 'info' && (
          <>
            {isClubAccount && (pendingTournaments?.length ?? 0) > 0 ? (
              <>
                <SectionHeader
                  title="Torneos por validar"
                  subtitle={`${pendingTournaments?.length ?? 0} pendientes`}
                  dark
                />
                {(pendingTournaments || []).map((tournament) => {
                  const organizer =
                    tournamentOrganizerLabel(tournament) || 'Sin organizador';
                  const organizerPhoto =
                    (tournament as { organizer_photo_url?: string | null }).organizer_photo_url ??
                    null;
                  return (
                  <AppCard key={tournament.id}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, fontSize: 15 }}>
                      {tournament.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                      {formatTournamentCategory(tournament.category, tournament.gender)}
                      {tournament.start_date ? ` · ${formatShortDate(tournament.start_date)}` : ''}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        marginTop: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: ui.radius.md,
                        backgroundColor: ui.colors.cardMuted,
                      }}
                    >
                      <Avatar name={organizer} photo={organizerPhoto} size="sm" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>Organizado por</Text>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: ui.colors.textPrimary,
                            marginTop: 1,
                          }}
                          numberOfLines={1}
                        >
                          {organizer}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          label="Rechazar"
                          variant="ghost"
                          fullWidth
                          size="sm"
                          loading={rejectTournamentMutation.isPending}
                          onPress={() =>
                            Alert.alert(
                              'Rechazar torneo',
                              `¿Rechazar "${tournament.name}"?`,
                              [
                                { text: 'Cancelar', style: 'cancel' },
                                {
                                  text: 'Rechazar',
                                  style: 'destructive',
                                  onPress: () => rejectTournamentMutation.mutate(tournament.id),
                                },
                              ],
                            )
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          label="Validar"
                          fullWidth
                          size="sm"
                          loading={approveTournamentMutation.isPending}
                          onPress={() => approveTournamentMutation.mutate(tournament.id)}
                        />
                      </View>
                    </View>
                    <PrimaryButton
                      label="Ver detalle"
                      variant="outline"
                      fullWidth
                      size="sm"
                      style={{ marginTop: 8 }}
                      onPress={() => router.push(`/tournament/${tournament.id}` as any)}
                    />
                  </AppCard>
                  );
                })}
              </>
            ) : null}

            {(club.phone || club.address) && (
              <AppCard style={{ marginBottom: 16 }}>
                {club.address ? (
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: club.phone ? 10 : 0 }}>
                    <Ionicons name="location-outline" size={18} color={ui.colors.primary} />
                    <Text style={{ flex: 1, color: ui.colors.textSecondary, fontSize: 13 }}>{club.address}</Text>
                  </View>
                ) : null}
                {club.phone ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Ionicons name="call-outline" size={18} color={ui.colors.primary} />
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>{club.phone}</Text>
                  </View>
                ) : null}
              </AppCard>
            )}

            <ClubLocationMap
              name={club.name}
              address={club.address}
              city={club.city}
              latitude={club.latitude}
              longitude={club.longitude}
            />

            <SectionHeader
              title="Horarios libres"
              subtitle={
                loadingSlots
                  ? 'Cargando…'
                  : openCourtSlots.length
                    ? `${openCourtSlots.length} disponibles`
                    : 'Sin turnos abiertos'
              }
              dark
            />
            {loadingSlots ? (
              <AppCard style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>Cargando horarios…</Text>
              </AppCard>
            ) : openCourtSlots.length === 0 ? (
              <AppCard style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>
                  Este club no tiene horarios libres publicados por ahora.
                </Text>
              </AppCard>
            ) : (
              <View style={{ marginBottom: 8 }}>
                {slotsByDay.map((group) => (
                  <View key={group.date} style={{ marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: ui.colors.textSecondary,
                        marginBottom: 8,
                      }}
                    >
                      {formatShortDate(group.date)}
                    </Text>
                    {group.slots.map((slot) => {
                      const hourly = Number(slot.price_per_hour ?? slot.pricePerHour);
                      const hours = Number(slot.end_hour) - Number(slot.start_hour);
                      const hasPrice = Number.isFinite(hourly) && hourly > 0;
                      const bonus = Number(slot.bonus_points) || 0;
                      return (
                        <TouchableOpacity
                          key={slot.id}
                          disabled={!isPlayerAccount}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`Armar partido en ${slot.court_label} a las ${formatSlotTime(slot.start_hour)}`}
                          onPress={() =>
                            router.push({
                              pathname: '/create-open-match',
                              params: {
                                clubId: String(id),
                                slotId: slot.id,
                                date: group.date,
                                startHour: String(slot.start_hour),
                                endHour: String(slot.end_hour),
                              },
                            } as any)
                          }
                        >
                          <AppCard padding="sm" style={{ marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                              <View
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 12,
                                  backgroundColor: ui.colors.primarySoft,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ionicons name="time-outline" size={22} color={ui.colors.primary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                                  {slot.court_label}
                                </Text>
                                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 2 }}>
                                  {formatSlotTime(slot.start_hour)} – {formatSlotTime(slot.end_hour)}
                                  {hasPrice
                                    ? ` · ${formatCurrency(hourly)}/h${
                                        hours > 0 ? ` · ≈${formatCurrency(Math.round(hourly * hours))}` : ''
                                      }`
                                    : ''}
                                </Text>
                                {bonus > 0 ? (
                                  <Text style={{ fontSize: 11, color: ui.colors.accent, marginTop: 4, fontWeight: '600' }}>
                                    +{bonus} pts promo
                                  </Text>
                                ) : null}
                              </View>
                              {isPlayerAccount ? (
                                <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                              ) : null}
                            </View>
                          </AppCard>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            <ClubCommentsSection clubId={id!} canPost={!!user && isPlayerAccount} />

            {isPlayerAccount && (
              <PrimaryButton
                label="Buscar partido en este club"
                fullWidth
                size="lg"
                icon={<Ionicons name="search" size={18} color="#fff" />}
                onPress={() => router.push('/browse-open-matches' as any)}
                style={{ marginBottom: 16 }}
              />
            )}

            <SectionHeader title="Top del club" subtitle="Competencia interna" dark />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <View style={{ flex: 1.4 }}>
                <TopFilterSelect
                  icon="podium-outline"
                  accessibilityLabel="Filtrar top del club por categoría"
                  placeholder="Todas las categorías"
                  searchPlaceholder="Buscar categoría..."
                  value={topCategory ?? ALL_CATEGORIES}
                  options={TOP_CATEGORY_OPTIONS}
                  active={!!topCategory}
                  onChange={(value) => setTopCategory(value === ALL_CATEGORIES ? null : value)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TopFilterSelect
                  icon="people-outline"
                  accessibilityLabel="Filtrar top del club por caballeros o damas"
                  placeholder="Todos"
                  searchPlaceholder="Buscar..."
                  value={topGender ?? ALL_GENDERS}
                  options={TOP_GENDER_OPTIONS}
                  active={!!topGender}
                  onChange={(value) =>
                    setTopGender(value === ALL_GENDERS ? null : (value as TopGender))
                  }
                />
              </View>
            </View>
            {topFiltered && loadingCategoryLb && !categoryLeaderboard ? (
              <AppCard>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>Cargando ranking...</Text>
              </AppCard>
            ) : !topEntries?.length ? (
              <AppCard>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>
                  {topFiltered
                    ? `Todavía no hay jugadores de ${topFilterLabel} en el ranking de este mes.`
                    : 'Todavía no hay ranking. Jugá partidos acá para sumar puntos.'}
                </Text>
              </AppCard>
            ) : (
              topEntries.slice(0, 5).map((entry) => (
                <AppCard
                  key={entry.user_id}
                  padding="sm"
                  onPress={() => router.push(`/player/${entry.user_id}` as any)}
                  accessibilityLabel={`Ver perfil de ${entry.nickname || entry.name}`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontWeight: '800', fontSize: 16, color: ui.colors.primary, width: 28 }}>
                      #{entry.rank}
                    </Text>
                    <Avatar name={entry.nickname || entry.name} photo={entry.photo_url} size="sm" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
                        {entry.nickname || entry.name}
                        {entry.user_id === user?.id ? ' (vos)' : ''}
                      </Text>
                      <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>
                        {[entry.level_category, `${entry.matches_at_club} partidos`]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{entry.points} pts</Text>
                    <Ionicons name="chevron-forward" size={16} color={ui.colors.textMuted} />
                  </View>
                </AppCard>
              ))
            )}

            {isClubAccount && (
              <AppCard style={{ marginTop: 16, backgroundColor: ui.colors.surfaceAlt }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textInverse, marginBottom: 8 }}>Gestión del club</Text>
                <PrimaryButton
                  label="Panel de horarios y premios"
                  onPress={() => router.push('/(tabs)/court-slots' as any)}
                  fullWidth
                />
                <View style={{ height: 8 }} />
                <PrimaryButton
                  label="Mis clubs"
                  variant="outline"
                  onPress={() => router.push('/manage-clubs' as any)}
                  fullWidth
                />
              </AppCard>
            )}
          </>
        )}

        {tab === 'shop' && (
          <ClubShopCatalog clubId={id!} canPurchase={!!user && isPlayerAccount} />
        )}

        {tab === 'ranking' && (
          <>
            <SectionHeader title="Ranking mensual" subtitle="Puntos del mes · promos con puntos extra" dark />
            {!leaderboard?.length ? (
              <AppCard>
                <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                  El ranking se actualiza cuando los jugadores terminan partidos en este club.
                </Text>
              </AppCard>
            ) : (
              leaderboard.map((entry) => {
                const isMe = entry.user_id === user?.id;
                return (
                  <AppCard
                    key={entry.user_id}
                    padding="sm"
                    style={isMe ? { borderWidth: 2, borderColor: ui.colors.primary } : undefined}
                    onPress={() => router.push(`/player/${entry.user_id}` as any)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={{ fontWeight: '800', fontSize: 20, color: ui.colors.primary, width: 32 }}>
                        #{entry.rank}
                      </Text>
                      <Avatar name={entry.nickname || entry.name} photo={entry.photo_url} size="md" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                          {entry.nickname || entry.name}
                          {isMe ? ' (vos)' : ''}
                        </Text>
                        <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                          {entry.matches_at_club} partidos
                        </Text>
                      </View>
                      <Text style={{ fontWeight: '800', fontSize: 16, color: ui.colors.textPrimary }}>
                        {entry.points}
                      </Text>
                    </View>
                  </AppCard>
                );
              })
            )}
          </>
        )}

        {tab === 'rewards' && (
          <>
            <SectionHeader
              title="Premios del club"
              subtitle={isPlayerAccount ? `Tenés ${myPoints?.points ?? 0} puntos` : 'Catálogo de beneficios'}
              dark
            />
            {!rewards?.length ? (
              <AppCard>
                <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                  Este club todavía no publicó premios canjeables.
                </Text>
              </AppCard>
            ) : (
              rewards.map((reward) => {
                const required = reward.pointsRequired ?? reward.points_required;
                const canAfford = (myPoints?.points ?? 0) >= required;
                const stock = reward.stock;
                return (
                  <AppCard key={reward.id}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: 'rgba(245,158,11,0.15)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="gift" size={24} color={ui.colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{reward.title}</Text>
                        {reward.description ? (
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                            {reward.description}
                          </Text>
                        ) : null}
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: canAfford ? ui.colors.primary : ui.colors.textMuted,
                            marginTop: 8,
                          }}
                        >
                          {required} puntos
                          {stock != null ? ` · stock ${stock}` : ''}
                        </Text>
                      </View>
                    </View>
                    {isPlayerAccount && (
                      <PrimaryButton
                        label={canAfford ? 'Canjear' : 'Puntos globales insuficientes'}
                        size="sm"
                        fullWidth
                        disabled={!canAfford || redeemMutation.isPending}
                        onPress={() => handleRedeem(reward)}
                        style={{ marginTop: 12 }}
                        variant={canAfford ? 'primary' : 'ghost'}
                      />
                    )}
                  </AppCard>
                );
              })
            )}

            {isPlayerAccount ? (
              <>
                <SectionHeader
                  title="Mis canjes"
                  subtitle="Mostrá el código en recepción"
                  dark
                  style={{ marginTop: 20 }}
                />
                {!myRedemptions?.length ? (
                  <AppCard>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                      Todavía no canjeaste premios en este club.
                    </Text>
                  </AppCard>
                ) : (
                  myRedemptions.map((item) => {
                    const code = item.redemptionCode || item.redemption_code;
                    const title = item.rewardTitle || item.reward_title || 'Premio';
                    const spent = item.pointsSpent ?? item.points_spent ?? 0;
                    const pending = item.status === 'PENDING';
                    return (
                      <AppCard
                        key={item.id}
                        style={{
                          marginBottom: 8,
                          borderWidth: pending ? 1 : 0,
                          borderColor: ui.colors.accent,
                        }}
                      >
                        <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{title}</Text>
                        <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                          {spent} pts · {item.status}
                        </Text>
                        {code ? (
                          <Text
                            style={{
                              marginTop: 10,
                              fontSize: 20,
                              fontWeight: '800',
                              letterSpacing: 1,
                              color: ui.colors.primary,
                            }}
                          >
                            {code}
                          </Text>
                        ) : null}
                        {pending ? (
                          <Text style={{ marginTop: 6, fontSize: 12, color: ui.colors.accent }}>
                            Presentate en recepción con este código
                          </Text>
                        ) : null}
                      </AppCard>
                    );
                  })
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
