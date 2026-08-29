import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PlayerMatchHistory, MatchHistoryResult } from '@/lib/types';
import { formatShortDate, formatTime } from '@/lib/format';
import { ui } from '@/theme/tokens';
import { AppCard, EmptyState } from '@/components/ui';

type PlayerMatchHistoryListProps = {
  data?: PlayerMatchHistory | null;
  title?: string;
  showRatingChange?: boolean;
  limit?: number;
  loading?: boolean;
};

const RESULT_CONFIG: Record<
  MatchHistoryResult,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  win: { label: 'Victoria', color: ui.colors.success, bg: ui.colors.successSoft, icon: 'trophy' },
  loss: { label: 'Derrota', color: ui.colors.danger, bg: ui.colors.dangerSoft, icon: 'close-circle' },
  draw: { label: 'Empate', color: ui.colors.warning, bg: ui.colors.warningSoft, icon: 'remove-circle' },
};

function formatOpponents(names: string[]): string {
  if (!names.length) return 'Rivales no registrados';
  if (names.length <= 2) return names.join(' · ');
  return `${names.slice(0, 2).join(' · ')} +${names.length - 2}`;
}

function formatRatingChange(delta?: number): string | null {
  if (delta == null || delta === 0) return null;
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function PlayerMatchHistoryList({
  data,
  title = 'Partidos jugados',
  showRatingChange = false,
  limit,
  loading = false,
}: PlayerMatchHistoryListProps) {
  const router = useRouter();
  const entries = limit ? (data?.history ?? []).slice(0, limit) : (data?.history ?? []);

  if (loading) {
    return (
      <AppCard style={{ width: '100%' }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary, marginBottom: 12 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 13, color: ui.colors.textMuted }}>Cargando historial...</Text>
      </AppCard>
    );
  }

  if (!entries.length) {
    return (
      <AppCard style={{ width: '100%' }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary, marginBottom: 12 }}>
          {title}
        </Text>
        <EmptyState
          icon={<Ionicons name="tennisball-outline" size={28} color={ui.colors.textMuted} />}
          title="Sin partidos jugados"
          description="Los partidos finalizados con resultado confirmado aparecerán acá"
        />
      </AppCard>
    );
  }

  return (
    <AppCard style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary }}>{title}</Text>
        {data && data.totalMatches > entries.length ? (
          <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>
            Últimos {entries.length} de {data.totalMatches}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 10 }}>
        {entries.map((entry) => {
          const config = RESULT_CONFIG[entry.result] ?? RESULT_CONFIG.draw;
          const ratingLabel = showRatingChange ? formatRatingChange(entry.ratingChange) : null;

          return (
            <TouchableOpacity
              key={entry.matchId}
              activeOpacity={0.85}
              onPress={() => router.push(`/match/${entry.matchId}` as any)}
            >
              <View
                style={{
                  borderRadius: ui.radius.md,
                  borderWidth: 1,
                  borderColor: ui.colors.border,
                  padding: 12,
                  backgroundColor: ui.colors.surface,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: 14, color: ui.colors.textPrimary }} numberOfLines={1}>
                      {entry.title || 'Partido'}
                    </Text>
                    {entry.clubName ? (
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                        {entry.clubName}
                      </Text>
                    ) : null}
                    <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 4 }}>
                      {formatShortDate(entry.date)} · {formatTime(entry.date)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: config.bg,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: ui.radius.pill,
                      }}
                    >
                      <Ionicons name={config.icon} size={12} color={config.color} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: config.color }}>{config.label}</Text>
                    </View>
                    <Text style={{ fontWeight: '800', fontSize: 15, color: ui.colors.textPrimary }}>{entry.score}</Text>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: ui.colors.border,
                  }}
                >
                  <Text style={{ flex: 1, fontSize: 12, color: ui.colors.textSecondary }} numberOfLines={1}>
                    vs {formatOpponents(entry.opponent)}
                  </Text>
                  {ratingLabel ? (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color:
                          entry.ratingChange && entry.ratingChange > 0
                            ? ui.colors.success
                            : ui.colors.danger,
                      }}
                    >
                      {ratingLabel} pts
                    </Text>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={ui.colors.textMuted} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </AppCard>
  );
}
