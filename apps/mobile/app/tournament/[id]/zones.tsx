import { useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  closeZone,
  fetchGroups,
  fetchZoneDraft,
  generateFixture,
  reopenZone,
  resetZoneDraft,
  saveZoneDraft,
} from '@/lib/tournament/api';
import { FIXTURE_HAS_RESULTS } from '@/lib/tournament/brackets';
import type { ZoneDraft } from '@/lib/tournament/types';
import { apiErrorMessage } from '@/lib/circuits/staff';
import { ui } from '@/theme/tokens';
import { AppCard, EmptyState, PrimaryButton, Screen, SectionHeader, StackHeader, StatusPill } from '@/components/x4match';

type EditableZone = { code: string; teamIds: string[] };

function zoneCode(index: number) {
  let n = index;
  let code = '';
  do {
    code = String.fromCharCode(65 + (n % 26)) + code;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return code;
}

function toEditable(draft?: ZoneDraft): EditableZone[] {
  return (draft?.groups ?? []).map((g) => ({ code: g.code, teamIds: g.teams.map((t) => t.id) }));
}

export default function TournamentZonesScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [zones, setZones] = useState<EditableZone[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const draftQuery = useQuery({
    queryKey: ['tournament-zone-draft', id],
    queryFn: () => fetchZoneDraft(id!),
    enabled: !!id,
  });
  const draft = draftQuery.data;
  const fixtureGenerated = (draft?.groupMatches ?? 0) > 0;

  const groupsQuery = useQuery({
    queryKey: ['tournament-groups', id],
    queryFn: () => fetchGroups(id!),
    enabled: !!id && fixtureGenerated,
  });

  useEffect(() => {
    if (!dirty) setZones(toEditable(draft));
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const teamsById = useMemo(() => {
    const map = new Map<string, { name: string; seed: number | null }>();
    for (const g of draft?.groups ?? []) for (const t of g.teams) map.set(t.id, { name: t.name, seed: t.seed });
    return map;
  }, [draft]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tournament-zone-draft', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-groups', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-matches', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-standings', id] });
  };

  const payload = () => zones.filter((z) => z.teamIds.length > 0);

  const save = useMutation({
    mutationFn: () => saveZoneDraft(id!, payload()),
    onSuccess: (next) => {
      queryClient.setQueryData(['tournament-zone-draft', id], next);
      setDirty(false);
      setZones(toEditable(next));
    },
    onError: (error) => Alert.alert('No se pudo guardar', apiErrorMessage(error, 'Revisá las zonas')),
  });

  const reset = useMutation({
    mutationFn: () => resetZoneDraft(id!),
    onSuccess: (next) => {
      queryClient.setQueryData(['tournament-zone-draft', id], next);
      setDirty(false);
      setSelected(null);
      setZones(toEditable(next));
    },
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudo rearmar')),
  });

  const generate = useMutation({
    mutationFn: async (force: boolean) => {
      if (dirty) await saveZoneDraft(id!, payload());
      return generateFixture(id!, { mode: 'GROUPS_THEN_ELIMINATION', reset: true, force });
    },
    onSuccess: () => {
      setDirty(false);
      invalidate();
      Alert.alert('Partidos generados', 'Se armaron los partidos de cada zona. El cuadro se completa al cerrar las zonas.');
    },
    onError: (error: any, force) => {
      const data = error?.response?.data;
      if (data?.code === FIXTURE_HAS_RESULTS && !force) {
        Alert.alert('Hay resultados cargados', data.message, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Regenerar igual', style: 'destructive', onPress: () => generate.mutate(true) },
        ]);
        return;
      }
      Alert.alert('No se pudo generar', apiErrorMessage(error, 'Revisá las zonas'));
    },
  });

  const toggleZone = useMutation({
    mutationFn: async ({ code, reopen }: { code: string; reopen: boolean }) => {
      if (reopen) await reopenZone(id!, code);
      else await closeZone(id!, code);
    },
    onSuccess: invalidate,
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudo actualizar la zona')),
  });

  const moveSelectedTo = (code: string) => {
    if (!selected) return;
    setZones((prev) =>
      prev.map((z) => {
        const without = z.teamIds.filter((t) => t !== selected);
        return z.code === code ? { ...z, teamIds: [...without, selected] } : { ...z, teamIds: without };
      }),
    );
    setSelected(null);
    setDirty(true);
  };

  const addZone = () => {
    setZones((prev) => [...prev, { code: zoneCode(prev.length), teamIds: [] }]);
    setDirty(true);
  };

  const confirmClose = (code: string, played: number, total: number) => {
    const pending = total - played;
    Alert.alert(
      `Cerrar zona ${code}`,
      pending > 0
        ? `Quedan ${pending} partido(s) sin jugar: se cancelan y la zona se define con lo jugado.`
        : 'La zona se define con los resultados cargados y los clasificados pasan al cuadro.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar zona', style: 'destructive', onPress: () => toggleZone.mutate({ code, reopen: false }) },
      ],
    );
  };

  const singleTeamZone = zones.some((z) => z.teamIds.length === 1);
  const refreshing = draftQuery.isRefetching || groupsQuery.isRefetching;

  return (
    <Screen>
      <StackHeader title="Zonas" />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              draftQuery.refetch();
              if (fixtureGenerated) groupsQuery.refetch();
            }}
            tintColor={ui.colors.primary}
          />
        }
      >
        {draftQuery.isLoading ? (
          <Text style={{ color: ui.colors.textMuted }}>Cargando...</Text>
        ) : !draft || draft.teams < 2 ? (
          <EmptyState
            icon={<Ionicons name="grid-outline" size={32} color={ui.colors.textMuted} />}
            title="Faltan parejas"
            description="Las zonas se arman con las parejas aprobadas. Necesitás al menos 2."
          />
        ) : fixtureGenerated ? (
          <>
            <AppCard style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: ui.colors.textSecondary, lineHeight: 19 }}>
                Los partidos de zona ya están generados ({draft.playedMatches}/{draft.groupMatches} jugados). Cuando
                una zona termina se cierra sola; si querés definirla antes, cerrala a mano y los partidos sin jugar
                se cancelan.
              </Text>
              <PrimaryButton
                label="Cargar resultados"
                variant="outline"
                size="sm"
                style={{ marginTop: 10, alignSelf: 'flex-start' }}
                onPress={() => router.push(`/tournament/${id}/results` as any)}
              />
            </AppCard>
            {(groupsQuery.data?.groups ?? []).map((g) => {
              const played = g.played ?? 0;
              const total = g.total ?? 0;
              return (
                <AppCard key={g.code} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: ui.colors.textPrimary }}>
                      Zona {g.code}
                    </Text>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginRight: 8 }}>
                      {played}/{total}
                    </Text>
                    {g.complete ? <StatusPill status={g.closedManually ? 'Cerrada a mano' : 'Terminada'} /> : null}
                  </View>
                  {g.standings.map((s, index) => (
                    <View key={s.registrationId} style={{ flexDirection: 'row', paddingVertical: 4, gap: 8 }}>
                      <Text style={{ width: 18, color: ui.colors.textMuted, fontWeight: '700' }}>{index + 1}</Text>
                      <Text
                        style={{
                          flex: 1,
                          color: ui.colors.textPrimary,
                          fontWeight: s.qualified ? '700' : '400',
                        }}
                        numberOfLines={1}
                      >
                        {s.teamName}
                      </Text>
                      <Text style={{ color: ui.colors.textSecondary, fontSize: 12 }}>
                        {s.wins}G {s.losses}P
                      </Text>
                      {s.qualified ? <Ionicons name="checkmark-circle" size={16} color={ui.colors.success} /> : null}
                    </View>
                  ))}
                  <PrimaryButton
                    label={g.complete ? 'Reabrir zona' : 'Cerrar zona'}
                    size="sm"
                    variant={g.complete ? 'ghost' : 'outline'}
                    style={{ marginTop: 10, alignSelf: 'flex-start' }}
                    loading={toggleZone.isPending && toggleZone.variables?.code === g.code}
                    onPress={() =>
                      g.complete ? toggleZone.mutate({ code: g.code, reopen: true }) : confirmClose(g.code, played, total)
                    }
                  />
                </AppCard>
              );
            })}
          </>
        ) : (
          <>
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 12, lineHeight: 19 }}>
              {draft.saved
                ? 'Zonas armadas a mano. Tocá una pareja y después la zona a la que la querés mover.'
                : 'Propuesta automática por ranking. Tocá una pareja y después la zona a la que la querés mover.'}
            </Text>
            {draft.error ? (
              <AppCard style={{ marginBottom: 12, backgroundColor: ui.colors.warningSoft }}>
                <Text style={{ color: ui.colors.textPrimary, fontSize: 13 }}>{draft.error}</Text>
              </AppCard>
            ) : null}

            {zones.map((zone) => {
              const target = selected != null && !zone.teamIds.includes(selected);
              return (
                <AppCard
                  key={zone.code}
                  style={{
                    marginBottom: 12,
                    borderWidth: target ? 1.5 : 0,
                    borderColor: target ? ui.colors.primary : 'transparent',
                  }}
                >
                  <TouchableOpacity
                    disabled={!target}
                    onPress={() => moveSelectedTo(zone.code)}
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}
                  >
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: ui.colors.textPrimary }}>
                      Zona {zone.code}
                    </Text>
                    {target ? (
                      <Text style={{ color: ui.colors.primary, fontWeight: '700' }}>Mover acá</Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                        {zone.teamIds.length} pareja(s)
                      </Text>
                    )}
                  </TouchableOpacity>
                  {zone.teamIds.length === 0 ? (
                    <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Vacía (no se guarda)</Text>
                  ) : null}
                  {zone.teamIds.map((teamId) => {
                    const team = teamsById.get(teamId);
                    const isSelected = selected === teamId;
                    return (
                      <TouchableOpacity
                        key={teamId}
                        onPress={() => setSelected(isSelected ? null : teamId)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          paddingVertical: 8,
                          paddingHorizontal: 10,
                          marginTop: 4,
                          borderRadius: ui.radius.md,
                          backgroundColor: isSelected ? ui.colors.primarySoft : ui.colors.cardMuted,
                        }}
                      >
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'reorder-two-outline'}
                          size={16}
                          color={isSelected ? ui.colors.primary : ui.colors.textMuted}
                        />
                        <Text style={{ flex: 1, color: ui.colors.textPrimary }} numberOfLines={1}>
                          {team?.name ?? 'Pareja'}
                        </Text>
                        {team?.seed ? (
                          <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>#{team.seed}</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                  {zone.teamIds.length === 1 ? (
                    <Text style={{ color: ui.colors.danger, fontSize: 12, marginTop: 6 }}>
                      Una zona necesita al menos 2 parejas.
                    </Text>
                  ) : null}
                </AppCard>
              );
            })}

            <PrimaryButton label="Agregar zona" variant="ghost" fullWidth onPress={addZone} />

            <SectionHeader title="Guardar y generar" />
            <PrimaryButton
              label="Guardar zonas"
              variant="outline"
              fullWidth
              disabled={!dirty || singleTeamZone}
              loading={save.isPending}
              onPress={() => save.mutate()}
              style={{ marginBottom: 8 }}
            />
            <PrimaryButton
              label="Generar partidos de zona"
              fullWidth
              disabled={singleTeamZone || generate.isPending}
              loading={generate.isPending}
              onPress={() =>
                Alert.alert(
                  'Generar partidos',
                  'Se crean los partidos de cada zona con esta distribución y el cuadro se va completando al cerrar las zonas.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Generar', onPress: () => generate.mutate(false) },
                  ],
                )
              }
              style={{ marginBottom: 8 }}
            />
            {draft.saved || dirty ? (
              <PrimaryButton
                label="Rearmar automático por ranking"
                variant="ghost"
                fullWidth
                loading={reset.isPending}
                onPress={() =>
                  Alert.alert('Rearmar zonas', 'Se descartan los cambios a mano y se vuelve a la propuesta por ranking.', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Rearmar', style: 'destructive', onPress: () => reset.mutate() },
                  ])
                }
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
