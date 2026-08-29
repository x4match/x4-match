import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { resolveSkillScore, formatSkillScore } from '@/lib/skill';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  AppHeader,
  AppCard,
  PrimaryButton,
  Avatar,
} from '@/components/padely';
import { PressableScale } from '@/components/ui';

type SearchTab = 'players' | 'clubs';

type PlayerSearchHit = {
  id: string;
  userId: string;
  name: string;
  photo?: string;
  skillScore?: number;
  levelCategory?: string;
};

type ClubSearchHit = {
  id: string;
  name: string;
  city?: string;
  zone?: string;
  address?: string;
  logo_url?: string;
};

export default function SearchScreen() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<SearchTab>('players');
  const [query, setQuery] = useState('');
  const [playerResults, setPlayerResults] = useState<PlayerSearchHit[]>([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);

  const { data: clubs = [], isFetching: clubsLoading } = useQuery({
    queryKey: ['clubs-search-modal'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return (res.data || []) as ClubSearchHit[];
    },
    enabled: searchOpen,
  });

  const searchPlayers = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setPlayerResults([]);
      return;
    }
    setPlayerSearchLoading(true);
    try {
      const res = await api.get('/players/search', { params: { q: q.trim() } });
      const mapped: PlayerSearchHit[] = (res.data || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        userId: String(row.userId),
        name: String(row.name || row.nickname || 'Jugador'),
        photo: row.photo ? String(row.photo) : undefined,
        skillScore: resolveSkillScore(
          row.skillScore != null ? Number(row.skillScore) : undefined,
          row.rating != null ? Number(row.rating) : undefined,
        ),
        levelCategory: row.levelCategory ? String(row.levelCategory) : undefined,
      }));
      setPlayerResults(mapped);
    } catch {
      setPlayerResults([]);
    } finally {
      setPlayerSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchOpen || searchTab !== 'players') return;
    const timer = setTimeout(() => searchPlayers(query), 300);
    return () => clearTimeout(timer);
  }, [query, searchOpen, searchTab, searchPlayers]);

  const clubResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return clubs
      .filter((club) => {
        const haystack = [club.name, club.city, club.zone, club.address]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 40);
  }, [clubs, query]);

  const openSearch = () => {
    Keyboard.dismiss();
    setSearchOpen(true);
    setSearchTab('players');
    setQuery('');
    setPlayerResults([]);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
    setPlayerResults([]);
  };

  const goToPlayer = (player: PlayerSearchHit) => {
    closeSearch();
    router.push(`/player/${player.id}` as any);
  };

  const goToClub = (club: ClubSearchHit) => {
    closeSearch();
    router.push(`/club/${club.id}` as any);
  };

  const isLoading = searchTab === 'players' ? playerSearchLoading : clubsLoading && clubs.length === 0;
  const resultsEmptyHint =
    query.trim().length < 2
      ? 'Escribí al menos 2 letras'
      : searchTab === 'players'
        ? 'No encontramos jugadores'
        : 'No encontramos clubes';

  return (
    <Screen>
      <AppHeader
        title="Jugar"
        rightAction={
          <TouchableOpacity
            onPress={openSearch}
            accessibilityRole="button"
            accessibilityLabel="Buscar jugadores o clubes"
            style={{
              padding: 10,
              backgroundColor: ui.colors.surface1,
              borderRadius: ui.radius.sm,
              borderWidth: 1,
              borderColor: ui.colors.border,
            }}
          >
            <Ionicons name="search" size={20} color={ui.colors.textPrimary} />
          </TouchableOpacity>
        }
      />

      <Modal visible={searchOpen} animationType="slide" transparent onRequestClose={closeSearch}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={{
              backgroundColor: ui.colors.card,
              borderTopLeftRadius: ui.radius.xl,
              borderTopRightRadius: ui.radius.xl,
              maxHeight: '85%',
              paddingBottom: 24,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: ui.spacing.lg,
                paddingTop: ui.spacing.lg,
                paddingBottom: 8,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: ui.colors.textPrimary }}>
                Buscar
              </Text>
              <TouchableOpacity onPress={closeSearch} hitSlop={8}>
                <Ionicons name="close" size={24} color={ui.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: ui.spacing.lg,
                borderBottomWidth: 1,
                borderBottomColor: ui.colors.border,
                gap: 4,
              }}
            >
              {(
                [
                  { value: 'players' as const, label: 'Jugadores' },
                  { value: 'clubs' as const, label: 'Clubes' },
                ] as const
              ).map((tab) => {
                const active = searchTab === tab.value;
                return (
                  <Pressable
                    key={tab.value}
                    onPress={() => setSearchTab(tab.value)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderBottomWidth: 2,
                      borderBottomColor: active ? ui.colors.textPrimary : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: active ? '700' : '500',
                        color: active ? ui.colors.textPrimary : ui.colors.textMuted,
                      }}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ paddingHorizontal: ui.spacing.lg, paddingTop: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: ui.colors.cardMuted,
                  borderRadius: ui.radius.md,
                  paddingHorizontal: 14,
                  marginBottom: 8,
                }}
              >
                <Ionicons name="search" size={18} color={ui.colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={
                    searchTab === 'players'
                      ? 'Nombre o apodo (mín. 2 letras)'
                      : 'Nombre, ciudad o zona (mín. 2 letras)'
                  }
                  placeholderTextColor={ui.colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    fontSize: 15,
                    color: ui.colors.textPrimary,
                  }}
                />
                {query.length > 0 ? (
                  <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={ui.colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {isLoading ? (
              <ActivityIndicator style={{ marginVertical: 24 }} color={ui.colors.primary} />
            ) : searchTab === 'players' ? (
              <FlatList
                data={playerResults}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 400 }}
                ListEmptyComponent={
                  <Text
                    style={{
                      textAlign: 'center',
                      color: ui.colors.textMuted,
                      paddingVertical: 24,
                      paddingHorizontal: 16,
                    }}
                  >
                    {resultsEmptyHint}
                  </Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => goToPlayer(item)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingHorizontal: ui.spacing.lg,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: ui.colors.border,
                    }}
                  >
                    <Avatar name={item.name} photo={item.photo} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>{item.name}</Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
                        {item.levelCategory || 'Sin categoría'}
                        {item.skillScore != null ? ` · ${formatSkillScore(item.skillScore)}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
            ) : (
              <FlatList
                data={clubResults}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 400 }}
                ListEmptyComponent={
                  <Text
                    style={{
                      textAlign: 'center',
                      color: ui.colors.textMuted,
                      paddingVertical: 24,
                      paddingHorizontal: 16,
                    }}
                  >
                    {resultsEmptyHint}
                  </Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => goToClub(item)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingHorizontal: ui.spacing.lg,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: ui.colors.border,
                    }}
                  >
                    <Avatar name={item.name} photo={item.logo_url} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>{item.name}</Text>
                      {(item.zone || item.city || item.address) ? (
                        <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                          {[item.zone, item.city, item.address].filter(Boolean).join(' · ')}
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>Club</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                  </Pressable>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView contentContainerStyle={tabScreenPadding}>
        <Text
          style={{
            fontSize: 15,
            color: ui.colors.textSecondary,
            marginBottom: 20,
            lineHeight: 22,
          }}
        >
          Armá un partido, buscá uno cerca o creá un torneo.
        </Text>

        <PressableScale
          onPress={() => router.push('/create-open-match' as any)}
          accessibilityRole="button"
          accessibilityLabel="Crear partido abierto"
          style={{ marginBottom: 14 }}
        >
          <AppCard
            style={{
              borderWidth: 1,
              borderColor: ui.colors.primary,
              backgroundColor: ui.colors.primarySoft,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: ui.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="add" size={28} color={ui.colors.onPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: ui.colors.textPrimary }}>
                  Crear partido abierto
                </Text>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 4 }}>
                  Invitá jugadores. Con o sin cancha reservada.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={ui.colors.textMuted} />
            </View>
          </AppCard>
        </PressableScale>

        <PressableScale
          onPress={() => router.push('/browse-open-matches' as any)}
          accessibilityRole="button"
          accessibilityLabel="Buscar partidos"
          style={{ marginBottom: 14 }}
        >
          <AppCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: ui.colors.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="search" size={24} color={ui.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: ui.colors.textPrimary }}>
                  Buscar partidos
                </Text>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 4 }}>
                  De tu categoría, ordenados por cercanía.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={ui.colors.textMuted} />
            </View>
          </AppCard>
        </PressableScale>

        <PressableScale
          onPress={() =>
            router.push({ pathname: '/(tabs)/organizer', params: { create: 'tournament' } } as any)
          }
          accessibilityRole="button"
          accessibilityLabel="Crear torneo"
          style={{ marginBottom: 24 }}
        >
          <AppCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: ui.colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="trophy" size={24} color={ui.colors.accentDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: ui.colors.textPrimary }}>
                  Crear torneo
                </Text>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 4 }}>
                  Definí categoría, formato e inscripciones.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={ui.colors.textMuted} />
            </View>
          </AppCard>
        </PressableScale>

        <PrimaryButton
          label="Matchmaking automático"
          variant="ghost"
          onPress={() => router.push('/auto-matchmaking' as any)}
        />
        <Text
          style={{
            fontSize: 12,
            color: ui.colors.textMuted,
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 18,
          }}
        >
          Armamos un partido con jugadores disponibles en tu franja.
        </Text>
      </ScrollView>
    </Screen>
  );
}
