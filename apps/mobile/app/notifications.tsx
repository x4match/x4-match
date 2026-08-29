import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '@/lib/format';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, EmptyState } from '@/components/padely';

function getNotificationIcon(type: string): { name: keyof typeof Ionicons.glyphMap; color: string; bg: string } {
  switch (type) {
    case 'MATCH_INVITE':
      return { name: 'tennisball', color: ui.colors.primary, bg: ui.colors.primarySoft };
    case 'MATCH_CONFIRMED':
      return { name: 'checkmark-circle', color: ui.colors.success, bg: ui.colors.successSoft };
    case 'MATCH_CANCELED':
      return { name: 'close-circle', color: ui.colors.danger, bg: ui.colors.dangerSoft };
    case 'RANKING_OVERTAKEN':
      return { name: 'trending-up', color: ui.colors.warning, bg: ui.colors.warningSoft };
    case 'RANKING_WEEKLY_WINNER':
      return { name: 'trophy', color: ui.colors.accent, bg: ui.colors.accentSoft };
    case 'FRIEND_REQUEST':
      return { name: 'person-add', color: ui.colors.primary, bg: ui.colors.primarySoft };
    case 'COURT_SLOT_AVAILABLE':
      return { name: 'tennisball', color: ui.colors.primary, bg: ui.colors.primarySoft };
    case 'REWARD_REDEEMED':
      return { name: 'gift', color: ui.colors.accent, bg: ui.colors.accentSoft };
    case 'MASTER_REGISTRATION':
    case 'MASTER_UPDATE':
      return { name: 'ribbon', color: ui.colors.accent, bg: ui.colors.accentSoft };
    default:
      return { name: 'notifications', color: ui.colors.textMuted, bg: ui.colors.surfaceAlt };
  }
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

  const handlePress = (notification: any) => {
    if (!notification.read) markReadMutation.mutate(notification.id);
    const data = notification.data || {};
    if (notification.type === 'FRIEND_REQUEST') {
      if (data.fromUserId) router.push(`/player/${data.fromUserId}` as any);
      else router.push('/(tabs)/messages' as any);
      return;
    }
    if (data.matchId) router.push(`/match/${data.matchId}` as any);
    else if (data.clubId) router.push(`/club/${data.clubId}` as any);
    else if (notification.type === 'COURT_SLOT_AVAILABLE' && data.clubId) {
      router.push(`/club/${data.clubId}` as any);
    }
    else if (data.eventId || data.tournamentId) router.push(`/tournament/${data.eventId || data.tournamentId}` as any);
  };

  const hasUnread = notifications?.some((n: any) => !n.read);

  return (
    <Screen>
      <StackHeader title="Notificaciones" />
      {hasUnread && (
        <View style={{ paddingHorizontal: ui.spacing.lg, paddingBottom: ui.spacing.sm }}>
          <TouchableOpacity onPress={() => markAllReadMutation.mutate()} activeOpacity={0.7}>
            <Text style={{ color: ui.colors.primary, fontSize: 13, fontWeight: '600' }}>Marcar todas como leídas</Text>
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
          );
        }}
      />
    </Screen>
  );
}
