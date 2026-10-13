import { ScrollView, Text, View, RefreshControl, Alert, Share, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { safeMapCircuit, mapTournament } from '@/lib/mappers';
import type { Circuit, Tournament } from '@/lib/types';
import { formatShortDate, formatRelativeTime } from '@/lib/format';
import { buildClubRankingShareText } from '@/lib/club/club-share';
import { ClubImpactBanner, type ClubImpactSummary } from '@/components/club/ClubImpactBanner';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  AppHeader,
  AppCard,
  EmptyState,
  Avatar,
  PrimaryButton,
  SelectionChip,
  SectionHeader,
  StatusPill,
  InputField,
  TournamentCard,
  CircuitsUnderConstruction,
} from '@/components/x4match';
import { useCircuitsEnabled } from '@/lib/features';

type Tab = 'ranking' | 'rewards' | 'tournaments';
type RankingPeriod = 'weekly' | 'monthly' | 'annual';
type TournamentMode = 'tournaments' | 'masters' | 'circuits';

interface RankingEntry {
  user_id: string;
  name: string;
  nickname?: string;
  photo_url?: string;
  points: number;
  matches_at_club: number;
  rank: string | number;
}

interface RewardRow {
  id: string;
  title: string;
  description?: string;
  points_required: number;
  pointsRequired?: number;
  reward_type: string;
  active: boolean;
  stock?: number | null;
  maxPerUser?: number | null;
  max_per_user?: number | null;
}

interface RedemptionRow {
  id: string;
  points_spent: number;
  pointsSpent?: number;
  created_at: string;
  createdAt?: string;
  user_name: string;
  userName?: string;
  user_nickname?: string;
  userNickname?: string;
  reward_title: string;
  rewardTitle?: string;
  status?: string;
  redemption_code?: string;
  redemptionCode?: string;
}

const RANKING_PERIODS: { key: RankingPeriod; label: string }[] = [
  { key: 'weekly', label: 'Semanal' },
  { key: 'monthly', label: 'Mensual' },
  { key: 'annual', label: 'Anual' },
];

const TOURNAMENT_MODES: { key: TournamentMode; label: string }[] = [
  { key: 'tournaments', label: 'Torneos' },
  { key: 'masters', label: 'Máster' },
  { key: 'circuits', label: 'Circuitos' },
];

function isMasterTournament(tournament: Tournament) {
  const text = `${tournament.name} ${tournament.category || ''}`.toLowerCase();
  return text.includes('master') || text.includes('máster') || text.includes('maestro');
}

