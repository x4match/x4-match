import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMatches, saveResultsBulk, type BulkResultItem } from '@/lib/tournament/api';
import { bothTeamsDefined, isByeMatch, slotName } from '@/lib/tournament/brackets';
import type { TournamentMatch } from '@/lib/tournament/types';
import { apiErrorMessage } from '@/lib/circuits/staff';
import { ui } from '@/theme/tokens';
import { AppCard, EmptyState, PrimaryButton, Screen, SectionHeader, StackHeader } from '@/components/x4match';

type Row = { games: string[]; walkover?: 'A' | 'B' };

const EMPTY_ROW: Row = { games: ['', '', '', '', '', ''] };

function toResult(matchId: string, row: Row): BulkResultItem | null {
  if (row.walkover) return { matchId, walkoverWinner: row.walkover };
  const sets: { teamA: number; teamB: number }[] = [];
  for (let i = 0; i < 3; i += 1) {
    const a = row.games[i * 2].trim();
    const b = row.games[i * 2 + 1].trim();
    if (!a && !b) continue;
    sets.push({ teamA: Number(a) || 0, teamB: Number(b) || 0 });
  }
  return sets.length ? { matchId, sets } : null;
}

function sectionOf(m: TournamentMatch) {
  if (m.group_name) return `Zona ${m.group_name}`;
  return m.round_label || `Ronda ${m.round}`;
}

