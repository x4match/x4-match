import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { buildClubRankingShareText } from '@/lib/club-share';
import { formatShortDate } from '@/lib/format';
import {
  approveClubTournamentValidation,
  fetchClubTournamentValidations,
  rejectClubTournamentValidation,
} from '@/lib/tournament/api';
import { formatTournamentCategory } from '@/lib/tournament/types';
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
  FadeInUp,
  SkeletonCard,
} from '@/components/padely';
import {
  ClubPicker,
  resolveActiveClubId,
  useMineClubs,
} from '@/components/club/ClubPicker';
import { api } from '@/lib/api';

type RankingPeriod = 'weekly' | 'monthly' | 'annual';

interface RankingEntry {
  user_id: string;
  name: string;
  nickname?: string;
  photo_url?: string;
  points: number;
  matches_at_club: number;
  rank: string | number;
}

const RANKING_PERIODS: { key: RankingPeriod; label: string }[] = [
  { key: 'weekly', label: 'Semanal' },
  { key: 'monthly', label: 'Mensual' },
  { key: 'annual', label: 'Anual' },
];

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

function nextUpdateLabel(period: RankingPeriod) {
  const now = new Date();
  if (period === 'weekly') {
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntilMonday);
    return `Próxima actualización · lunes ${next.getDate()}/${next.getMonth() + 1}`;
  }
  if (period === 'annual') {
    return `Próxima actualización · 1 ene ${now.getFullYear() + 1}`;
  }
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `Próxima actualización · 1/${nextMonth.getMonth() + 1}`;
}

function podiumColor(rank: number) {
  if (rank === 1) return ui.colors.accent;
  if (rank === 2) return ui.colors.textSecondary;
  if (rank === 3) return '#CD7F32';
  return ui.colors.primary;
}