function periodLabel(period: RankingPeriod) {
  switch (period) {
    case 'weekly':
      return 'Semana actual';
    case 'annual':
      return `Temporada ${new Date().getFullYear()}`;
    default:
      return new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'ranking', label: 'Ranking' },
    { key: 'rewards', label: 'Premios' },
    { key: 'tournaments', label: 'Torneos' },
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

export default function CommunityScreen() {
  const router = useRouter();
  const circuitsEnabled = useCircuitsEnabled();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = isClub(user?.role);

  const [tab, setTab] = useState<Tab>('ranking');
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>('monthly');
  const [tournamentMode, setTournamentMode] = useState<TournamentMode>('tournaments');
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);

  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [rewardPoints, setRewardPoints] = useState('50');
  const [rewardStock, setRewardStock] = useState('');
  const [rewardMaxPerUser, setRewardMaxPerUser] = useState('');

  const { data: clubs } = useQuery({
    queryKey: ['club-community-clubs'],
    queryFn: async () => {
      const res = await api.get('/clubs/mine');
      return res.data as { id: string; name: string }[];
    },
    enabled: canManage,
  });

  const activeClubId = useMemo(() => selectedClubId || clubs?.[0]?.id || null, [selectedClubId, clubs]);
  const activeClub = clubs?.find((c) => c.id === activeClubId);

  const { data: impact, isLoading: loadingImpact, refetch: refetchImpact } = useQuery({
    queryKey: ['club-impact', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/impact`);
      return res.data as ClubImpactSummary;
    },
    enabled: canManage && !!activeClubId,
  });

  const { data: ranking, isLoading: loadingRanking, refetch: refetchRanking } = useQuery({
    queryKey: ['club-community-ranking', activeClubId, rankingPeriod],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/rankings`, { params: { period: rankingPeriod, limit: 20 } });
      return res.data as RankingEntry[];
    },
    enabled: canManage && !!activeClubId && tab === 'ranking',
  });

  const { data: rewards, refetch: refetchRewards, isLoading: loadingRewards } = useQuery({
    queryKey: ['club-rewards', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/rewards`);
      return res.data as RewardRow[];
    },
    enabled: canManage && !!activeClubId && tab === 'rewards',
  });

  const { data: redemptions, refetch: refetchRedemptions } = useQuery({
    queryKey: ['club-reward-redemptions', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/rewards/redemptions`);
      return res.data as RedemptionRow[];
    },
    enabled: canManage && !!activeClubId && tab === 'rewards',
  });

  const { data: tournamentsRaw, refetch: refetchTournaments, isLoading: loadingTournaments } = useQuery({
    queryKey: ['club-community-tournaments'],
    queryFn: async () => {
      const res = await api.get('/tournaments', { params: { includePast: true } });
      return res.data;
    },
    enabled: canManage && tab === 'tournaments' && tournamentMode !== 'circuits',
  });

  const { data: circuitsRaw, refetch: refetchCircuits, isLoading: loadingCircuits } = useQuery({
    queryKey: ['club-community-circuits'],
    queryFn: async () => {
      const res = await api.get('/circuits');
      return res.data;
    },
    enabled: circuitsEnabled && canManage && tab === 'tournaments' && tournamentMode === 'circuits',
  });

  const resetRewardForm = () => {
    setShowRewardForm(false);
    setEditingRewardId(null);
    setRewardTitle('');
    setRewardDesc('');
    setRewardPoints('50');
    setRewardStock('');
    setRewardMaxPerUser('');
  };

  const openEditReward = (reward: RewardRow) => {
    setEditingRewardId(reward.id);
    setRewardTitle(reward.title);
    setRewardDesc(reward.description || '');
    setRewardPoints(String(reward.pointsRequired ?? reward.points_required));
    setRewardStock(reward.stock != null ? String(reward.stock) : '');
    setRewardMaxPerUser(
      (reward.maxPerUser ?? reward.max_per_user) != null
        ? String(reward.maxPerUser ?? reward.max_per_user)
        : '',
    );
    setShowRewardForm(true);
  };

  const saveReward = useMutation({
    mutationFn: async () => {
      if (!activeClubId || !rewardTitle.trim()) throw new Error('Completá el título');
      const payload = {
        title: rewardTitle.trim(),
        description: rewardDesc.trim() || undefined,
        pointsRequired: parseInt(rewardPoints, 10) || 50,
        stock: rewardStock.trim() ? parseInt(rewardStock, 10) : null,
        maxPerUser: rewardMaxPerUser.trim() ? parseInt(rewardMaxPerUser, 10) : null,
      };
      if (editingRewardId) {
        const res = await api.patch(`/clubs/${activeClubId}/rewards/${editingRewardId}`, payload);
        return res.data;
      }
      const res = await api.post(`/clubs/${activeClubId}/rewards`, payload);
      return res.data;
    },
    onSuccess: () => {
      const wasEditing = !!editingRewardId;
      resetRewardForm();
      queryClient.invalidateQueries({ queryKey: ['club-rewards', activeClubId] });
      Alert.alert('Listo', wasEditing ? 'Premio actualizado' : 'Premio creado');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo guardar'),
  });

  const deactivateReward = useMutation({
    mutationFn: async (rewardId: string) => {
      if (!activeClubId) return;
      await api.patch(`/clubs/${activeClubId}/rewards/${rewardId}`, { active: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-rewards', activeClubId] });
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo desactivar'),
  });

  const fulfillRedemption = useMutation({
    mutationFn: async (redemptionId: string) => {
      if (!activeClubId) return;
      await api.post(`/clubs/${activeClubId}/redemptions/${redemptionId}/fulfill`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-reward-redemptions', activeClubId] });
      Alert.alert('Listo', 'Premio entregado');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo entregar'),
  });

  const cancelRedemption = useMutation({
    mutationFn: async (redemptionId: string) => {
      if (!activeClubId) return;
      await api.post(`/clubs/${activeClubId}/redemptions/${redemptionId}/cancel`, {
        reason: 'Cancelado por el club',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-reward-redemptions', activeClubId] });
      Alert.alert('Listo', 'Canje cancelado y puntos reintegrados');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo cancelar'),
  });

  const onRefresh = () => {
    refetchImpact();
    if (tab === 'ranking') refetchRanking();
    if (tab === 'rewards') {
      refetchRewards();
      refetchRedemptions();
    }
    if (tab === 'tournaments') {
      if (tournamentMode !== 'circuits') refetchTournaments();
      else if (circuitsEnabled) refetchCircuits();
    }
  };

  const isLoading =
    loadingImpact ||
    (tab === 'ranking' && loadingRanking) ||
    (tab === 'rewards' && loadingRewards) ||
    (tab === 'tournaments' &&
      (tournamentMode === 'circuits' ? circuitsEnabled && loadingCircuits : loadingTournaments));

  const tournamentList: Tournament[] = (tournamentsRaw || []).map(mapTournament);
  const regularTournaments = tournamentList.filter((t) => !isMasterTournament(t));
  const masterTournaments = tournamentList.filter(isMasterTournament);
  const circuitList: Circuit[] = (circuitsRaw || [])
    .map(safeMapCircuit)
    .filter((c: Circuit | null): c is Circuit => c != null && Boolean(c.id));

  const shareRanking = async () => {
    if (!ranking?.length || !activeClub) {
      Alert.alert('Sin datos', 'Todavía no hay jugadores en el ranking para compartir.');
      return;
    }
    const message = buildClubRankingShareText(
      activeClub.name,
      periodLabel(rankingPeriod),
      ranking,
      ranking.length,
    );
    try {
      await Share.share({ message, title: `Ranking ${activeClub.name}` });
    } catch {
      // usuario canceló
    }
  };

  if (!canManage) {
    return (
      <Screen>
        <AppHeader title="Comunidad" />
        <EmptyState
          icon={<Ionicons name="trophy-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
          description="Esta sección es solo para cuentas de club."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Comunidad" />
      <ScrollView
        contentContainerStyle={{ ...tabScreenPadding }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={ui.colors.primary} />}
      >
        <Text style={{ fontSize: 14, color: ui.colors.textMuted, marginBottom: ui.spacing.md }}>
          Ranking, premios y competencias de tu club.
        </Text>

        {!clubs?.length ? (
          <EmptyState
            icon={<Ionicons name="business-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin clubs"
            description="Creá un club para gestionar la comunidad competitiva."
          />
        ) : (
          <>
            <Text style={{ fontSize: 12, fontWeight: '600', color: ui.colors.textMuted, marginBottom: 8 }}>Club</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {clubs.map((club) => (
                  <SelectionChip
                    key={club.id}
                    label={club.name}
                    selected={club.id === activeClubId}
                    onPress={() => setSelectedClubId(club.id)}
                  />
                ))}
              </View>
            </ScrollView>

            <ClubImpactBanner
              impact={impact}
              clubName={activeClub?.name}
              loading={loadingImpact}
            />

            <TabBar active={tab} onChange={setTab} />

            {tab === 'ranking' && (
              <>
                <SectionHeader title="Ranking" subtitle={periodLabel(rankingPeriod)} />
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {RANKING_PERIODS.map((item) => (
                    <SelectionChip
                      key={item.key}
                      label={item.label}
                      selected={rankingPeriod === item.key}
                      onPress={() => setRankingPeriod(item.key)}
                      flex
                    />
                  ))}
                </View>

                {ranking?.length ? (
                  <PrimaryButton
                    label="Compartir ranking"
                    variant="outline"
                    fullWidth
                    onPress={shareRanking}
                    style={{ marginBottom: 16 }}
                    icon={<Ionicons name="share-social-outline" size={18} color={ui.colors.primary} />}
                  />
                ) : null}

                {loadingRanking ? (
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando ranking...</Text>
                ) : !ranking?.length ? (
                  <AppCard>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                      El ranking se alimenta cuando los jugadores juegan partidos en tu club y cargan resultados.
                    </Text>
                  </AppCard>
                ) : (
                  ranking.map((entry) => (
                    <AppCard key={entry.user_id} padding="sm" style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ fontWeight: '800', fontSize: 18, color: ui.colors.primary, width: 36 }}>
                          #{entry.rank}
                        </Text>
                        <Avatar name={entry.nickname || entry.name} photo={entry.photo_url} size="sm" />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                            {entry.nickname || entry.name}
                          </Text>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                            {entry.matches_at_club} partidos en el club
                          </Text>
                        </View>
                        <Text style={{ fontWeight: '800', color: ui.colors.textPrimary }}>{entry.points} pts</Text>
                      </View>
                    </AppCard>
                  ))
                )}
              </>
            )}

            {tab === 'rewards' && (
              <>
                <SectionHeader
                  title="Premios"
                  subtitle="Catálogo canjeable por puntos"
                  action={
                    !showRewardForm ? (
                      <TouchableOpacity onPress={() => setShowRewardForm(true)}>
                        <Text style={{ color: ui.colors.primary, fontSize: 13, fontWeight: '600' }}>Crear</Text>
                      </TouchableOpacity>
                    ) : null
                  }
                />

                {showRewardForm ? (
                  <AppCard style={{ marginBottom: 16 }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 12 }}>
                      {editingRewardId ? 'Editar premio' : 'Crear premio'}
                    </Text>
                    <InputField label="Título" value={rewardTitle} onChangeText={setRewardTitle} placeholder="Ej: 1 hora gratis" />
                    <InputField
                      label="Descripción"
                      value={rewardDesc}
                      onChangeText={setRewardDesc}
                      placeholder="Detalle del beneficio"
                    />
                    <InputField
                      label="Puntos necesarios"
                      value={rewardPoints}
                      onChangeText={setRewardPoints}
                      keyboardType="number-pad"
                    />
                    <InputField
                      label="Stock (vacío = ilimitado)"
                      value={rewardStock}
                      onChangeText={setRewardStock}
                      keyboardType="number-pad"
                      placeholder="Ej: 20"
                    />
                    <InputField
                      label="Máx. por jugador (vacío = sin tope)"
                      value={rewardMaxPerUser}
                      onChangeText={setRewardMaxPerUser}
                      keyboardType="number-pad"
                      placeholder="Ej: 1"
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <SelectionChip label="Cancelar" selected={false} onPress={resetRewardForm} flex />
                      </View>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          label={editingRewardId ? 'Guardar' : 'Publicar'}
                          fullWidth
                          loading={saveReward.isPending}
                          onPress={() => saveReward.mutate()}
                        />
                      </View>
                    </View>
                  </AppCard>
                ) : (
                  <PrimaryButton
                    label="Crear premio"
                    variant="outline"
                    fullWidth
                    onPress={() => setShowRewardForm(true)}
                    style={{ marginBottom: 16 }}
                    icon={<Ionicons name="gift-outline" size={18} color={ui.colors.primary} />}
                  />
                )}

                {!rewards?.length ? (
                  <AppCard style={{ marginBottom: 16 }}>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                      Creá recompensas para motivar a los jugadores del club.
                    </Text>
                  </AppCard>
                ) : (
                  rewards.map((reward) => (
                    <AppCard key={reward.id} padding="sm" style={{ marginBottom: 8, opacity: reward.active ? 1 : 0.6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{reward.title}</Text>
                          {reward.description ? (
                            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                              {reward.description}
                            </Text>
                          ) : null}
                          <Text style={{ fontSize: 13, color: ui.colors.primary, fontWeight: '700', marginTop: 8 }}>
                            {reward.pointsRequired ?? reward.points_required} puntos
                            {reward.stock != null ? ` · stock ${reward.stock}` : ''}
                            {(reward.maxPerUser ?? reward.max_per_user) != null
                              ? ` · máx ${reward.maxPerUser ?? reward.max_per_user}/jugador`
                              : ''}
                          </Text>
                        </View>
                        {reward.active && (
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={() => openEditReward(reward)}>
                              <Ionicons name="create-outline" size={20} color={ui.colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() =>
                                Alert.alert('Desactivar premio', `¿Ocultar "${reward.title}" del catálogo?`, [
                                  { text: 'Cancelar', style: 'cancel' },
                                  { text: 'Desactivar', style: 'destructive', onPress: () => deactivateReward.mutate(reward.id) },
                                ])
                              }
                            >
                              <Ionicons name="eye-off-outline" size={20} color={ui.colors.textMuted} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </AppCard>
                  ))
                )}

                <SectionHeader title="Historial de canjes" subtitle="Entregar o cancelar en recepción" />
                {!redemptions?.length ? (
                  <AppCard>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                      Cuando un jugador canjee un premio, aparecerá acá.
                    </Text>
                  </AppCard>
                ) : (
                  redemptions.map((item) => {
                    const title = item.rewardTitle || item.reward_title;
                    const name = item.userNickname || item.user_nickname || item.userName || item.user_name;
                    const spent = item.pointsSpent ?? item.points_spent;
                    const code = item.redemptionCode || item.redemption_code;
                    const created = item.createdAt || item.created_at;
                    const pending = item.status === 'PENDING' || !item.status;
                    return (
                      <AppCard key={item.id} padding="sm" style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{title}</Text>
                            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                              {name} · {spent} pts · {item.status || 'PENDING'}
                            </Text>
                            {code ? (
                              <Text
                                style={{
                                  marginTop: 8,
                                  fontSize: 16,
                                  fontWeight: '800',
                                  letterSpacing: 1,
                                  color: ui.colors.primary,
                                }}
                              >
                                {code}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>
                            {formatRelativeTime(created)}
                          </Text>
                        </View>
                        {pending ? (
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                            <View style={{ flex: 1 }}>
                              <PrimaryButton
                                label="Entregar"
                                size="sm"
                                fullWidth
                                loading={fulfillRedemption.isPending}
                                onPress={() => fulfillRedemption.mutate(item.id)}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <PrimaryButton
                                label="Cancelar"
                                size="sm"
                                fullWidth
                                variant="ghost"
                                loading={cancelRedemption.isPending}
                                onPress={() =>
                                  Alert.alert(
                                    'Cancelar canje',
                                    'Se reintegrarán los puntos al jugador.',
                                    [
                                      { text: 'No', style: 'cancel' },
                                      {
                                        text: 'Cancelar canje',
                                        style: 'destructive',
                                        onPress: () => cancelRedemption.mutate(item.id),
                                      },
                                    ],
                                  )
                                }
                              />
                            </View>
                          </View>
                        ) : null}
                      </AppCard>
                    );
                  })
                )}
              </>
            )}

            {tab === 'tournaments' && (
              <>
                <SectionHeader title="Competencias" subtitle="Torneos, máster y circuitos" />
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {TOURNAMENT_MODES.map((item) => (
                    <SelectionChip
                      key={item.key}
                      label={item.label}
                      selected={tournamentMode === item.key}
                      onPress={() => setTournamentMode(item.key)}
                      flex
                    />
                  ))}
                </View>

                {tournamentMode === 'circuits' ? (
                  !circuitsEnabled ? (
                    <CircuitsUnderConstruction />
                  ) : loadingCircuits ? (
                    <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando circuitos...</Text>
                  ) : !circuitList.length ? (
                    <AppCard>
                      <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                        No hay circuitos publicados por ahora.
                      </Text>
                    </AppCard>
                  ) : (
                    circuitList.map((circuit) => (
                      <AppCard key={circuit.id} onPress={() => router.push(`/circuit/${circuit.id}` as any)} style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={{ fontWeight: '700', fontSize: 15, color: ui.colors.textPrimary, flex: 1 }}>
                            {circuit.name}
                          </Text>
                          <StatusPill status={circuit.status} />
                        </View>
                        <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                          {circuit.season || 'Sin temporada'}
                          {circuit.venueCount != null ? ` · ${circuit.venueCount} sedes` : ''}
                        </Text>
                      </AppCard>
                    ))
                  )
                ) : loadingTournaments ? (
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando torneos...</Text>
                ) : (tournamentMode === 'masters' ? masterTournaments : regularTournaments).length === 0 ? (
                  <AppCard>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                      {tournamentMode === 'masters'
                        ? 'No hay torneos máster publicados.'
                        : 'No hay torneos activos por ahora.'}
                    </Text>
                  </AppCard>
                ) : (
                  (tournamentMode === 'masters' ? masterTournaments : regularTournaments).map((tournament) => (
                    <TournamentCard
                      key={tournament.id}
                      tournament={tournament}
                      onPress={() => router.push(`/tournament/${tournament.id}` as any)}
                    />
                  ))
                )}

                <PrimaryButton
                  label="Ver todos los torneos"
                  variant="ghost"
                  fullWidth
                  onPress={() => router.push('/tournaments' as any)}
                  style={{ marginTop: 8, backgroundColor: ui.colors.surface }}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
