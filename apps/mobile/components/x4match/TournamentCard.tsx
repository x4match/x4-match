import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type ImageSourcePropType,
} from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { Tournament } from '@/lib/types';
import { fontFamily } from '@/theme/tokens';
import { hapticLight } from '@/lib/haptics';
import { FLYER_ASPECT_RATIO } from '@/lib/tournament/flyer';
import { isTournamentClosed } from '@/lib/tournament/types';

const FALLBACK_FLYER = require('../../assets/cancha.png');
const CARD_STRIPES = require('../../assets/figma/matches/tiras.png');
const ICON_CALENDAR = require('../../assets/figma/shared/calendar.png');

const LIME = '#D7FF00';
const CARD_BG = '#17171C';
const EYEBROW = '#BDBDBD';

/** Padding horizontal del flyer dentro de la card. */
const FLYER_INSET = 12;
const FLYER_INSET_COMPACT = 10;

type TournamentCardProps = {
  tournament: Tournament;
  onPress: () => void;
  ctaLabel?: string;
  variant?: 'full' | 'compact';
  style?: StyleProp<ViewStyle>;
  width?: number | `${number}%`;
  /** Override del bloque derecho (default: parejas del torneo). */
  statValue?: string;
  statLabel?: string;
};

function resolveFlyer(tournament: Tournament): ImageSourcePropType {
  const direct = tournament.flyerUrl?.trim();
  if (direct) return { uri: direct };

  const photos = tournament.photos || [];
  const flyerPhoto =
    photos.find((p) => (p.caption || '').toLowerCase() === 'flyer') || photos[0];
  const fromPhoto = (
    flyerPhoto?.url ||
    (flyerPhoto as { photo_url?: string } | undefined)?.photo_url
  )?.trim();
  if (fromPhoto) return { uri: fromPhoto };

  return FALLBACK_FLYER;
}

