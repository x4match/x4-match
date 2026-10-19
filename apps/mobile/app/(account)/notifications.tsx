import { useRef, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '@/lib/format';
import { getNotificationRoute } from '@/lib/notifications/notification-route';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, EmptyState } from '@/components/x4match';

function getNotificationIcon(type: string): { name: keyof typeof Ionicons.glyphMap; color: string; bg: string } {
  switch (type) {
    case 'MATCH_INVITE':
    case 'MATCH_PLAYER_JOINED':
    case 'MATCH_JOIN_REQUEST':
      return { name: 'tennisball', color: ui.colors.primary, bg: ui.colors.primarySoft };
    case 'MATCH_CONFIRMED':
    case 'MATCH_COURT_BOOKED':
    case 'MATCH_JOIN_ACCEPTED':
      return { name: 'checkmark-circle', color: ui.colors.success, bg: ui.colors.successSoft };
    case 'MATCH_CANCELLED':
    case 'MATCH_CANCELED':
    case 'MATCH_COURT_LOST':
    case 'MATCH_RESULT_REJECTED':
    case 'MATCH_JOIN_REJECTED':
      return { name: 'close-circle', color: ui.colors.danger, bg: ui.colors.dangerSoft };
    case 'MATCH_RESULT_SUBMITTED':
    case 'MATCH_ORGANIZER_TRANSFERRED':
      return { name: 'flag', color: ui.colors.warning, bg: ui.colors.warningSoft };
    case 'MATCH_REMINDER':
      return { name: 'alarm', color: ui.colors.warning, bg: ui.colors.warningSoft };
    case 'MATCH_CHAT_MESSAGE':
      return { name: 'chatbubbles', color: ui.colors.primary, bg: ui.colors.primarySoft };
    case 'RANKING_OVERTAKEN':
      return { name: 'trending-up', color: ui.colors.warning, bg: ui.colors.warningSoft };
    case 'RANKING_WEEKLY_WINNER':
      return { name: 'trophy', color: ui.colors.accent, bg: ui.colors.accentSoft };
    case 'FRIEND_REQUEST':
    case 'FRIEND_ACCEPTED':
    case 'NEW_FOLLOWER':
      return { name: 'person-add', color: ui.colors.primary, bg: ui.colors.primarySoft };
    case 'DM_MESSAGE':
    case 'DM_REQUEST':
    case 'DM_REQUEST_ACCEPTED':
      return { name: 'chatbubble', color: ui.colors.primary, bg: ui.colors.primarySoft };
    case 'COURT_SLOT_AVAILABLE':
    case 'COURT_GAP_OFFER':
    case 'OPEN_MATCH_CREATED':
      return { name: 'tennisball', color: ui.colors.primary, bg: ui.colors.primarySoft };
    case 'REWARD_REDEEMED':
    case 'REWARD_FULFILLED':
      return { name: 'gift', color: ui.colors.accent, bg: ui.colors.accentSoft };
    case 'REWARD_CANCELLED':
      return { name: 'gift', color: ui.colors.danger, bg: ui.colors.dangerSoft };
    case 'CLUB_CHALLENGE':
      return { name: 'flash', color: ui.colors.accent, bg: ui.colors.accentSoft };
    case 'CLUB_SEGMENT_CAMPAIGN':
      return { name: 'megaphone', color: ui.colors.primary, bg: ui.colors.primarySoft };
    case 'BADGE_EARNED':
    case 'badge_earned':
      return { name: 'medal', color: ui.colors.accent, bg: ui.colors.accentSoft };
    case 'MASTER_REGISTRATION':
    case 'MASTER_UPDATE':
      return { name: 'ribbon', color: ui.colors.accent, bg: ui.colors.accentSoft };
    default:
      return { name: 'notifications', color: ui.colors.textMuted, bg: ui.colors.surfaceAlt };
  }
}

function SwipeToDeleteRow({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
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
          accessibilityLabel="Borrar notificación"
          style={{
            backgroundColor: ui.colors.danger,
            justifyContent: 'center',
            alignItems: 'center',
            width: 88,
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

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onMutate: (id: string) => {
      queryClient.setQueryData<any[]>(['notifications'], (prev) =>
        prev?.filter((n) => n.id !== id),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo borrar la notificación'),
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => api.delete('/notifications'),
    onSuccess: () => {
      queryClient.setQueryData(['notifications'], []);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.message || 'No se pudieron borrar las notificaciones'),
  });

  const handlePress = (notification: any) => {
    if (!notification.read) markReadMutation.mutate(notification.id);
    const route = getNotificationRoute(notification.type, notification.data || {});
    if (route) router.push(route as any);
  };

  const confirmDelete = (notification: any) => {
    Alert.alert('Borrar notificación', '¿Querés borrar esta notificación?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => deleteMutation.mutate(notification.id) },
    ]);
  };

  const confirmDeleteAll = () => {
    Alert.alert('Borrar todas', '¿Querés borrar todas tus notificaciones?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar todas', style: 'destructive', onPress: () => deleteAllMutation.mutate() },
    ]);
  };

  const hasUnread = notifications?.some((n: any) => !n.read);
  const hasNotifications = (notifications?.length ?? 0) > 0;

  return (
    <Screen>
      <StackHeader title="Notificaciones" />
      {hasNotifications && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: ui.spacing.lg,
            paddingBottom: ui.spacing.sm,
          }}
        >
          {hasUnread ? (
            <TouchableOpacity onPress={() => markAllReadMutation.mutate()} activeOpacity={0.7}>
              <Text style={{ color: ui.colors.primary, fontSize: 13, fontWeight: '600' }}>Marcar todas como leídas</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity
            onPress={confirmDeleteAll}
            disabled={deleteAllMutation.isPending}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Text style={{ color: ui.colors.danger, fontSize: 13, fontWeight: '600' }}>Borrar todas</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications || []}
        keyExtractor={(item: any) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={ui.colors.primary} />}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        ListEmptyComponent={
          <EmptyState
            icon={<Ionicons name="notifications-off-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin notificaciones"
            description="Te avisaremos cuando haya novedades sobre partidos y torneos"
          />
        }
        renderItem={({ item }: { item: any }) => {
          const icon = getNotificationIcon(item.type);
          return (
            <SwipeToDeleteRow onDelete={() => deleteMutation.mutate(item.id)}>
            <TouchableOpacity
              style={{
                paddingHorizontal: ui.spacing.lg,
                paddingVertical: ui.spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: ui.colors.surfaceAlt,
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: !item.read ? ui.colors.surface : ui.colors.bg,
              }}
              onPress={() => handlePress(item)}
              onLongPress={() => confirmDelete(item)}
              accessibilityHint="Mantené presionado o deslizá a la izquierda para borrar"
              activeOpacity={0.7}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: icon.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name={icon.name} size={20} color={icon.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: ui.colors.textInverse, flex: 1, marginRight: 8 }}>
                    {item.title}
                  </Text>
                  {!item.read && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ui.colors.accent }} />
                  )}
                </View>
                <Text style={{ color: ui.colors.textMuted, fontSize: 13, marginBottom: 6 }}>{item.body}</Text>
                <Text style={{ color: ui.colors.textMuted, fontSize: 11 }}>
                  {formatRelativeTime(item.createdAt || item.created_at)}
                </Text>
              </View>
            </TouchableOpacity>
            </SwipeToDeleteRow>
          );
        }}
      />
    </Screen>
  );
}
