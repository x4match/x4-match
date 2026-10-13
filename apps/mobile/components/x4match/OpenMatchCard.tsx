import { Image, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Match } from '@/lib/types';
import { formatShortDate, formatMatchCourtWhen } from '@/lib/format';
import { formatMatchCategoryRange } from '@/lib/skill';
import { ui } from '@/theme/tokens';
import { AppCard } from '@/components/ui';

const MATCH_CARD_FALLBACK = require('../../assets/cancha.png');

function formatMatchWhen(match: Match) {
  return formatMatchCourtWhen(match, formatShortDate(match.date));
}

function clubPhotoUrl(match: Match): string | null {
  return match.club?.cardPhotoUrl || match.club?.coverUrl || match.club?.logoUrl || null;
}

export function isViewerInMatch(match: Match, viewerUserId?: string | null): boolean {
  if (!viewerUserId) return false;
  const status = match.viewerJoinStatus;
  if (status === 'JOINED' || status === 'CONFIRMED') return true;
  if (match.createdByUserId && match.createdByUserId === viewerUserId) return true;
  return Boolean(match.players?.some((player) => player.id === viewerUserId));
}

export function resolveOpenMatchCtaLabel(
  match: Match,
  viewerUserId?: string | null,
  joinLabel = 'Unirse a Partido',
): string {
  if (isViewerInMatch(match, viewerUserId)) return 'Ver partido';
  if (match.viewerJoinStatus === 'REQUESTED') return 'Solicitud enviada';
  return joinLabel;
}

type OpenMatchCardProps = {
  match: Match;
  onPress: () => void;
  ctaLabel?: string;
  viewerUserId?: string | null;
  width?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
};

export function OpenMatchCard({
  match,
  onPress,
  ctaLabel = 'Unirse a Partido',
  viewerUserId,
  width = 248,
  style,
}: OpenMatchCardProps) {
  const category =
    formatMatchCategoryRange(match.levelMin, match.levelMax)?.replace('Cat. ', 'CATEGORÍA ') ||
    'CATEGORÍA ABIERTA';
  const photo = clubPhotoUrl(match);
  const fillRatio = Math.min(1, Math.max(0, match.joinedCount / Math.max(1, match.neededPlayers)));
  const resolvedCta = resolveOpenMatchCtaLabel(match, viewerUserId, ctaLabel);
  const alreadyIn = isViewerInMatch(match, viewerUserId) || match.viewerJoinStatus === 'REQUESTED';

  return (
    <AppCard onPress={onPress} padding="sm" style={[{ width, marginBottom: 0 }, style]}>
      <View style={{ borderRadius: ui.radius.md, overflow: 'hidden', marginBottom: 12 }}>
        <Image
          source={photo ? { uri: photo } : MATCH_CARD_FALLBACK}
          style={{ width: '100%', height: 110 }}
          resizeMode="cover"
        />
        <View
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: ui.radius.pill,
            backgroundColor: 'rgba(0,0,0,0.55)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Ionicons name="people-outline" size={12} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontFamily: ui.typography.label.fontFamily }}>
            {match.joinedCount}/{match.neededPlayers} Join
          </Text>
        </View>
      </View>

      <Text
        style={{ fontSize: 15, fontFamily: ui.typography.h3.fontFamily, color: ui.colors.textPrimary }}
        numberOfLines={1}
      >
        {match.club?.name || match.title}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 12,
          fontFamily: ui.typography.label.fontFamily,
          color: ui.colors.primary,
          letterSpacing: 0.6,
        }}
        numberOfLines={1}
      >
        {category.toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <Ionicons name="calendar-outline" size={14} color={ui.colors.textSecondary} />
        <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>{formatMatchWhen(match)}</Text>
      </View>

      <View
        style={{
          height: 2,
          width: '100%',
          marginTop: 10,
          marginBottom: 12,
          borderRadius: 1,
          backgroundColor: ui.colors.surface3,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${Math.round(fillRatio * 100)}%`,
            borderRadius: 1,
            backgroundColor: ui.colors.primary,
            opacity: 0.9,
          }}
        />
      </View>

      <View
        accessibilityRole="button"
        accessibilityLabel={resolvedCta}
        style={{
          paddingVertical: 12,
          borderRadius: ui.radius.pill,
          backgroundColor: alreadyIn ? 'transparent' : ui.colors.surface3,
          borderWidth: 1,
          borderColor: alreadyIn ? ui.colors.primary : 'rgba(255,255,255,0.12)',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            color: '#ffffff',
            fontFamily: ui.typography.label.fontFamily,
            fontSize: 13,
            fontWeight: '700',
          }}
        >
          {resolvedCta}
        </Text>
      </View>
    </AppCard>
  );
}
