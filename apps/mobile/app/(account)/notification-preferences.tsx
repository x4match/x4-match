import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Alert, AppState, Linking, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { api } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/notifications/push-notifications';
import { useMutedClubs, useToggleClubMute } from '@/lib/notifications/muted-clubs';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, Avatar, PrimaryButton, SkeletonCard } from '@/components/x4match';

type Category = 'matches' | 'chat' | 'tournaments' | 'social' | 'club_offers' | 'achievements';
type Preferences = Record<Category, boolean>;

const QUERY_KEY = ['notification-preferences'];

const CATEGORIES: {
  key: Category;
  title: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  {
    key: 'matches',
    title: 'Partidos',
    description: 'Invitaciones, desafíos, confirmaciones, resultados y recordatorios',
    icon: 'tennisball-outline',
  },
  {
    key: 'chat',
    title: 'Mensajes',
    description: 'Mensajes directos y chats de partidos',
    icon: 'chatbubbles-outline',
  },
  {
    key: 'tournaments',
    title: 'Torneos y circuitos',
    description: 'Rivales, horarios, inscripciones y novedades',
    icon: 'trophy-outline',
  },
  {
    key: 'social',
    title: 'Amigos y seguidores',
    description: 'Solicitudes de amistad y nuevos seguidores',
    icon: 'people-outline',
  },
  {
    key: 'club_offers',
    title: 'Ofertas de clubes',
    description: 'Canchas libres, partidos abiertos y promociones de clubes',
    icon: 'pricetag-outline',
  },
  {
    key: 'achievements',
    title: 'Logros y ranking',
    description: 'Insignias, cambios en el ranking y premios canjeados',
    icon: 'ribbon-outline',
  },
];

type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unknown';

function usePushPermission() {
  const [state, setState] = useState<PermissionState>('unknown');
  const [canAskAgain, setCanAskAgain] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      setState(current.status as PermissionState);
      setCanAskAgain(current.canAskAgain);
    } catch {
      setState('unknown');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { state, canAskAgain, refresh };
}

export default function NotificationPreferencesScreen() {
  const queryClient = useQueryClient();
  const permission = usePushPermission();
  const [enabling, setEnabling] = useState(false);

  const { data: preferences, isLoading, refetch, isRefetching } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await api.get('/notifications/preferences')).data as Preferences,
  });
  const { data: mutedClubs = [], refetch: refetchMuted } = useMutedClubs();
  const toggleMute = useToggleClubMute();

  const updateMutation = useMutation({
    mutationFn: async (changes: Partial<Preferences>) =>
      (await api.patch('/notifications/preferences', changes)).data as Preferences,
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Preferences>(QUERY_KEY);
      if (previous) queryClient.setQueryData(QUERY_KEY, { ...previous, ...changes });
      return { previous };
    },
    onError: (error: any, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo guardar la preferencia');
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });

  const enablePush = async () => {
    if (!permission.canAskAgain) {
      await Linking.openSettings();
      return;
    }
    setEnabling(true);
    try {
      await registerForPushNotifications();
      await permission.refresh();
    } finally {
      setEnabling(false);
    }
  };

  const pushBlocked = permission.state === 'denied' || permission.state === 'undetermined';

  return (
    <Screen>
      <StackHeader title="Notificaciones" />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
              void refetchMuted();
            }}
            tintColor={ui.colors.primary}
          />
        }
      >
        {pushBlocked ? (
          <AppCard padding="sm" style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Ionicons name="notifications-off-outline" size={22} color={ui.colors.warning} />
              <View style={{ flex: 1, gap: 10 }}>
                <Text style={{ color: ui.colors.textPrimary, fontWeight: '700', fontSize: 15 }}>
                  Las notificaciones están desactivadas
                </Text>
                <Text style={{ color: ui.colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                  {permission.canAskAgain
                    ? 'Activalas para enterarte de invitaciones, mensajes y partidos.'
                    : 'Las bloqueaste desde el sistema. Activalas en los ajustes del teléfono para recibir avisos.'}
                </Text>
                <PrimaryButton
                  label={permission.canAskAgain ? 'Activar notificaciones' : 'Abrir ajustes'}
                  size="sm"
                  loading={enabling}
                  onPress={() => void enablePush()}
                />
              </View>
            </View>
          </AppCard>
        ) : null}

        <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
          Elegí qué avisos querés recibir en el celular. Los que desactives van a seguir apareciendo en la
          bandeja de notificaciones de la app, salvo las ofertas de clubes.
        </Text>

        {isLoading || !preferences ? (
          <View style={{ gap: 10 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          CATEGORIES.map((category) => (
            <AppCard key={category.key} padding="sm" style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name={category.icon} size={22} color={ui.colors.primary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, fontSize: 15 }}>
                    {category.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
                    {category.description}
                  </Text>
                </View>
                <Switch
                  value={preferences[category.key]}
                  onValueChange={(value) => updateMutation.mutate({ [category.key]: value })}
                />
              </View>
            </AppCard>
          ))
        )}

        <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 12, lineHeight: 17 }}>
          Los avisos de seguridad, pagos y de tu cuenta siempre se envían.
        </Text>

        <Text style={{ color: ui.colors.textPrimary, fontWeight: '700', fontSize: 16, marginTop: 28, marginBottom: 6 }}>
          Clubes silenciados
        </Text>
        <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
          No recibís ofertas ni promociones de estos clubes. Para silenciar uno, tocá la campana en su perfil.
        </Text>
        {mutedClubs.length === 0 ? (
          <AppCard padding="sm">
            <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>No silenciaste ningún club.</Text>
          </AppCard>
        ) : (
          mutedClubs.map((club) => (
            <AppCard key={club.clubId} padding="sm" style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={club.name} photo={club.logoUrl} size="md" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontWeight: '700', color: ui.colors.textPrimary, fontSize: 15 }}>
                    {club.name}
                  </Text>
                  {club.city ? (
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>{club.city}</Text>
                  ) : null}
                </View>
                <PrimaryButton
                  label="Reactivar"
                  size="sm"
                  variant="outline"
                  loading={toggleMute.isPending && toggleMute.variables?.clubId === club.clubId}
                  onPress={() =>
                    toggleMute.mutate(
                      { clubId: club.clubId, muted: false },
                      { onError: () => Alert.alert('Error', 'No se pudo reactivar el club') },
                    )
                  }
                />
              </View>
            </AppCard>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
