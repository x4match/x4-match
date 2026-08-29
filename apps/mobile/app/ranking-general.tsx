import { ScrollView, Text, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { PLAYER_CATEGORY_OPTIONS } from '@/lib/skill';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  StackHeader,
  AppCard,
  Avatar,
  EmptyState,
  SelectionChip,
  SearchableSelect,
} from '@/components/padely';

type GenderFilter = 'mixed' | 'male' | 'female';

type LeaderboardEntry = {
  position: number;
  userId: string;
  name: string;
  photo?: string | null;
  levelCategory: string;
  points: number;
  matchesPlayed: number;
};

type LeaderboardResponse = {
  monthKey: string;
  category: string | null;
  gender: string | null;
  entries: LeaderboardEntry[];
};

const GENDER_OPTIONS: { key: GenderFilter; label: string }[] = [
  { key: 'mixed', label: 'Mixto' },
  { key: 'male', label: 'Hombres' },
  { key: 'female', label: 'Mujeres' },
];

function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

export default function RankingGeneralScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['ranking-general-profile'],
    queryFn: async () => {
      const res = await api.get('/users/profile');
      return res.data as {
        levelCategory?: string;
        categoryStatus?: 'provisional' | 'confirmed';
        placementMatchesPlayed?: number;
        placementMatchesRequired?: number;
      };
    },
  });

  const defaultCategory = profile?.levelCategory || user?.levelCategory || '5ta';
  const isInPlacement =
    (profile?.categoryStatus ?? user?.categoryStatus) === 'provisional';
  const placementMatchesPlayed = Number(
    profile?.placementMatchesPlayed ?? user?.placementMatchesPlayed ?? 0,
  );
  const placementMatchesRequired = Number(
    profile?.placementMatchesRequired ?? user?.placementMatchesRequired ?? 5,
  );
  const [category, setCategory] = useState<string | null>(null);
  const [gender, setGender] = useState<GenderFilter>('mixed');

  useEffect(() => {
    if (!category && defaultCategory) {
      setCategory(defaultCategory);
    }
  }, [category, defaultCategory]);

  const selectedCategory = category || defaultCategory;

  const categoryOptions = useMemo(
    () =>
      PLAYER_CATEGORY_OPTIONS.map((value) => ({
        value,
        label: value,
      })),
    [],
  );

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ranking-general', selectedCategory, gender],
    queryFn: async () => {
      const res = await api.get('/competitive-scoring/leaderboard', {
        params: {
          category: selectedCategory,
          gender,
          limit: 50,
        },
      });
      return res.data as LeaderboardResponse;
    },
    enabled: !!selectedCategory,
  });

  const myEntry = data?.entries.find((entry) => entry.userId === user?.id) ?? null;

  return (
    <Screen>
      <StackHeader title="Ranking general" />
      <ScrollView
        contentContainerStyle={{ ...tabScreenPadding }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >
        <Text style={{ fontSize: 14, color: ui.colors.textSecondary, marginBottom: ui.spacing.md }}>
          Puntos competitivos del mes · {data?.monthKey ? formatMonthKey(data.monthKey) : 'mes actual'}
        </Text>

        {isInPlacement ? (
          <AppCard style={{ marginBottom: ui.spacing.md }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: ui.colors.textPrimary }}>
              Todavía no figurás en el ranking
            </Text>
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 6, lineHeight: 18 }}>
              Completá la nivelación ({Math.min(placementMatchesPlayed, placementMatchesRequired)}/
              {placementMatchesRequired} partidos competitivos) para aparecer y sumar puntos mensuales.
            </Text>
          </AppCard>
        ) : null}

        <SearchableSelect
          label="Categoría"
          placeholder="Elegí una categoría"
          value={selectedCategory}
          options={categoryOptions}
          onChange={setCategory}
        />

        <Text style={{ fontSize: 12, fontWeight: '600', color: ui.colors.textMuted, marginBottom: 8 }}>
          Género
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: ui.spacing.lg }}>
          {GENDER_OPTIONS.map((option) => (
            <SelectionChip
              key={option.key}
              label={option.label}
              selected={gender === option.key}
              onPress={() => setGender(option.key)}
              flex
            />
          ))}
        </View>

        {myEntry ? (
          <AppCard style={{ marginBottom: ui.spacing.md, borderColor: ui.colors.primary, borderWidth: 1 }}>
            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 6 }}>Tu posición</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontWeight: '800', fontSize: 22, color: ui.colors.primary, width: 40 }}>
                #{myEntry.position}
              </Text>
              <Avatar name={user?.name || myEntry.name} photo={myEntry.photo} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{user?.name || myEntry.name}</Text>
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                  {myEntry.matchesPlayed} partido{myEntry.matchesPlayed === 1 ? '' : 's'} · Cat. {myEntry.levelCategory}
                </Text>
              </View>
              <Text style={{ fontWeight: '800', color: ui.colors.textPrimary }}>{myEntry.points} pts</Text>
            </View>
          </AppCard>
        ) : null}

        {isLoading ? (
          <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando ranking...</Text>
        ) : !data?.entries.length ? (
          <EmptyState
            icon={<Ionicons name="podium-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin jugadores"
            description={`Todavía no hay puntos competitivos en ${selectedCategory} para este filtro.`}
          />
        ) : (
          data.entries.map((entry) => {
            const isMe = entry.userId === user?.id;
            return (
              <AppCard
                key={entry.userId}
                padding="sm"
                style={{ marginBottom: 8, opacity: isMe ? 1 : 1 }}
                onPress={() => router.push(`/player/${entry.userId}` as any)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text
                    style={{
                      fontWeight: '800',
                      fontSize: 18,
                      color: entry.position <= 3 ? ui.colors.accent : ui.colors.primary,
                      width: 36,
                    }}
                  >
                    #{entry.position}
                  </Text>
                  <Avatar name={entry.name} photo={entry.photo} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                      {entry.name}
                      {isMe ? ' (vos)' : ''}
                    </Text>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                      {entry.matchesPlayed} partido{entry.matchesPlayed === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '800', color: ui.colors.textPrimary }}>{entry.points} pts</Text>
                </View>
              </AppCard>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
