import { Image, Linking, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ui, fontFamily } from '@/theme/tokens';
import { formatShortDate } from '@/lib/format';
import {
  NEWS_BANNER_ASPECT,
  NEWS_QUERY_KEYS,
  NEWS_SOURCE_LABELS,
  fetchNewsPost,
  newsAuthorLabel,
  newsAuthorPhoto,
  newsDisplayStatus,
  newsErrorMessage,
} from '@/lib/news/api';
import {
  Avatar,
  EmptyState,
  PressableScale,
  PrimaryButton,
  Screen,
  SkeletonCard,
  StackHeader,
  StatusPill,
} from '@/components/x4match';

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: post, isLoading, error } = useQuery({
    queryKey: NEWS_QUERY_KEYS.detail(id ?? ''),
    queryFn: () => fetchNewsPost(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Screen>
        <StackHeader title="Noticia" />
        <View style={{ padding: 16 }}>
          <SkeletonCard />
        </View>
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen>
        <StackHeader title="Noticia" />
        <EmptyState
          icon={<Ionicons name="newspaper-outline" size={28} color={ui.colors.primary} />}
          title="Noticia no disponible"
          description={newsErrorMessage(error, 'Puede que haya vencido o que la hayan eliminado.')}
        />
      </Screen>
    );
  }

  const author = newsAuthorLabel(post);
  const status = newsDisplayStatus(post);

  return (
    <Screen>
      <StackHeader title="Noticia" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View
          style={{
            width: '100%',
            aspectRatio: NEWS_BANNER_ASPECT,
            borderRadius: ui.radius.lg,
            overflow: 'hidden',
            backgroundColor: ui.colors.surface1,
            borderWidth: 1,
            borderColor: ui.colors.border,
          }}
        >
          <Image source={{ uri: post.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>

        {status !== 'ACTIVE' ? (
          <View style={{ marginTop: 12 }}>
            <StatusPill status={status} />
          </View>
        ) : null}

        <Text
          style={{
            color: ui.colors.textPrimary,
            fontSize: 24,
            lineHeight: 30,
            fontWeight: '800',
            fontFamily: fontFamily.bold,
            marginTop: 14,
          }}
        >
          {post.title}
        </Text>

        <PressableScale
          disabled={!post.club}
          onPress={() => post.club && router.push(`/club/${post.club.id}` as any)}
          accessibilityRole={post.club ? 'button' : undefined}
          accessibilityLabel={post.club ? `Ver club ${post.club.name}` : undefined}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}
        >
          <Avatar
            name={author}
            photo={newsAuthorPhoto(post)}
            size="sm"
            style={{ marginBottom: 0 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: ui.colors.textPrimary, fontSize: 14, fontFamily: ui.typography.label.fontFamily }}>
              {author}
            </Text>
            <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {NEWS_SOURCE_LABELS[post.source]}
              {post.publishedAt ? ` · ${formatShortDate(post.publishedAt)}` : ''}
              {post.expiresAt && post.isLive ? ` · vigente hasta ${formatShortDate(post.expiresAt)}` : ''}
            </Text>
          </View>
          {post.club ? <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} /> : null}
        </PressableScale>

        {post.body ? (
          <Text style={{ color: ui.colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 18 }}>
            {post.body}
          </Text>
        ) : null}

        {post.status === 'REJECTED' && post.reviewNotes ? (
          <Text style={{ color: ui.colors.danger, fontSize: 13, marginTop: 16 }}>
            Motivo del rechazo: {post.reviewNotes}
          </Text>
        ) : null}

        {post.linkUrl ? (
          <PrimaryButton
            label="Abrir link"
            fullWidth
            size="lg"
            style={{ marginTop: 24 }}
            onPress={() => void Linking.openURL(post.linkUrl!)}
            icon={<Ionicons name="open-outline" size={18} color={ui.colors.onPrimary} />}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
