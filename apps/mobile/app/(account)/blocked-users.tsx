import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  Avatar,
  EmptyState,
  PrimaryButton,
  SkeletonCard,
} from '@/components/x4match';

type BlockedUser = {
  user_id: string;
  name: string;
  nickname?: string | null;
  photo_url?: string | null;
  blocked_at?: string;
};

export default function BlockedUsersScreen() {
  const queryClient = useQueryClient();

  const {
    data: blocked = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: async () => {
      const res = await api.get('/reports/blocked');
      return (Array.isArray(res.data) ? res.data : []) as BlockedUser[];
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/reports/block/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      queryClient.invalidateQueries({ queryKey: ['community-nearby-players'] });
      queryClient.invalidateQueries({ queryKey: ['home-open-matches'] });
      queryClient.invalidateQueries({ queryKey: ['player-profile'] });
      Alert.alert('Desbloqueado', 'Ya podés volver a ver e interactuar con este jugador.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo desbloquear');
    },
  });

  const confirmUnblock = (entry: BlockedUser) => {
    const label = entry.nickname || entry.name;
    Alert.alert('Desbloquear', `¿Desbloquear a ${label}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desbloquear',
        onPress: () => unblockMutation.mutate(entry.user_id),
      },
    ]);
  };

  return (
    <Screen>
      <StackHeader title="Bloqueados" />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={ui.colors.primary}
          />
        }
      >
        <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
          Los jugadores que bloqueás no aparecen en cercanos, no pueden unirse a tus partidos ni ver tu perfil.
        </Text>

        {isLoading ? (
          <View style={{ gap: 10 }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : blocked.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="shield-checkmark-outline" size={36} color={ui.colors.textMuted} />}
            title="Nadie bloqueado"
            description="Cuando bloquees a alguien, va a aparecer acá para que puedas desbloquearlo."
          />
        ) : (
          blocked.map((entry) => {
            const displayName = entry.nickname || entry.name;
            return (
              <AppCard key={entry.user_id} padding="sm" style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={displayName} photo={entry.photo_url} size="md" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontWeight: '700', color: ui.colors.textPrimary, fontSize: 15 }}
                    >
                      {displayName}
                    </Text>
                    {entry.blocked_at ? (
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                        Bloqueado · {formatShortDate(entry.blocked_at)}
                      </Text>
                    ) : null}
                  </View>
                  <PrimaryButton
                    label="Desbloquear"
                    size="sm"
                    variant="outline"
                    loading={
                      unblockMutation.isPending && unblockMutation.variables === entry.user_id
                    }
                    onPress={() => confirmUnblock(entry)}
                  />
                </View>
              </AppCard>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
