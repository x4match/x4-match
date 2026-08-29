import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Match } from '@/lib/types';
import { formatCurrency, formatMatchSchedule, formatShortDate, formatTime } from '@/lib/format';
import { formatDistanceKm } from '@/lib/geolocation';
import { formatMatchCategoryRange } from '@/lib/skill';
import { ui } from '@/theme/tokens';
import { Avatar } from './Avatar';

type MatchOrganizedSummaryProps = {
  match: Match;
};

function formatMatchWhen(match: Match): string {
  if (match.courtBooking === 'in_app' && match.courtInfo?.label) {
    return `${formatShortDate(match.date)} ${formatTime(match.date)}`;
  }
  if (match.endsAt) {
    const diffHours =
      (new Date(match.endsAt).getTime() - new Date(match.date).getTime()) / 3600000;
    if (diffHours > 3) {
      return formatMatchSchedule(match.date, match.endsAt);
    }
  }
  return `${formatShortDate(match.date)} ${formatTime(match.date)}`;
}

function buildCourtMetaLine(match: Match): string | null {
  const parts: string[] = [];

  if (match.courtInfo?.label) {
    parts.push(match.courtInfo.label);
  } else if (match.courtBooking === 'external') {
    parts.push(match.venueNote ? `Reserva externa: ${match.venueNote}` : 'Reserva externa');
  } else if (match.courtBooking === 'in_app') {
    parts.push('Cancha reservada en la app');
  }

  if (match.courtInfo?.durationMinutes) {
    parts.push(`${match.courtInfo.durationMinutes} min`);
  }

  if (match.courtInfo?.cancelPolicy) {
    parts.push(match.courtInfo.cancelPolicy);
  }

  return parts.length ? parts.join(' · ') : null;
}

export function MatchOrganizedSummary({ match }: MatchOrganizedSummaryProps) {
  const spotsLeft = Math.max(0, match.neededPlayers - match.joinedCount);
  const categoryLabel = formatMatchCategoryRange(match.levelMin, match.levelMax);
  const distance = formatDistanceKm(match.distanceKm);
  const courtMeta = buildCourtMetaLine(match);
  const pricing = match.pricing;
  const depositAmount =
    match.deposit?.required && match.deposit.amount > 0
      ? match.deposit.amount
      : pricing?.depositAmount;
  const showPricing = (pricing?.pricePerPlayer ?? 0) > 0 || (depositAmount ?? 0) > 0;

  const participants = [
    ...match.players.map((player) => ({
      id: player.id,
      name: player.name,
      photo: player.photo,
    })),
    ...(match.guestInvites ?? []).map((guest) => ({
      id: guest.id,
      name: guest.name,
      photo: undefined as string | undefined,
    })),
  ];

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: ui.colors.textPrimary }}>
          {formatMatchWhen(match)}
        </Text>
        {categoryLabel ? (
          <View
            style={{
              backgroundColor: ui.colors.surfaceAlt,
              borderRadius: ui.radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: ui.colors.border,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: ui.colors.textSecondary }}>
              {categoryLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 8 }}>
        {[match.club?.name, match.zone, distance ? `a ${distance}` : null].filter(Boolean).join(' · ') ||
          'Sin club definido'}
      </Text>

      {courtMeta ? (
        <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 6 }}>{courtMeta}</Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: 14,
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            {participants.slice(0, 4).map((player) => (
              <Avatar key={player.id} name={player.name} photo={player.photo} size="sm" />
            ))}
            {spotsLeft > 0 ? (
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: ui.colors.textMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: ui.colors.textMuted, fontSize: 12 }}>?</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: ui.colors.textPrimary }}>
            {spotsLeft === 0
              ? 'Completo'
              : spotsLeft === 1
                ? 'Falta 1'
                : `Faltan ${spotsLeft}`}
          </Text>
        </View>

        {showPricing ? (
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {(pricing?.pricePerPlayer ?? 0) > 0 ? (
              <Text style={{ fontSize: 15, fontWeight: '800', color: ui.colors.textPrimary }}>
                {formatCurrency(pricing!.pricePerPlayer, pricing?.currency || 'ARS')}
                <Text style={{ fontSize: 11, fontWeight: '600', color: ui.colors.textMuted }}>
                  {' '}
                  /jug.
                </Text>
              </Text>
            ) : null}
            {(depositAmount ?? 0) > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="time-outline" size={12} color={ui.colors.textMuted} />
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary, fontWeight: '600' }}>
                  Seña {formatCurrency(depositAmount!, pricing?.currency || 'ARS')}
                </Text>
              </View>
            ) : null}
            {(pricing?.bonusPoints ?? 0) > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="link-outline" size={12} color={ui.colors.primary} />
                <Text style={{ fontSize: 12, color: ui.colors.primary, fontWeight: '700' }}>
                  +{pricing!.bonusPoints} cr por jugarlo
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