export default function TournamentBulkResultsScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: matches = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['tournament-matches', id],
    queryFn: () => fetchMatches(id!),
    enabled: !!id,
  });

  const sections = useMemo(() => {
    const pending = matches
      .filter((m) => (m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS') && !isByeMatch(m) && bothTeamsDefined(m))
      .sort((a, b) => {
        const phase = (m: TournamentMatch) => (m.phase === 'GROUP' || m.group_name ? 0 : 1);
        return (
          phase(a) - phase(b) ||
          (a.group_name ?? '').localeCompare(b.group_name ?? '') ||
          a.round - b.round ||
          (a.bracket_position ?? 0) - (b.bracket_position ?? 0)
        );
      });
    const map = new Map<string, TournamentMatch[]>();
    for (const m of pending) {
      const key = sectionOf(m);
      map.set(key, [...(map.get(key) ?? []), m]);
    }
    return [...map.entries()];
  }, [matches]);

  const filled = useMemo(
    () =>
      Object.entries(rows)
        .map(([matchId, row]) => toResult(matchId, row))
        .filter((r): r is BulkResultItem => r != null),
    [rows],
  );

  const setGame = (matchId: string, index: number, value: string) =>
    setRows((prev) => {
      const row = prev[matchId] ?? EMPTY_ROW;
      const games = [...row.games];
      games[index] = value.replace(/[^0-9]/g, '').slice(0, 2);
      return { ...prev, [matchId]: { games, walkover: undefined } };
    });

  const setWalkover = (matchId: string, side: 'A' | 'B') =>
    setRows((prev) => {
      const row = prev[matchId] ?? EMPTY_ROW;
      return { ...prev, [matchId]: { ...EMPTY_ROW, walkover: row.walkover === side ? undefined : side } };
    });

  const save = useMutation({
    mutationFn: () => saveResultsBulk(id!, filled),
    onSuccess: (res) => {
      const nextErrors: Record<string, string> = {};
      for (const r of res.results) if (!r.ok) nextErrors[r.matchId] = r.error || 'No se pudo guardar';
      setErrors(nextErrors);
      setRows((prev) => {
        const next: Record<string, Row> = {};
        for (const matchId of Object.keys(nextErrors)) if (prev[matchId]) next[matchId] = prev[matchId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['tournament-matches', id] });
      queryClient.invalidateQueries({ queryKey: ['tournament-groups', id] });
      queryClient.invalidateQueries({ queryKey: ['tournament-standings', id] });
      queryClient.invalidateQueries({ queryKey: ['tournament-zone-draft', id] });
      Alert.alert(
        res.failed ? 'Carga parcial' : 'Resultados guardados',
        res.failed
          ? `Se guardaron ${res.saved} y fallaron ${res.failed}. Revisá los marcados en rojo.`
          : `Se guardaron ${res.saved} resultado(s).`,
      );
    },
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudieron guardar los resultados')),
  });

  const cell = {
    borderWidth: 1,
    borderColor: ui.colors.border,
    borderRadius: ui.radius.sm,
    width: 38,
    paddingVertical: 6,
    textAlign: 'center' as const,
    color: ui.colors.textPrimary,
    backgroundColor: ui.colors.card,
    fontWeight: '700' as const,
  };

  const teamLine = (m: TournamentMatch, side: 'A' | 'B', row: Row) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: side === 'B' ? 6 : 0 }}>
      <TouchableOpacity onPress={() => setWalkover(m.id, side)} hitSlop={6} style={{ flex: 1 }}>
        <Text
          style={{
            color: row.walkover === side ? ui.colors.success : ui.colors.textPrimary,
            fontWeight: row.walkover === side ? '800' : '600',
          }}
          numberOfLines={1}
        >
          {slotName(m, side)}
          {row.walkover === side ? '  · gana W.O.' : ''}
        </Text>
      </TouchableOpacity>
      {[0, 1, 2].map((set) => (
        <TextInput
          key={set}
          value={row.games[set * 2 + (side === 'A' ? 0 : 1)]}
          onChangeText={(v) => setGame(m.id, set * 2 + (side === 'A' ? 0 : 1), v)}
          keyboardType="number-pad"
          maxLength={2}
          editable={!row.walkover}
          placeholder="-"
          placeholderTextColor={ui.colors.textMuted}
          style={[cell, row.walkover ? { opacity: 0.4 } : null]}
        />
      ))}
    </View>
  );

  return (
    <Screen>
      <StackHeader title="Carga de resultados" />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >
        <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 12, lineHeight: 19 }}>
          Cargá los games de cada set (el 3° solo si hubo). Tocá el nombre de una pareja para darle el partido por
          W.O. Se guardan todos juntos: primero las zonas y después el cuadro.
        </Text>

        {isLoading ? (
          <Text style={{ color: ui.colors.textMuted }}>Cargando...</Text>
        ) : sections.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="checkmark-done-outline" size={32} color={ui.colors.textMuted} />}
            title="No hay partidos pendientes"
            description="Los partidos aparecen acá cuando tienen las dos parejas definidas."
          />
        ) : (
          sections.map(([title, list]) => (
            <View key={title}>
              <SectionHeader title={title} subtitle={`${list.length} pendiente(s)`} />
              {list.map((m) => {
                const row = rows[m.id] ?? EMPTY_ROW;
                const error = errors[m.id];
                return (
                  <AppCard
                    key={m.id}
                    style={{
                      marginBottom: 8,
                      borderWidth: error ? 1 : 0,
                      borderColor: error ? ui.colors.danger : 'transparent',
                    }}
                  >
                    {m.court_label || m.scheduled_at ? (
                      <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginBottom: 6 }}>
                        {[
                          m.court_label,
                          m.scheduled_at &&
                            new Date(m.scheduled_at).toLocaleString('es-AR', {
                              weekday: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                    {teamLine(m, 'A', row)}
                    {teamLine(m, 'B', row)}
                    {error ? <Text style={{ color: ui.colors.danger, fontSize: 12, marginTop: 6 }}>{error}</Text> : null}
                  </AppCard>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
      {sections.length ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: ui.spacing.lg,
            backgroundColor: ui.colors.surface1,
            borderTopWidth: 1,
            borderTopColor: ui.colors.border,
          }}
        >
          <PrimaryButton
            label={filled.length ? `Guardar ${filled.length} resultado(s)` : 'Cargá al menos un resultado'}
            fullWidth
            disabled={!filled.length || save.isPending}
            loading={save.isPending}
            onPress={() => save.mutate()}
          />
        </View>
      ) : null}
    </Screen>
  );
}
