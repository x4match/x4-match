import { Alert, Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ui, fontFamily } from '@/theme/tokens';
import { formatShortDate } from '@/lib/format';
import {
  NEWS_BANNER_ASPECT,
  NEWS_QUERY_KEYS,
  deleteNewsPost,
  fetchClubNews,
  fetchMyNews,
  newsDisplayStatus,
  newsErrorMessage,
  type NewsPost,
} from '@/lib/news/api';
import {
  AppCard,
  EmptyState,
  PressableScale,
  PrimaryButton,
  Screen,
  SkeletonCard,
  StackHeader,
  StatusPill,
} from '@/components/x4match';

function statusHint(post: NewsPost): string {
  const status = newsDisplayStatus(post);
  if (status === 'PENDING') return 'Esperando aprobación';
  if (status === 'ACTIVE' && post.expiresAt) {
    return `${post.isFeatured ? 'Destacada en el inicio · ' : ''}Visible hasta ${formatShortDate(post.expiresAt)}`;
  }
  if (status === 'EXPIRED' && post.expiresAt) return `Venció el ${formatShortDate(post.expiresAt)}`;
  if (status === 'REJECTED') return post.reviewNotes ? `Motivo: ${post.reviewNotes}` : 'No fue aprobada';
  return '';
}

export default function MyNewsScreen() {
  const { clubId } = useLocalSearchParams<{ clubId?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryKey = clubId ? NEWS_QUERY_KEYS.club(clubId) : NEWS_QUERY_KEYS.mine;

  const { data: posts = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey,
    queryFn: () => (clubId ? fetchClubNews(clubId) : fetchMyNews()),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNewsPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.banners });
      queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.listAll });
    },
    onError: (error) => Alert.alert('Error', newsErrorMessage(error, 'No se pudo eliminar la noticia')),
  });

  const confirmDelete = (post: NewsPost) => {
    Alert.alert('Eliminar noticia', `¿Querés eliminar "${post.title}"? Deja de mostrarse en la app.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate(post.id) },
    ]);
  };

  const createHref = clubId ? `/news/create?clubId=${clubId}` : '/news/create';

  return (
    <Screen>
      <StackHeader title={clubId ? 'Noticias del club' : 'Mis noticias'} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >
        <PrimaryButton
          label="Publicar noticia"
          fullWidth
          style={{ marginBottom: 16 }}
          onPress={() => router.push(createHref as any)}
          icon={<Ionicons name="add" size={18} color={ui.colors.onPrimary} />}
        />

        {isLoading ? (
          <SkeletonCard />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="megaphone-outline" size={28} color={ui.colors.primary} />}
            title="Todavía no publicaste noticias"
            description="Subí un banner con tu torneo, clínica o novedad para que lo vea toda la comunidad."
          />
        ) : (
          posts.map((post) => {
            const status = newsDisplayStatus(post);
            return (
              <AppCard key={post.id} style={{ marginBottom: 12 }} padding="sm">
                <PressableScale
                  disabled={status !== 'ACTIVE'}
                  onPress={() => router.push(`/news/${post.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver noticia ${post.title}`}
                >
                  <View
                    style={{
                      width: '100%',
                      aspectRatio: NEWS_BANNER_ASPECT,
                      borderRadius: ui.radius.md,
                      overflow: 'hidden',
                      backgroundColor: ui.colors.surface1,
                    }}
                  >
                    <Image source={{ uri: post.imageUrl }} style={{ width: '100%', height: '100%' }} />
                  </View>
                </PressableScale>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <StatusPill status={status} />
                  <Text style={{ flex: 1, color: ui.colors.textMuted, fontSize: 12 }} numberOfLines={2}>
                    {statusHint(post)}
                  </Text>
                </View>
                <Text
                  style={{
                    color: ui.colors.textPrimary,
                    fontSize: 16,
                    fontWeight: '800',
                    fontFamily: fontFamily.bold,
                    marginTop: 8,
                  }}
                  numberOfLines={2}
                >
                  {post.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ color: ui.colors.textMuted, fontSize: 12 }}>
                    Creada el {formatShortDate(post.createdAt)}
                  </Text>
                  <PressableScale
                    onPress={() => confirmDelete(post)}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar noticia ${post.title}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={ui.colors.danger} />
                    <Text style={{ color: ui.colors.danger, fontSize: 13 }}>Eliminar</Text>
                  </PressableScale>
                </View>
              </AppCard>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
