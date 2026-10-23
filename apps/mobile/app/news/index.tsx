import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ui, fontFamily } from '@/theme/tokens';
import { formatShortDate } from '@/lib/format';
import {
  NEWS_BANNER_ASPECT,
  NEWS_FILTER_OPTIONS,
  NEWS_PAGE_SIZE,
  NEWS_QUERY_KEYS,
  NEWS_SOURCE_LABELS,
  fetchNewsList,
  newsAuthorLabel,
  newsAuthorPhoto,
  type NewsFilterKey,
  type NewsPost,
} from '@/lib/news/api';
import {
  Avatar,
  EmptyState,
  InputField,
  PressableScale,
  Screen,
  SelectionChip,
  SkeletonCard,
  StackHeader,
} from '@/components/x4match';

const LIME = '#D7FF00';
const SEARCH_DEBOUNCE_MS = 350;

function NewsCard({ post, onPress }: { post: NewsPost; onPress: () => void }) {
  const author = newsAuthorLabel(post);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Noticia: ${post.title}, de ${author}`}
      style={{
        marginBottom: 14,
        borderRadius: ui.radius.lg,
        overflow: 'hidden',
        backgroundColor: ui.colors.surface1,
        borderWidth: 1,
        borderColor: ui.colors.border,
      }}
    >
      <View style={{ width: '100%', aspectRatio: NEWS_BANNER_ASPECT, backgroundColor: ui.colors.surface2 }}>
        <Image source={{ uri: post.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        {post.isFeatured ? (
          <View
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: LIME,
              borderRadius: ui.radius.pill,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Ionicons name="star" size={11} color="#000" />
            <Text style={{ color: '#000', fontSize: 10, fontWeight: '800', fontFamily: fontFamily.bold, letterSpacing: 0.6 }}>
              DESTACADA
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 12, gap: 6 }}>
        <Text
          style={{ color: ui.colors.textPrimary, fontSize: 16, fontWeight: '800', fontFamily: fontFamily.bold }}
          numberOfLines={2}
        >
          {post.title}
        </Text>
        {post.body ? (
          <Text style={{ color: ui.colors.textSecondary, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
            {post.body}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <Avatar
            name={author}
            photo={newsAuthorPhoto(post)}
            size="sm"
            style={{ marginBottom: 0 }}
          />
          <Text style={{ flex: 1, color: ui.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {author} · {NEWS_SOURCE_LABELS[post.source]}
            {post.publishedAt ? ` · ${formatShortDate(post.publishedAt)}` : ''}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

export default function NewsListScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<NewsFilterKey>('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQ(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = useMemo(() => ({ filter, q: q.trim() }), [filter, q]);

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: NEWS_QUERY_KEYS.list(filters),
    queryFn: ({ pageParam }) => fetchNewsList(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + NEWS_PAGE_SIZE < last.total ? last.offset + NEWS_PAGE_SIZE : undefined,
  });

  const posts = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const hasQuery = filters.q.length > 0 || filter !== 'all';

  const header = (
    <View style={{ marginBottom: 8 }}>
      <InputField
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por título, club o jugador"
        leftIcon={<Ionicons name="search" size={18} color={ui.colors.textMuted} />}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        style={{ marginTop: -4 }}
      >
        {NEWS_FILTER_OPTIONS.map((option) => (
          <SelectionChip
            key={option.key}
            label={option.label}
            selected={filter === option.key}
            onPress={() => setFilter(option.key)}
          />
        ))}
      </ScrollView>
      {!isLoading ? (
        <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 10 }}>
          {total} noticia{total === 1 ? '' : 's'} vigente{total === 1 ? '' : 's'}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <StackHeader
        title="Novedades"
        rightAction={
          <PressableScale
            onPress={() => router.push('/news/create' as any)}
            accessibilityRole="button"
            accessibilityLabel="Publicar una noticia"
          >
            <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>
              Publicar
            </Text>
          </PressableScale>
        }
      />
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item }) => <NewsCard post={item} onPress={() => router.push(`/news/${item.id}` as any)} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching && !isFetchingNextPage} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <EmptyState
              icon={<Ionicons name="newspaper-outline" size={28} color={ui.colors.primary} />}
              title={hasQuery ? 'Sin resultados' : 'Todavía no hay novedades'}
              description={
                hasQuery
                  ? 'Probá con otra búsqueda o cambiá el filtro.'
                  : 'Sé el primero en publicar una noticia para la comunidad.'
              }
            />
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color={ui.colors.primary} style={{ marginVertical: 16 }} /> : null
        }
      />
    </Screen>
  );
}
