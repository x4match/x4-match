import { useState, useRef, useMemo, type ReactNode } from 'react';
import {
  Text,
  View,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Pressable,
  TextInput,
  type TextStyle,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { mapMatch } from '@/lib/mappers';
import type { DirectConversation, Match } from '@/lib/types';
import { formatShortDate, formatTime, formatRelativeTime } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { ui, fontFamily } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import { Screen, AppCard, Avatar, PrimaryButton, TabScrollView } from '@/components/x4match';
import {
  MessagesChatIcon,
  MESSAGES_CHAT_ICON_SIZE,
} from '@/components/x4match/MessagesChatIcon';
import {
  MessagesBrandMark,
  MESSAGES_BRAND_MARK_SIZE,
} from '@/components/x4match/MessagesBrandMark';
import { MatchesCalendarIcon } from '@/components/x4match/MatchesIcons';
import { TourTarget, useScreenTour, type TourStep } from '@/components/tour/ScreenTour';

const MESSAGES_TOUR_STEPS: TourStep[] = [
  {
    target: 'messages.tabs',
    fixed: true,
    title: 'Directos y Partidos',
    description:
      '"Directos" son tus chats uno a uno y las solicitudes de mensaje. "Partidos" tiene el chat grupal de cada partido en el que estás anotado.',
  },
  {
    target: 'messages.search',
    fixed: true,
    title: 'Buscar chats',
    description: 'Encontrá rápido una conversación por nombre o por partido.',
  },
];

const CHAT_STATUSES = ['OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS', 'FINISHED'];

type MessagesTab = 'direct' | 'matches';

function SectionLabel({ children, style }: { children: string; style?: TextStyle }) {
  return (
    <Text
      style={[
        {
          fontSize: 13,
          fontFamily: fontFamily.bold,
          color: ui.colors.textMuted,
          marginBottom: 8,
          textTransform: 'uppercase',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function SwipeToDeleteRow({
  onDelete,
  children,
}: {
  onDelete: () => void;
  children: ReactNode;
}) {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
      renderRightActions={() => (
        <TouchableOpacity
          onPress={() => {
            swipeRef.current?.close();
            onDelete();
          }}
          activeOpacity={0.85}
          accessibilityLabel="Borrar chat"
          style={{
            backgroundColor: ui.colors.danger,
            justifyContent: 'center',
            alignItems: 'center',
            width: 88,
            marginBottom: ui.spacing.sm,
            borderRadius: ui.radius.lg,
          }}
        >
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 }}>Borrar</Text>
        </TouchableOpacity>
      )}
    >
      {children}
    </Swipeable>
  );
}

function GlassEmpty({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <AppCard
      padding="lg"
      style={{
        marginBottom: ui.spacing.lg,
        backgroundColor: '#111115',
        borderRadius: 22,
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 8, gap: 12 }}>
        {icon}
        <View style={{ alignItems: 'center', gap: 6, maxWidth: 240 }}>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 22.5,
              fontFamily: fontFamily.regular,
              color: ui.colors.textPrimary,
              textAlign: 'center',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 19.5,
              fontFamily: fontFamily.regular,
              color: '#8E8E9F',
              textAlign: 'center',
            }}
          >
            {description}
          </Text>
        </View>
      </View>
    </AppCard>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isClubAccount = isClub(user?.role);
  const [tab, setTab] = useState<MessagesTab>('direct');
  useScreenTour('messages', MESSAGES_TOUR_STEPS, { enabled: !isClubAccount });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const { data: conversations, isLoading: loadingDm, refetch: refetchDm } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get('/conversations');
      return res.data as DirectConversation[];
    },
  });

  const { data: pendingRequests, refetch: refetchPending } = useQuery({
    queryKey: ['conversations-pending'],
    queryFn: async () => {
      const res = await api.get('/conversations/pending');
      return res.data as any[];
    },
  });

  const { data: matches, isLoading: loadingMatches, refetch: refetchMatches } = useQuery({
    queryKey: ['my-matches-messages'],
    queryFn: async () => {
      const res = await api.get('/matches/me');
      return res.data;
    },
    enabled: !isClubAccount,
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-pending'] });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/conversations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-pending'] });
      queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo borrar el chat'),
  });

  const openSenderProfile = (userId?: string | null, clubId?: string | null) => {
    if (clubId) router.push(`/club/${clubId}` as any);
    else if (userId) router.push(`/player/${userId}` as any);
  };

  const confirmDeleteConversation = (id: string, name: string) => {
    Alert.alert(
      'Borrar chat',
      `¿Querés borrar el chat con ${name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () => deleteConversationMutation.mutate(id),
        },
      ],
    );
  };

  const cancelMessageRequestMutation = useMutation({
    mutationFn: (conversationId: string) => api.post(`/conversations/${conversationId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-pending'] });
      queryClient.invalidateQueries({ queryKey: ['message-access'] });
      Alert.alert('Listo', 'Solicitud de mensaje cancelada');
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo cancelar la solicitud'),
  });

  const onRefresh = () => {
    refetchDm();
    refetchPending();
    if (!isClubAccount) {
      refetchMatches();
    }
  };

  const isLoading = loadingDm || (!isClubAccount && loadingMatches);
  const searchNormalized = searchQuery.trim().toLowerCase();

  const matchesSearch = (parts: Array<string | null | undefined>) => {
    if (!searchNormalized) return true;
    return parts.some((p) => (p || '').toLowerCase().includes(searchNormalized));
  };

  const activeConversations = useMemo(
    () =>
      (conversations || []).filter(
        (c) =>
          c.status === 'active' &&
          matchesSearch([c.other_user_name, c.last_message]),
      ),
    [conversations, searchNormalized],
  );
  const pendingOutgoing = useMemo(
    () =>
      (conversations || []).filter(
        (c) => c.status === 'pending' && matchesSearch([c.other_user_name]),
      ),
    [conversations, searchNormalized],
  );
  const filteredPendingRequests = useMemo(
    () =>
      (pendingRequests || []).filter((req: any) =>
        matchesSearch([req.from_user_name]),
      ),
    [pendingRequests, searchNormalized],
  );
  const matchConversations: Match[] = useMemo(
    () =>
      (matches || [])
        .map(mapMatch)
        .filter((m: Match) => CHAT_STATUSES.includes(m.status))
        .filter((m: Match) => matchesSearch([m.title, m.club?.name]))
        .sort((a: Match, b: Match) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [matches, searchNormalized],
  );

  const tabs: { value: MessagesTab; label: string; hidden?: boolean }[] = [
    { value: 'direct', label: 'Directos' },
    { value: 'matches', label: 'Partidos', hidden: isClubAccount },
  ];
  const visibleTabs = tabs.filter((t) => !t.hidden);

  const directEmptyDescription = isClubAccount
    ? 'Contactá jugadores desde su perfil para iniciar una conversación'
    : 'Si te siguen podés escribirles directo; si no, enviá una solicitud de mensaje';

  const hasDirectContent =
    filteredPendingRequests.length > 0 ||
    pendingOutgoing.length > 0 ||
    activeConversations.length > 0;

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 24, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text
            style={{
              flex: 1,
              fontSize: 28,
              lineHeight: 42,
              letterSpacing: -0.56,
              fontFamily: fontFamily.regular,
              color: ui.colors.textPrimary,
            }}
          >
            Mensajes
          </Text>
          <TourTarget id="messages.search">
            <TouchableOpacity
              onPress={() => (searchOpen ? closeSearch() : openSearch())}
              accessibilityLabel={searchOpen ? 'Cerrar búsqueda' : 'Buscar chat'}
              hitSlop={10}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: searchOpen ? 'rgba(215,255,0,0.12)' : 'transparent',
              }}
            >
              <Ionicons
                name={searchOpen ? 'close' : 'search'}
                size={22}
                color={searchOpen ? ui.colors.primary : ui.colors.textPrimary}
              />
            </TouchableOpacity>
          </TourTarget>
        </View>

        {searchOpen ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginTop: 8,
              marginBottom: 4,
              borderWidth: 1,
              borderColor: ui.colors.border,
              borderRadius: 14,
              backgroundColor: '#111115',
              paddingHorizontal: 12,
              minHeight: 44,
            }}
          >
            <Ionicons name="search" size={18} color="#8E8E9F" />
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={tab === 'matches' ? 'Buscar chat de partido…' : 'Buscar chat…'}
              placeholderTextColor="#8E8E9F"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={{
                flex: 1,
                color: ui.colors.textPrimary,
                fontSize: 15,
                fontFamily: fontFamily.regular,
                paddingVertical: 10,
              }}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#8E8E9F" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      <TourTarget
        id="messages.tabs"
        style={{
          flexDirection: 'row',
          marginHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: ui.colors.border,
        }}
      >
        {visibleTabs.map((item) => {
          const active = tab === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setTab(item.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 9,
                borderBottomWidth: 1,
                borderBottomColor: active ? ui.colors.primary : 'transparent',
                marginBottom: -1,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 21,
                  fontFamily: active ? fontFamily.bold : fontFamily.medium,
                  color: active ? ui.colors.primary : '#8E8E9F',
                  textAlign: 'center',
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </TourTarget>

      <View style={{ flex: 1 }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '42%',
            alignItems: 'center',
            zIndex: 0,
          }}
        >
          <MessagesBrandMark
            width={MESSAGES_BRAND_MARK_SIZE.width}
            height={MESSAGES_BRAND_MARK_SIZE.height}
          />
        </View>
        <TabScrollView
          contentContainerStyle={{ ...tabScreenPadding, paddingTop: 20, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={ui.colors.primary} />
          }
        >
          {tab === 'direct' ? (
            <>
              {(filteredPendingRequests.length ?? 0) > 0 && (
                <>
                  <SectionLabel>Solicitudes de mensaje</SectionLabel>
                  {filteredPendingRequests.map((req: any) => (
                    <AppCard key={req.id} style={{ marginBottom: 8 }}>
                      <TouchableOpacity
                        onPress={() => openSenderProfile(req.from_user_id, req.from_club_id)}
                        activeOpacity={0.85}
                        disabled={!req.from_user_id && !req.from_club_id}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Avatar name={req.from_user_name} photo={req.from_user_photo} size="md" />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                              {req.from_user_name}
                            </Text>
                            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                              Quiere enviarte mensajes · Tocá para ver perfil
                            </Text>
                          </View>
                          <Ionicons
                            name={req.from_club_id ? 'business-outline' : 'person-outline'}
                            size={18}
                            color={ui.colors.textMuted}
                          />
                        </View>
                      </TouchableOpacity>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton
                            label="Aceptar"
                            size="sm"
                            fullWidth
                            onPress={() =>
                              acceptMutation.mutate(req.id, {
                                onSuccess: () =>
                                  router.push({
                                    pathname: `/conversation/${req.id}` as any,
                                    params: {
                                      name: req.from_user_name,
                                      status: 'active',
                                      userId: req.from_user_id,
                                      clubId: req.from_club_id ?? undefined,
                                    },
                                  }),
                              })
                            }
                            loading={acceptMutation.isPending}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton
                            label="Ver chat"
                            size="sm"
                            variant="ghost"
                            fullWidth
                            onPress={() =>
                              router.push({
                                pathname: `/conversation/${req.id}` as any,
                                params: {
                                  name: req.from_user_name,
                                  status: 'pending',
                                  userId: req.from_user_id,
                                  clubId: req.from_club_id ?? undefined,
                                },
                              })
                            }
                            style={{ backgroundColor: ui.colors.surface }}
                          />
                        </View>
                      </View>
                    </AppCard>
                  ))}
                </>
              )}

              {pendingOutgoing.length > 0 && (
                <>
                  <SectionLabel style={{ marginTop: 12 }}>Esperando respuesta</SectionLabel>
                  {pendingOutgoing.map((c) => (
                    <AppCard key={c.id} padding="sm" style={{ marginBottom: 8 }}>
                      <TouchableOpacity
                        onPress={
                          c.other_user_id || c.other_club_id
                            ? () => openSenderProfile(c.other_user_id, c.other_club_id)
                            : undefined
                        }
                        activeOpacity={0.85}
                        disabled={!(c.other_user_id || c.other_club_id)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Avatar name={c.other_user_name} photo={c.other_user_photo} size="sm" />
                          <Text style={{ flex: 1, fontSize: 14, color: ui.colors.textSecondary }}>
                            Solicitud enviada a{' '}
                            <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
                              {c.other_user_name}
                            </Text>
                          </Text>
                          <Ionicons
                            name={c.other_club_id ? 'business-outline' : 'person-outline'}
                            size={18}
                            color={ui.colors.textMuted}
                          />
                        </View>
                      </TouchableOpacity>
                      <View style={{ marginTop: 10 }}>
                        <PrimaryButton
                          label="Cancelar solicitud"
                          size="sm"
                          variant="ghost"
                          fullWidth
                          onPress={() => cancelMessageRequestMutation.mutate(c.id)}
                          loading={cancelMessageRequestMutation.isPending}
                          style={{ backgroundColor: ui.colors.surface }}
                        />
                      </View>
                    </AppCard>
                  ))}
                </>
              )}

              {!hasDirectContent && !loadingDm ? (
                <GlassEmpty
                  icon={
                    <MessagesChatIcon
                      width={MESSAGES_CHAT_ICON_SIZE.width}
                      height={MESSAGES_CHAT_ICON_SIZE.height}
                    />
                  }
                  title={searchNormalized ? 'Sin resultados' : 'Sin chats directos'}
                  description={
                    searchNormalized
                      ? `No hay chats que coincidan con “${searchQuery.trim()}”`
                      : directEmptyDescription
                  }
                />
              ) : activeConversations.length > 0 ? (
                <>
                  {(filteredPendingRequests.length > 0 || pendingOutgoing.length > 0) && (
                      <SectionLabel style={{ marginTop: 12 }}>Chats directos</SectionLabel>
                    )}
                  {activeConversations.map((c) => (
                    <SwipeToDeleteRow
                      key={c.id}
                      onDelete={() => confirmDeleteConversation(c.id, c.other_user_name)}
                    >
                      <AppCard
                        onPress={() =>
                          router.push({
                            pathname: `/conversation/${c.id}` as any,
                            params: {
                              name: c.other_user_name,
                              status: 'active',
                              userId: c.other_user_id,
                              clubId: c.other_club_id ?? undefined,
                            },
                          })
                        }
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Avatar name={c.other_user_name} photo={c.other_user_photo} size="md" />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{ fontWeight: '700', fontSize: 15, color: ui.colors.textPrimary }}
                            >
                              {c.other_user_name}
                            </Text>
                            {c.last_message ? (
                              <Text
                                style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 2 }}
                                numberOfLines={1}
                              >
                                {c.last_message}
                              </Text>
                            ) : null}
                          </View>
                          {c.last_message_at ? (
                            <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>
                              {formatRelativeTime(c.last_message_at)}
                            </Text>
                          ) : null}
                          <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                        </View>
                      </AppCard>
                    </SwipeToDeleteRow>
                  ))}
                </>
              ) : null}
            </>
          ) : (
            <>
              {matchConversations.length === 0 && !loadingMatches ? (
                <GlassEmpty
                  icon={
                    <MatchesCalendarIcon
                      width={MESSAGES_CHAT_ICON_SIZE.width}
                      height={MESSAGES_CHAT_ICON_SIZE.height}
                    />
                  }
                  title={searchNormalized ? 'Sin resultados' : 'Sin chats de partido'}
                  description={
                    searchNormalized
                      ? `No hay partidos que coincidan con “${searchQuery.trim()}”`
                      : 'Los chats de tus partidos aparecerán acá'
                  }
                />
              ) : (
                matchConversations.map((match) => (
                  <AppCard key={match.id} onPress={() => router.push(`/match/${match.id}` as any)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: ui.colors.primarySoft,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="chatbubble" size={22} color={ui.colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ fontWeight: '700', fontSize: 15, color: ui.colors.textPrimary }}
                          numberOfLines={1}
                        >
                          {match.title}
                        </Text>
                        <Text
                          style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 2 }}
                          numberOfLines={1}
                        >
                          {match.club?.name || 'Partido'} · {formatShortDate(match.date)}{' '}
                          {formatTime(match.date)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={ui.colors.textMuted} />
                    </View>
                  </AppCard>
                ))
              )}
            </>
          )}
        </TabScrollView>
      </View>
    </Screen>
  );
}
