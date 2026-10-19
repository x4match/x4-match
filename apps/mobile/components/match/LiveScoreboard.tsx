import { Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Avatar } from '@/components/ui';
import { ui } from '@/theme/tokens';
import {
  teamLabel,
  type LiveTeam,
  type LiveTeamPair,
  type MatchLiveScore,
} from '@/lib/match/live-score';

type Column = { key: string; label: string; values: LiveTeamPair; current: boolean };

function buildColumns(live: MatchLiveScore): Column[] {
  const columns: Column[] = (live.sets ?? []).map((set, i) => ({
    key: `set-${i}`,
    label: set.superTiebreak ? 'STB' : `S${i + 1}`,
    values: { teamA: set.teamA, teamB: set.teamB },
    current: false,
  }));
  if (live.status === 'LIVE' && live.phase !== 'super_tiebreak' && live.games) {
    columns.push({
      key: 'current',
      label: `S${columns.length + 1}`,
      values: live.games,
      current: true,
    });
  }
  return columns;
}

function LiveDot() {
  return (
    <MotiView
      from={{ opacity: 1 }}
      animate={{ opacity: 0.25 }}
      transition={{ type: 'timing', duration: 800, loop: true }}
      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ui.colors.danger }}
    />
  );
}

function TeamRow({
  live,
  team,
  columns,
  compact,
}: {
  live: MatchLiveScore;
  team: LiveTeam;
  columns: Column[];
  compact: boolean;
}) {
  const members = live.teams[team] ?? [];
  const key = team === 'A' ? 'teamA' : 'teamB';
  const rivalKey = team === 'A' ? 'teamB' : 'teamA';
  const isWinner = live.winner === team;
  const pointsLabel = live.display?.[key] ?? '';
  const showPoints = live.status === 'LIVE';
  const cell = compact ? 26 : 34;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: compact ? 6 : 10 }}>
      <View style={{ flexDirection: 'row', marginRight: 10 }}>
        {members.slice(0, 2).map((m, i) => (
          <Avatar
            key={m.id}
            name={m.name}
            photo={m.photo}
            size={compact ? 'sm' : 'md'}
            borderColor={ui.colors.surface}
            style={{ marginLeft: i === 0 ? 0 : -10 }}
          />
        ))}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            color: isWinner ? ui.colors.primary : ui.colors.textPrimary,
            fontSize: compact ? 13 : 15,
            fontWeight: '700',
          }}
        >
          {teamLabel(members, `Equipo ${team}`)}
        </Text>
        {!compact && (
          <Text style={{ color: ui.colors.textMuted, fontSize: 11, marginTop: 2 }}>
            Equipo {team}
            {isWinner ? ' · Ganador' : ''}
          </Text>
        )}
      </View>
      {columns.map((col) => {
        const value = col.values[key];
        const wonSet = !col.current && value > col.values[rivalKey];
        return (
          <View
            key={col.key}
            style={{
              width: cell,
              height: cell,
              marginLeft: 4,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: col.current ? ui.colors.surface3 : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: compact ? 14 : 18,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
                color: wonSet || col.current ? ui.colors.textPrimary : ui.colors.textMuted,
              }}
            >
              {value}
            </Text>
          </View>
        );
      })}
      {showPoints && (
        <View
          style={{
            minWidth: compact ? 40 : 56,
            height: cell + (compact ? 4 : 10),
            marginLeft: 8,
            paddingHorizontal: 6,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: ui.colors.primary,
          }}
        >
          <Text
            style={{
              fontSize: compact ? 16 : 24,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
              color: ui.colors.onPrimary,
            }}
          >
            {pointsLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

export function LiveScoreboard({ live, compact = false }: { live: MatchLiveScore; compact?: boolean }) {
  const columns = buildColumns(live);
  const pressureLabel = live.matchPointFor
    ? `Punto de partido · Equipo ${live.matchPointFor}`
    : live.setPointFor
      ? `Punto de set · Equipo ${live.setPointFor}`
      : null;
  const badge = live.status === 'LIVE' ? live.display?.label || pressureLabel : null;

  return (
    <View
      style={{
        backgroundColor: ui.colors.surface,
        borderRadius: ui.radius.lg,
        borderWidth: 1,
        borderColor: ui.colors.border,
        padding: compact ? 12 : 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: compact ? 4 : 8 }}>
        {live.status === 'LIVE' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <LiveDot />
            <Text style={{ color: ui.colors.danger, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
              EN VIVO
            </Text>
          </View>
        ) : (
          <Text style={{ color: ui.colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
            FINAL
          </Text>
        )}
        <View style={{ flex: 1 }} />
        {badge ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: ui.radius.pill,
              backgroundColor: ui.colors.accentSoft,
            }}
          >
            <Text style={{ color: ui.colors.accent, fontSize: 11, fontWeight: '700' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <TeamRow live={live} team="A" columns={columns} compact={compact} />
      <View style={{ height: 1, backgroundColor: ui.colors.border }} />
      <TeamRow live={live} team="B" columns={columns} compact={compact} />
      {!compact && pressureLabel && live.display?.label ? (
        <Text style={{ color: ui.colors.accent, fontSize: 12, marginTop: 6, textAlign: 'center' }}>
          {pressureLabel}
        </Text>
      ) : null}
    </View>
  );
}
