import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { createMatch } from '@/lib/tournament/api';
import {
  nextInternalMatchNumber,
  type TournamentMatch,
  type TournamentRegistration,
} from '@/lib/tournament/types';
import { hapticSelection } from '@/lib/haptics';
import { ui } from '@/theme/tokens';
import { AppCard, PrimaryButton, SectionHeader } from '@/components/x4match';

function errorMessage(e: any, fallback: string) {
  const raw = e?.response?.data?.message;
  return Array.isArray(raw) ? raw.join('\n') : typeof raw === 'string' ? raw : fallback;
}

/** Última pareja enfrentada (revancha) o, si no hay partidos, las dos primeras. */
function defaultTeams(pairs: TournamentRegistration[], matches: TournamentMatch[]): [string | null, string | null] {
  const ids = new Set(pairs.map((p) => p.id));
  const last = [...matches].reverse().find(
    (m) =>
      m.team_a_registration_id &&
      m.team_b_registration_id &&
      ids.has(m.team_a_registration_id) &&
      ids.has(m.team_b_registration_id),
  );
  if (last) return [last.team_a_registration_id!, last.team_b_registration_id!];
  return [pairs[0]?.id ?? null, pairs[1]?.id ?? null];
}

export function NewInternalMatchCard({
  tournamentId,
  pairs,
  matches,
  onCreated,
}: {
  tournamentId: string;
  pairs: TournamentRegistration[];
  matches: TournamentMatch[];
  onCreated: () => void;
}) {
  const fallback = useMemo(() => defaultTeams(pairs, matches), [pairs, matches]);
  const [picked, setPicked] = useState<[string | null, string | null] | null>(null);
  const [teamA, teamB] = picked ?? fallback;
  const nextNumber = nextInternalMatchNumber(matches);

  const createMutation = useMutation({
    mutationFn: () =>
      createMatch(tournamentId, {
        teamARegistrationId: teamA!,
        teamBRegistrationId: teamB!,
        round: nextNumber,
        roundLabel: `Partido ${nextNumber}`,
      }),
    onSuccess: () => {
      setPicked(null);
      onCreated();
    },
    onError: (e) => Alert.alert('Error', errorMessage(e, 'No se pudo abrir el partido')),
  });

  const onTogglePair = (pairId: string) => {
    void hapticSelection();
    if (teamA === pairId) return setPicked([null, teamB]);
    if (teamB === pairId) return setPicked([teamA, null]);
    if (!teamA) return setPicked([pairId, teamB]);
    setPicked([teamA, pairId]);
  };

  if (pairs.length < 2) return null;

  return (
    <>
      <SectionHeader
        title="Abrir otro partido"
        subtitle="El torneo interno puede tener todos los partidos que quieras"
        dark
      />
      <AppCard>
        <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
          Tocá dos parejas para enfrentarlas. Por defecto se propone la revancha del último partido.
        </Text>
        <View style={{ gap: 8 }}>
          {pairs.map((pair) => {
            const slot = pair.id === teamA ? 1 : pair.id === teamB ? 2 : null;
            return (
              <Pressable
                key={pair.id}
                onPress={() => onTogglePair(pair.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: slot != null }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: ui.radius.sm,
                  borderWidth: 1,
                  borderColor: slot ? ui.colors.primary : ui.colors.border,
                  backgroundColor: slot ? ui.colors.primarySoft : ui.colors.surface1,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: slot ? ui.colors.primary : 'transparent',
                    borderWidth: slot ? 0 : 1,
                    borderColor: ui.colors.border,
                  }}
                >
                  {slot ? (
                    <Text style={{ fontWeight: '800', fontSize: 12, color: ui.colors.onPrimary }}>{slot}</Text>
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, fontWeight: '600', color: ui.colors.textPrimary, fontSize: 13 }}
                >
                  {pair.player1_name} / {pair.player2_name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <PrimaryButton
          label={`Abrir partido ${nextNumber}`}
          fullWidth
          disabled={!teamA || !teamB}
          loading={createMutation.isPending}
          icon={<Ionicons name="add-circle-outline" size={18} color={ui.colors.onPrimary} />}
          onPress={() => createMutation.mutate()}
          style={{ marginTop: 14 }}
        />
      </AppCard>
    </>
  );
}