export default function ClubRankingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = isClub(user?.role);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>('monthly');

  const { data: clubs } = useMineClubs(canManage && !!user?.id);

  const activeClubId = useMemo(
    () => resolveActiveClubId(selectedClubId, clubs),
    [selectedClubId, clubs],
  );
  const activeClub = clubs?.find((c) => c.id === activeClubId);

  const {
    data: ranking,
    isLoading: loadingRanking,
    refetch: refetchRanking,
    isRefetching: refetchingRanking,
  } = useQuery({
    queryKey: ['club-ranking-board', activeClubId, rankingPeriod],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/rankings`, {
        params: { period: rankingPeriod, limit: 50 },
      });
      return res.data as RankingEntry[];
    },
    enabled: canManage && !!activeClubId,
  });

  const {
    data: pendingTournaments,
    isLoading: loadingTournaments,
    refetch: refetchTournaments,
    isRefetching: refetchingTournaments,
  } = useQuery({
    queryKey: ['club-tournament-validations', activeClubId],
    queryFn: () => fetchClubTournamentValidations(activeClubId!),
    enabled: canManage && !!activeClubId,
    retry: false,
  });

  const approveTournament = useMutation({
    mutationFn: (tournamentId: string) => approveClubTournamentValidation(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-tournament-validations', activeClubId] });
      queryClient.invalidateQueries({ queryKey: ['tournaments-list'] });
      Alert.alert('Torneo validado', 'Ya aparece en el listado público.');
    },
    onError: (err: any) =>
      Alert.alert('Error', err.response?.data?.message || 'No se pudo validar el torneo'),
  });

  const rejectTournament = useMutation({
    mutationFn: (tournamentId: string) => rejectClubTournamentValidation(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-tournament-validations', activeClubId] });
      Alert.alert('Torneo rechazado', 'El organizador verá el rechazo en su panel.');
    },
    onError: (err: any) =>
      Alert.alert('Error', err.response?.data?.message || 'No se pudo rechazar el torneo'),
  });

  const onRefresh = () => {
    refetchRanking();
    refetchTournaments();
  };

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
        <AppHeader title="Ranking" />
        <EmptyState
          icon={<Ionicons name="trophy-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
          description="Esta sección es solo para cuentas de club."
        />
      </Screen>
    );
  }

  const pendingCount = pendingTournaments?.length ?? 0;
  const refreshing = refetchingRanking || refetchingTournaments;
  const topThree = (ranking || []).slice(0, 3);
  const rest = (ranking || []).slice(3);
  const categories = Array.from(
    new Set(
      (pendingTournaments || []).map((t) =>
        formatTournamentCategory(t.category, t.gender),
      ),
    ),
  );

  return (
    <Screen>
      <AppHeader title="Ranking" />
      <ScrollView
        contentContainerStyle={{ ...tabScreenPadding, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ui.colors.primary} />
        }
      >
        {!clubs?.length ? (
          <EmptyState
            icon={<Ionicons name="business-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin clubs"
            description="Creá o asociá un club para ver el ranking."
          />
        ) : (
          <>
            <ClubPicker
              selectedClubId={activeClubId}
              onSelect={setSelectedClubId}
              enabled={canManage}
            />

            <FadeInUp index={0}>
              <AppCard padding="sm" style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>
                  {nextUpdateLabel(rankingPeriod)}
                </Text>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 4 }}>
                  {ranking?.length ?? 0} jugadores · {periodLabel(rankingPeriod)}
                </Text>
              </AppCard>
            </FadeInUp>

            {pendingCount > 0 ? (
              <>
                <SectionHeader
                  title="Partidos pendientes"
                  subtitle={`${pendingCount} torneo${pendingCount === 1 ? '' : 's'} por validar`}
                />
                <View style={{ marginBottom: 20 }}>
                  {(pendingTournaments || []).map((tournament) => (
                    <AppCard key={tournament.id} style={{ marginBottom: 8 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, fontSize: 15 }}>
                        {tournament.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                        {formatTournamentCategory(tournament.category, tournament.gender)}
                        {tournament.start_date ? ` · ${formatShortDate(tournament.start_date)}` : ''}
                      </Text>
                      {(tournament as any).organizer_name ? (
                        <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>
                          Organizador: {(tournament as any).organizer_name}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton
                            label="Rechazar"
                            variant="ghost"
                            fullWidth
                            size="sm"
                            loading={rejectTournament.isPending}
                            onPress={() =>
                              Alert.alert('Rechazar torneo', `¿Rechazar "${tournament.name}"?`, [
                                { text: 'Cancelar', style: 'cancel' },
                                {
                                  text: 'Rechazar',
                                  style: 'destructive',
                                  onPress: () => rejectTournament.mutate(tournament.id),
                                },
                              ])
                            }
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton
                            label="Validar"
                            fullWidth
                            size="sm"
                            loading={approveTournament.isPending}
                            onPress={() => approveTournament.mutate(tournament.id)}
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
                  ))}
                </View>
              </>
            ) : loadingTournaments ? (
              <SkeletonCard />
            ) : null}

            {categories.length > 0 ? (
              <>
                <SectionHeader title="Categorías" subtitle="Desde torneos pendientes" />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {categories.map((cat) => (
                    <View
                      key={cat}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: ui.radius.md,
                        backgroundColor: ui.colors.surface2,
                        borderWidth: 1,
                        borderColor: ui.colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: ui.colors.textPrimary }}>
                        {cat}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <SectionHeader title="Top jugadores" subtitle={periodLabel(rankingPeriod)} />
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
              <View style={{ gap: 10 }}>
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ) : !ranking?.length ? (
              <EmptyState
                icon={<Ionicons name="trophy-outline" size={36} color={ui.colors.textMuted} />}
                title="Ranking vacío"
                description="Se alimenta cuando los jugadores juegan partidos en tu club y cargan resultados."
              />
            ) : (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    marginBottom: 16,
                    alignItems: 'flex-end',
                  }}
                >
                  {topThree.map((entry, index) => {
                    const rank = Number(entry.rank) || index + 1;
                    const height = rank === 1 ? 140 : rank === 2 ? 120 : 108;
                    return (
                      <AppCard
                        key={entry.user_id}
                        padding="sm"
                        style={{
                          flex: 1,
                          marginBottom: 0,
                          minHeight: height,
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 20,
                            fontWeight: '800',
                            color: podiumColor(rank),
                            marginBottom: 8,
                          }}
                        >
                          #{rank}
                        </Text>
                        <Avatar
                          name={entry.nickname || entry.name}
                          photo={entry.photo_url}
                          size="sm"
                        />
                        <Text
                          numberOfLines={1}
                          style={{
                            fontWeight: '700',
                            color: ui.colors.textPrimary,
                            fontSize: 12,
                            marginTop: 8,
                            textAlign: 'center',
                          }}
                        >
                          {entry.nickname || entry.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>
                          {entry.points} pts
                        </Text>
                      </AppCard>
                    );
                  })}
                </View>

                {rest.map((entry, index) => (
                  <FadeInUp key={entry.user_id} index={index}>
                    <AppCard padding="sm" style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text
                          style={{
                            fontWeight: '800',
                            fontSize: 18,
                            color: ui.colors.primary,
                            width: 36,
                          }}
                        >
                          #{entry.rank}
                        </Text>
                        <Avatar
                          name={entry.nickname || entry.name}
                          photo={entry.photo_url}
                          size="sm"
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                            {entry.nickname || entry.name}
                          </Text>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                            {entry.matches_at_club} partidos en el club
                          </Text>
                        </View>
                        <Text style={{ fontWeight: '800', color: ui.colors.textPrimary }}>
                          {entry.points} pts
                        </Text>
                      </View>
                    </AppCard>
                  </FadeInUp>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
