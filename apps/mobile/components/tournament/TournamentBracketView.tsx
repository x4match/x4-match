import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchGroups, formatScore } from '@/lib/tournament/api';
import {
  isByeMatch,
  knockoutRounds,
  slotName,
  type KnockoutRound,
} from '@/lib/tournament/brackets';
import type { TournamentGroup, TournamentMatch } from '@/lib/tournament/types';
import { ui } from '@/theme/tokens';
import { AppCard, SegmentedControl } from '@/components/x4match';

type BracketTab = 'groups' | 'bracket';

const MATCH_HEIGHT = 74;
const MATCH_GAP = 14;
const COLUMN_WIDTH = 190;

export function TournamentBracketView({
  tournamentId,
  matches,
  inviteToken,
  highlightRegistrationIds,
}: {
  tournamentId: string;
  matches: TournamentMatch[];
  inviteToken?: string | null;
  highlightRegistrationIds?: string[];
}) {
  const hasGroups = matches.some((m) => m.phase === 'GROUP');
  const rounds = useMemo(() => knockoutRounds(matches), [matches]);
  const [view, setView] = useState<BracketTab>(hasGroups ? 'groups' : 'bracket');
  const highlight = new Set(highlightRegistrationIds ?? []);
  const groupResultsSignature = useMemo(
    () =>
      matches
        .filter((m) => m.phase === 'GROUP' && m.status === 'FINISHED')
        .map((m) => `${m.id}:${m.winner_registration_id}:${formatScore(m)}`)
        .join('|'),
    [matches],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['tournament-groups', tournamentId, groupResultsSignature],
    queryFn: () => fetchGroups(tournamentId, inviteToken),
    enabled: hasGroups,
  });

  return (
    <View style={{ gap: 12 }}>
      {hasGroups && rounds.length ? (
        <SegmentedControl<BracketTab>
          options={[
            { value: 'groups', label: 'Zonas' },
            { value: 'bracket', label: 'Cuadro' },
          ]}
          value={view}
          onChange={setView}
        />
      ) : null}

      {view === 'groups' && hasGroups ? (
        isLoading ? (
          <ActivityIndicator color={ui.colors.primary} style={{ marginTop: 16 }} />
        ) : (
          (data?.groups ?? []).map((g) => (
            <GroupCard
              key={g.code}
              group={g}
              qualifiers={data?.qualifiersPerGroup ?? 2}
              highlight={highlight}
            />
          ))
        )
      ) : (
        <BracketColumns rounds={rounds} highlight={highlight} />
      )}
    </View>
  );
}

function GroupCard({
  group,
  qualifiers,
  highlight,
}: {
  group: TournamentGroup;
  qualifiers: number;
  highlight: Set<string>;
}) {
  const head = { color: ui.colors.textMuted, fontSize: 11, fontWeight: '700' as const, width: 30, textAlign: 'center' as const };
  const cell = { color: ui.colors.textPrimary, fontSize: 13, width: 30, textAlign: 'center' as const };

  return (
    <AppCard>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: ui.colors.textPrimary, fontSize: 16, fontWeight: '800' }}>Zona {group.code}</Text>
        <Text
          style={{
            color: group.complete ? ui.colors.primary : ui.colors.textMuted,
            fontSize: 12,
            fontWeight: '700',
          }}
        >
          {group.complete ? 'Cerrada' : 'En juego'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', paddingBottom: 6 }}>
        <Text style={[head, { width: 22 }]}>#</Text>
        <Text style={[head, { flex: 1, textAlign: 'left' }]}>Pareja</Text>
        <Text style={head}>PJ</Text>
        <Text style={head}>PG</Text>
        <Text style={head}>±S</Text>
        <Text style={head}>±G</Text>
        <Text style={head}>Pts</Text>
      </View>
      {group.standings.map((row) => {
        const qualified = row.position <= qualifiers;
        const mine = highlight.has(row.registrationId);
        return (
          <View
            key={row.registrationId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 7,
              borderTopWidth: 1,
              borderTopColor: ui.colors.border,
              borderLeftWidth: 3,
              borderLeftColor: qualified ? ui.colors.primary : 'transparent',
              paddingLeft: 4,
              backgroundColor: mine ? ui.colors.primarySoft : undefined,
            }}
          >
            <Text style={[cell, { width: 18, color: ui.colors.textMuted }]}>{row.position}</Text>
            <Text
              numberOfLines={2}
              style={{ flex: 1, color: ui.colors.textPrimary, fontSize: 13, fontWeight: qualified ? '700' : '500' }}
            >
              {row.teamName}
            </Text>
            <Text style={cell}>{row.played}</Text>
            <Text style={cell}>{row.wins}</Text>
            <Text style={cell}>{row.setsWon - row.setsLost}</Text>
            <Text style={cell}>{row.gamesWon - row.gamesLost}</Text>
            <Text style={[cell, { fontWeight: '800' }]}>{row.points}</Text>
          </View>
        );
      })}

      <View style={{ marginTop: 12, gap: 6 }}>
        {group.matches.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={{ flex: 1, color: ui.colors.textSecondary, fontSize: 12 }}>
              {slotName(m, 'A')} vs {slotName(m, 'B')}
            </Text>
            <Text
              style={{
                color: m.status === 'FINISHED' ? ui.colors.primary : ui.colors.textMuted,
                fontSize: 12,
                fontWeight: '700',
              }}
            >
              {m.status === 'FINISHED' ? formatScore(m) : 'Por jugar'}
            </Text>
          </View>
        ))}
      </View>
      <Text style={{ color: ui.colors.textMuted, fontSize: 11, marginTop: 10 }}>
        Clasifican los {qualifiers} primeros. Desempate: resultado entre ellos, diferencia de sets y de games.
      </Text>
    </AppCard>
  );
}

