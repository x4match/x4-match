import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Keyboard,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { resolveSkillScore } from '@/lib/skill';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  AppHeader,
  Avatar,
  TabScrollView,
  SegmentedControl,
  KeyboardAvoid,
} from '@/components/x4match';
import { OrganizerModule } from '@/components/organizer/OrganizerModule';
import { PressableScale } from '@/components/ui';
import { TourTarget, useScreenTour, type TourStep } from '@/components/tour/ScreenTour';

const SEARCH_TOUR_STEPS: TourStep[] = [
  {
    target: 'search.lookup',
    fixed: true,
    title: 'Buscar jugadores y clubes',
    description: 'Encontrá a cualquier jugador por nombre o nombre de usuario, o un club por nombre o ciudad.',
  },
  {
    target: 'search.mode',
    fixed: true,
    title: 'Jugador u Organizador',
    description: 'En "Jugador" armás y buscás partidos. En "Organizador" creás y gestionás tus torneos y circuitos.',
  },
  {
    target: 'search.create',
    title: 'Crear partido abierto',
    description:
      'Elegí fecha, horario, modo (amistoso o competitivo), tipo de partido y cancha. Podés invitar a tu compañero y rivales o dejar los cupos abiertos.',
  },
  {
    target: 'search.browse',
    title: 'Buscar partidos',
    description: 'Partidos abiertos de tu categoría ordenados por cercanía. Sumate directo o pedí unirte.',
  },
  {
    target: 'search.auto',
    title: 'Matchmaking automático',
    description: 'Indicá cuándo podés jugar y armamos el partido con jugadores disponibles de tu nivel.',
  },
];

const LISTON = require('../../assets/figma/match/liston.png');

const CARD_BG = '#111115';

type SearchTab = 'players' | 'clubs';
type PlayMode = 'player' | 'organizer';

type PlayerSearchHit = {
  id: string;
  userId: string;
  name: string;
  nickname?: string;
  photo?: string;
  skillScore?: number;
  levelCategory?: string;
};

type ClubSearchHit = {
  id: string;
  name: string;
  city?: string;
  location?: string;
  address?: string;
  logo_url?: string;
};

function PlayActionCard({
  title,
  subtitle,
  icon,
  featured,
  showListon,
  onPress,
  accessibilityLabel,
  tourId,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  featured?: boolean;
  showListon?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  tourId: string;
}) {
  return (
    <TourTarget id={tourId} style={{ marginBottom: 12 }}>
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={{
          backgroundColor: CARD_BG,
          borderRadius: ui.radius.lg,
          borderWidth: 1,
          borderColor: featured ? ui.colors.primary : ui.colors.border,
          paddingVertical: 18,
          paddingHorizontal: 16,
          overflow: 'hidden',
          minHeight: 92,
          justifyContent: 'center',
        }}
      >
        {showListon ? (
          <Image
            source={LISTON}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: 200,
              height: 110,
            }}
            resizeMode="cover"
          />
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, zIndex: 1 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: ui.colors.surface0,
              borderWidth: featured ? 1 : 0,
              borderColor: featured ? ui.colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </View>
          <View style={{ flex: 1, paddingRight: showListon ? 36 : 0 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: ui.colors.textPrimary,
                letterSpacing: -0.2,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 18,
                color: ui.colors.textSecondary,
                marginTop: 4,
              }}
            >
              {subtitle}
            </Text>
          </View>
        </View>
      </View>
    </PressableScale>
    </TourTarget>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [playMode, setPlayMode] = useState<PlayMode>('player');
  useScreenTour('search', SEARCH_TOUR_STEPS, { enabled: playMode === 'player' });
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
    const term = q.trim().replace(/^@+/, '');
    if (term.length < 2) {
      setPlayerResults([]);
      return;
    }
    setPlayerSearchLoading(true);
    try {
      const res = await api.get('/players/search', { params: { q: term } });
      const mapped: PlayerSearchHit[] = (res.data || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        userId: String(row.userId),
        name: String(row.name || row.nickname || 'Jugador'),
        nickname: row.nickname ? String(row.nickname) : undefined,
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
        const haystack = [club.name, club.city, club.location, club.address]
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
          <TourTarget id="search.lookup">
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
          </TourTarget>
        }
      />

      <Modal visible={searchOpen} animationType="slide" transparent onRequestClose={closeSearch}>
        <KeyboardAvoid
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <View
            style={{
              backgroundColor: ui.colors.card,
              borderTopLeftRadius: ui.radius.xl,
              borderTopRightRadius: ui.radius.xl,
              flex: 1,
              marginTop: insets.top + 16,
              paddingBottom: Math.max(insets.bottom, 24),
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
                      ? 'Nombre o @usuario (mín. 2 letras)'
                      : 'Nombre o ciudad (mín. 2 letras)'
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
                style={{ flex: 1 }}
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
                        {item.nickname ? `@${item.nickname} · ` : ''}
                        {item.levelCategory || 'Sin categoría'}
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
                style={{ flex: 1 }}
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
                      {item.city || item.location || item.address ? (
                        <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                          {[item.city, item.location, item.address].filter(Boolean).join(' · ')}
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
        </KeyboardAvoid>
      </Modal>

      <View style={{ paddingHorizontal: ui.spacing.lg, marginBottom: 12 }}>
        <TourTarget id="search.mode">
          <SegmentedControl
            options={[
              { value: 'player', label: 'Jugador' },
              { value: 'organizer', label: 'Organizador' },
            ]}
            value={playMode}
            onChange={setPlayMode}
          />
        </TourTarget>
      </View>

      {playMode === 'organizer' ? (
        <OrganizerModule />
      ) : (
      <TabScrollView contentContainerStyle={tabScreenPadding}>
        <Text
          style={{
            fontSize: 15,
            color: ui.colors.textSecondary,
            marginBottom: 22,
            lineHeight: 22,
          }}
        >
          Armá un partido o buscá uno cerca.
        </Text>

        <PlayActionCard
          title="Crear partido abierto"
          subtitle="Invitá jugadores. Con o sin cancha reservada."
          featured
          showListon
          tourId="search.create"
          accessibilityLabel="Crear partido abierto"
          onPress={() => router.push('/create-open-match' as any)}
          icon={<Ionicons name="add" size={28} color={ui.colors.primary} />}
        />

        <PlayActionCard
          title="Buscar partidos"
          subtitle="De tu categoría, ordenados por cercanía."
          tourId="search.browse"
          accessibilityLabel="Buscar partidos"
          onPress={() => router.push('/browse-open-matches' as any)}
          icon={<Ionicons name="search" size={22} color={ui.colors.primary} />}
        />

        <TourTarget id="search.auto" style={{ marginTop: 12 }}>
        <PressableScale
          onPress={() => router.push('/auto-matchmaking' as any)}
          accessibilityRole="button"
          accessibilityLabel="Matchmaking automático"
          style={{ paddingVertical: 4 }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: ui.colors.textSecondary,
              marginBottom: 6,
            }}
          >
            Matchmaking automático
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: ui.colors.textMuted,
            }}
          >
            Armamos un partido con jugadores disponibles en tu franja.
          </Text>
        </PressableScale>
        </TourTarget>
      </TabScrollView>
      )}
    </Screen>
  );
}
