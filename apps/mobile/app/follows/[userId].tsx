import { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, Avatar, EmptyState } from '@/components/x4match';

type FollowTab = 'followers' | 'following';

type FollowUser = {
  user_id: string;
  name: string;
  photo?: string | null;
  photo_url?: string | null;
  nickname?: string | null;
};

export default function FollowsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId: string;
    tab?: string;
    name?: string;
  }>();
  const userId = params.userId;
  const initialTab: FollowTab = params.tab === 'following' ? 'following' : 'followers';
  const [tab, setTab] = useState<FollowTab>(initialTab);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['follows-list', userId, tab],
    queryFn: async () => {
      const path = tab === 'followers' ? 'followers' : 'following';
      const res = await api.get(`/follows/${path}/${userId}`, { params: { limit: 100 } });
      return (res.data ?? []) as FollowUser[];
    },
    enabled: !!userId,
  });

  const title = useMemo(() => {
    if (params.name) return params.name;
    return tab === 'followers' ? 'Seguidores' : 'Seguidos';
  }, [params.name, tab]);

  const emptyTitle = tab === 'followers' ? 'Sin seguidores' : 'Sin seguidos';
  const emptyDescription =
    tab === 'followers'
      ? 'Cuando alguien te siga va a aparecer acá'
      : 'Todavía no seguís a nadie';

  return (
    <Screen>
      <StackHeader title={title} />
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: ui.spacing.lg,
          marginBottom: ui.spacing.sm,
          backgroundColor: ui.colors.surface,
          borderRadius: ui.radius.md,
          padding: 4,
          borderWidth: 1,
          borderColor: ui.colors.border,
        }}
      >
        {(
          [
            { key: 'followers', label: 'Seguidores' },
            { key: 'following', label: 'Seguidos' },
          ] as const
        ).map((item) => {
          const active = tab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setTab(item.key)}
              activeOpacity={0.85}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: ui.radius.sm,
                alignItems: 'center',
                backgroundColor: active ? ui.colors.primarySoft : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: active ? ui.colors.primary : ui.colors.textMuted,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading && !data ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ui.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.user_id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={ui.colors.primary}
            />
          }
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: ui.spacing.lg,
            paddingBottom: 32,
          }}
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="people-outline" size={32} color={ui.colors.textMuted} />}
              title={emptyTitle}
              description={emptyDescription}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/player/${item.user_id}` as any)}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: ui.colors.surfaceAlt,
              }}
            >
              <Avatar name={item.name} photo={item.photo_url || item.photo} size="md" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: ui.colors.textPrimary }}>
                  {item.name}
                </Text>
                {item.nickname ? (
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
                    @{item.nickname}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </Screen>
  );
}