function BracketColumns({ rounds, highlight }: { rounds: KnockoutRound[]; highlight: Set<string> }) {
  if (!rounds.length) {
    return (
      <Text style={{ color: ui.colors.textMuted, textAlign: 'center', marginTop: 12 }}>
        Todavía no hay cuadro eliminatorio.
      </Text>
    );
  }
  const firstRoundCount = rounds[0].matches.length;
  const columnHeight = firstRoundCount * (MATCH_HEIGHT + MATCH_GAP);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 16 }}>
      {rounds.map((round) => (
        <View key={round.round} style={{ width: COLUMN_WIDTH }}>
          <Text
            style={{
              color: ui.colors.textSecondary,
              fontSize: 12,
              fontWeight: '800',
              textTransform: 'uppercase',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            {round.label}
          </Text>
          <View style={{ height: columnHeight, justifyContent: 'space-around' }}>
            {round.matches.map((m) => (
              <BracketMatch key={m.id} match={m} highlight={highlight} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function BracketMatch({ match, highlight }: { match: TournamentMatch; highlight: Set<string> }) {
  const bye = isByeMatch(match);
  const sets = match.score?.sets ?? [];
  const row = (side: 'A' | 'B') => {
    const regId = side === 'A' ? match.team_a_registration_id : match.team_b_registration_id;
    const won = !!regId && match.winner_registration_id === regId;
    const lost = match.status === 'FINISHED' && !!match.winner_registration_id && !won;
    const name = slotName(match, side);
    const placeholder = !regId;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26 }}>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: won ? '800' : '500',
            fontStyle: placeholder ? 'italic' : 'normal',
            color: won
              ? ui.colors.primary
              : placeholder || lost
                ? ui.colors.textMuted
                : highlight.has(regId!)
                  ? ui.colors.primary
                  : ui.colors.textPrimary,
          }}
        >
          {name}
        </Text>
        {sets.map((s, i) => (
          <Text key={i} style={{ width: 14, textAlign: 'center', fontSize: 12, color: ui.colors.textSecondary }}>
            {side === 'A' ? s.teamA : s.teamB}
          </Text>
        ))}
        {match.score?.walkover && won ? (
          <Text style={{ fontSize: 10, color: ui.colors.textSecondary, fontWeight: '700' }}>W.O.</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View
      style={{
        height: MATCH_HEIGHT,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: match.status === 'IN_PROGRESS' ? ui.colors.primary : ui.colors.border,
        backgroundColor: ui.colors.card,
        paddingHorizontal: 10,
        justifyContent: 'center',
        opacity: bye ? 0.55 : 1,
      }}
    >
      {row('A')}
      <View style={{ height: 1, backgroundColor: ui.colors.border }} />
      {row('B')}
    </View>
  );
}
