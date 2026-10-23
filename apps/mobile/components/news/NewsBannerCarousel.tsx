import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticLight } from '@/lib/haptics';
import { useReduceMotion } from '@/lib/reduce-motion';
import { NEWS_BANNER_ASPECT, newsAuthorLabel, type NewsPost } from '@/lib/news/api';
import { fontFamily } from '@/theme/tokens';

const LIME = '#D7FF00';
const AUTOPLAY_MS = 5000;
const GAP = 12;

type NewsBannerCarouselProps = {
  posts: NewsPost[];
  onPressPost: (post: NewsPost) => void;
};

function BannerSlide({
  post,
  width,
  onPress,
}: {
  post: NewsPost;
  width: number;
  onPress: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const author = newsAuthorLabel(post);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Noticia: ${post.title}, de ${author}. Ver más`}
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      style={({ pressed }) => ({ width, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <View style={[styles.slide, { height: Math.round(width / NEWS_BANNER_ASPECT) }]}>
        {!imageFailed ? (
          <Image
            source={{ uri: post.imageUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <LinearGradient
            colors={['#3A4700', '#161A06', '#0B0B0E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']}
          locations={[0.35, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.footer}>
          <View style={styles.texts}>
            <Text style={styles.title} numberOfLines={1}>
              {post.title}
            </Text>
            <Text style={styles.author} numberOfLines={1}>
              {author}
            </Text>
          </View>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>ver más</Text>
            <Ionicons name="arrow-forward" size={12} color="#000" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function NewsBannerCarousel({ posts, onPressPost }: NewsBannerCarouselProps) {
  const reduceMotion = useReduceMotion();
  const listRef = useRef<FlatList<NewsPost>>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const interval = width + GAP;

  useEffect(() => {
    if (index >= posts.length) setIndex(0);
  }, [posts.length, index]);

  useEffect(() => {
    if (reduceMotion || dragging || posts.length < 2 || width === 0) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % posts.length;
      listRef.current?.scrollToOffset({ offset: next * interval, animated: true });
      setIndex(next);
    }, AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [index, dragging, reduceMotion, posts.length, interval, width]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / interval);
      setIndex(Math.max(0, Math.min(posts.length - 1, next)));
      setDragging(false);
    },
    [interval, posts.length],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };

  if (!posts.length) return null;

  return (
    <View onLayout={handleLayout}>
      {width > 0 ? (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={(p) => p.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={interval}
          decelerationRate="fast"
          disableIntervalMomentum
          onScrollBeginDrag={() => setDragging(true)}
          onMomentumScrollEnd={onMomentumEnd}
          getItemLayout={(_, i) => ({ length: interval, offset: interval * i, index: i })}
          renderItem={({ item, index: i }) => (
            <View style={{ marginRight: i === posts.length - 1 ? 0 : GAP }}>
              <BannerSlide post={item} width={width} onPress={() => onPressPost(item)} />
            </View>
          )}
        />
      ) : null}
      {posts.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {posts.map((p, i) => (
            <View key={p.id} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slide: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0B0B0E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'flex-end',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  texts: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  author: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11.5,
    marginTop: 1,
    fontFamily: fontFamily.regular,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LIME,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ctaText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    width: 18,
    backgroundColor: LIME,
  },
});