function formatCardDate(date?: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTournamentDates(tournament: Tournament): string {
  const start = formatCardDate(tournament.startDate || tournament.start_date);
  const end = formatCardDate(tournament.endDate || tournament.end_date);
  if (start && end && start !== end) return `${start} - ${end}`;
  if (start) return start;
  return 'Fecha a confirmar';
}

function formatCategoryEyebrow(tournament: Tournament): string {
  const parts = [tournament.category?.trim(), tournament.gender?.trim()].filter(Boolean);
  return (parts.length ? parts.join(' - ') : 'Categoría abierta').toUpperCase();
}

function venueLabel(tournament: Tournament): string {
  if (tournament.clubName) return tournament.clubName;
  if ((tournament.venueCount ?? 0) > 1) return `${tournament.venueCount} sedes`;
  if ((tournament.venueCount ?? 0) === 1) return '1 sede';
  return 'Sede a confirmar';
}

function flyerBoxSize(cardWidth: number | undefined, compact: boolean) {
  const inset = compact ? FLYER_INSET_COMPACT : FLYER_INSET;
  if (typeof cardWidth !== 'number' || cardWidth <= 0) {
    return { width: undefined as number | undefined, height: undefined as number | undefined, inset };
  }
  const width = Math.max(1, cardWidth - inset * 2);
  const height = Math.round(width / FLYER_ASPECT_RATIO);
  return { width, height, inset };
}

export function TournamentCard({
  tournament,
  onPress,
  ctaLabel = 'Ver torneo',
  variant = 'full',
  style,
  width,
  statValue,
  statLabel = 'PAREJAS',
}: TournamentCardProps) {
  const numericWidth = typeof width === 'number' ? width : undefined;
  const compact = variant === 'compact' || (numericWidth != null && numericWidth < 340);
  const approved = tournament.approvedCount ?? 0;
  const maxTeams = tournament.maxTeams ?? tournament.max_teams;
  const pairsLabel =
    statValue ?? (maxTeams != null ? `${approved}/${maxTeams}` : String(approved));
  const venue = venueLabel(tournament);
  const flyerBox = flyerBoxSize(numericWidth, compact);
  const [flyerFailed, setFlyerFailed] = useState(false);
  const flyerSource = flyerFailed ? FALLBACK_FLYER : resolveFlyer(tournament);
  const closed = isTournamentClosed(tournament);

  useEffect(() => {
    setFlyerFailed(false);
  }, [tournament.id, tournament.flyerUrl]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tournament.name}. ${ctaLabel}`}
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      style={[styles.root, numericWidth != null ? { width: numericWidth } : { width: '100%' }, style]}
    >
      <View style={[styles.card, compact && styles.cardCompact]}>
        <View pointerEvents="none" style={styles.stripesWrap}>
          <Image source={CARD_STRIPES} style={styles.stripes} resizeMode="contain" />
        </View>

        <View
          style={[
            styles.flyerPad,
            { paddingHorizontal: flyerBox.inset, paddingTop: flyerBox.inset },
          ]}
        >
          <View
            style={[
              styles.flyerFrame,
              compact && styles.flyerFrameCompact,
              flyerBox.width != null && flyerBox.height != null
                ? { width: flyerBox.width, height: flyerBox.height }
                : { width: '100%', aspectRatio: FLYER_ASPECT_RATIO },
            ]}
          >
            <Image
              source={flyerSource}
              style={styles.flyerImage}
              resizeMode="cover"
              onError={() => setFlyerFailed(true)}
            />
            {closed ? (
              <View style={styles.closedBadge}>
                <Ionicons name="flag" size={11} color="#FFFFFF" />
                <Text style={styles.closedBadgeText}>Terminado</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={[styles.body, compact && styles.bodyCompact]}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {formatCategoryEyebrow(tournament)}
          </Text>
          <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
            {tournament.name}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              <View style={styles.infoLine}>
                <Image source={ICON_CALENDAR} style={styles.calIcon} resizeMode="contain" />
                <Text style={styles.infoText} numberOfLines={1}>
                  {formatTournamentDates(tournament)}
                </Text>
              </View>
              <View style={styles.infoLine}>
                <Ionicons name="location-sharp" size={16} color={LIME} />
                <Text style={styles.infoText} numberOfLines={1}>
                  {venue}
                </Text>
              </View>
            </View>

            <View style={styles.pairs}>
              <View style={styles.pairsTop}>
                <Ionicons name="people" size={18} color={LIME} />
                <Text style={styles.pairsValue} numberOfLines={1}>
                  {pairsLabel}
                </Text>
              </View>
              <Text style={styles.pairsLabel}>{statLabel}</Text>
            </View>
          </View>

          <View style={styles.cta}>
            <Text style={styles.ctaText} numberOfLines={1}>
              {ctaLabel}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    overflow: 'hidden',
    width: '100%',
  },
  cardCompact: {
    borderRadius: 18,
  },
  stripesWrap: {
    position: 'absolute',
    right: -20,
    top: -30,
    width: 220,
    height: 320,
    zIndex: 0,
  },
  stripes: {
    width: '100%',
    height: '100%',
    top: 30,
    right: 20,
  },
  flyerPad: {
    zIndex: 1,
  },
  flyerFrame: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0B0B0F',
  },
  flyerFrameCompact: {
    borderRadius: 10,
  },
  flyerImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  closedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  closedBadgeText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 14,
    color: '#FFFFFF',
  },
  body: {
    zIndex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  bodyCompact: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  eyebrow: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    height: 16,
    color: EYEBROW,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 22,
    lineHeight: 26,
    color: '#FFFFFF',
  },
  titleCompact: {
    fontSize: 18,
    lineHeight: 22,
  },
  metaRow: {
    marginTop: 10,
    height: 52,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaLeft: {
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 18,
  },
  calIcon: {
    width: 16,
    height: 18,
  },
  infoText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 17,
    color: '#FFFFFF',
  },
  pairs: {
    alignItems: 'center',
    width: 64,
    marginTop: 2,
  },
  pairsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pairsValue: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  pairsLabel: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  cta: {
    marginTop: 14,
    height: 38,
    borderRadius: 40,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  ctaText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
  },
});
