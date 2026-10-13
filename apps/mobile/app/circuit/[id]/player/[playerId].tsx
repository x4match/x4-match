import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { safeMapCircuit } from '@/lib/mappers';
import { NO_CIRCUIT_ACCESS, apiErrorMessage, hasCircuitPermission } from '@/lib/circuits/staff';
import {
  LEVEL_REASON_LABELS,
  LEVEL_SOURCE_LABELS,
  PLAYER_STATUS_LABELS,
  fetchCircuitPlayer,
  levelLabel,
  setCircuitPlayerLevel,
  updateCircuitPlayer,
  type LevelChangeReason,
} from '@/lib/circuits/organizer';
import { ui } from '@/theme/tokens';
import {
  AppCard,
  Avatar,
  EmptyState,
  InputField,
  PrimaryButton,
  Screen,
  SectionHeader,
  Sheet,
  StackHeader,
  withCircuitsEnabled,
} from '@/components/x4match';
import { LevelBadge, LevelChips } from '@/components/circuit/LevelChips';

const PLACEMENT_LABELS: Record<string, string> = {
  WINNER: 'Campeón',
  FINALIST: 'Finalista',
  SEMI: 'Semifinal',
  QUARTERS: 'Cuartos',
  R16: 'Octavos',
  R32: '16avos',
  R64: '32avos',
  GROUP_ELIMINATED: 'Zona',
  PARTICIPATION: 'Participación',
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.textPrimary }}>{value}</Text>
      <Text style={{ fontSize: 11, color: ui.colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default withCircuitsEnabled(CircuitPlayerScreen);

function CircuitPlayerScreen() {
  const params = useLocalSearchParams<{ id: string; playerId: string }>();
  const circuitId = Array.isArray(params.id) ? params.id[0] : params.id;
  const playerId = Array.isArray(params.playerId) ? params.playerId[0] : params.playerId;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editingLevel, setEditingLevel] = useState(false);
  const [level, setLevel] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const { data: circuitData } = useQuery({
    queryKey: ['circuit', circuitId],
    queryFn: async () => (await api.get(`/circuits/${circuitId}`)).data,
    enabled: !!circuitId,
  });
  const circuit = useMemo(() => safeMapCircuit(circuitData), [circuitData]);
  const canEdit = hasCircuitPermission(circuit?.viewer ?? NO_CIRCUIT_ACCESS, 'circuit.edit');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['circuit-player', circuitId, playerId],
    queryFn: () => fetchCircuitPlayer(circuitId!, playerId!),
    enabled: !!circuitId && !!playerId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['circuit-player', circuitId, playerId] });
    queryClient.invalidateQueries({ queryKey: ['circuit-players', circuitId] });
  };

  const saveLevel = useMutation({
    mutationFn: () => {
      const current = data?.player.level ?? null;
      const reason: LevelChangeReason =
        current == null || level == null || current === level
          ? 'CORRECTION'
          : level < current
            ? 'PROMOTION'
            : 'RELEGATION';
      return setCircuitPlayerLevel(circuitId!, playerId!, { level: level!, reason, note: note.trim() || undefined });
    },
    onSuccess: () => {
      setEditingLevel(false);
      setNote('');
      invalidate();
    },
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudo cambiar la categoría')),
  });

  const setStatus = useMutation({
    mutationFn: (status: 'ACTIVE' | 'INACTIVE') => updateCircuitPlayer(circuitId!, playerId!, { status }),
    onSuccess: invalidate,
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudo actualizar')),
  });

  if (!data) {
    return (
      <Screen>
        <StackHeader title="Jugador" />
        <View style={{ padding: ui.spacing.lg }}>
          {isLoading ? (
            <Text style={{ color: ui.colors.textMuted }}>Cargando...</Text>
          ) : (
            <EmptyState
              icon={<Ionicons name="person-outline" size={32} color={ui.colors.textMuted} />}
              title="Jugador no encontrado"
            />
          )}
        </View>
      </Screen>
    );
  }

  const { player, history, stats } = data;
  const t = stats.totals;

  return (
    <Screen>
      <StackHeader title={player.full_name} />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >
        <AppCard style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={player.full_name} photo={player.photo_url} size="lg" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textPrimary }}>{player.full_name}</Text>
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                {LEVEL_SOURCE_LABELS[player.level_source] ?? ''}
                {player.status !== 'ACTIVE' ? ` · ${PLAYER_STATUS_LABELS[player.status]}` : ''}
              </Text>
              {player.app_level != null && player.app_level !== player.level ? (
                <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
                  En X4Match es {levelLabel(player.app_level)}
                </Text>
              ) : null}
            </View>
            <LevelBadge level={player.level} />
          </View>

          {canEdit && (player.phone || player.email || player.document) ? (
            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 10 }}>
              {[player.document && `DNI ${player.document}`, player.phone, player.email].filter(Boolean).join(' · ')}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {canEdit ? (
              <PrimaryButton
                label="Cambiar categoría"
                size="sm"
                onPress={() => {
                  setLevel(player.level);
                  setEditingLevel(true);
                }}
              />
            ) : null}
            {canEdit && player.status === 'PENDING' && player.level != null ? (
              <PrimaryButton
                label="Validar"
                size="sm"
                variant="outline"
                loading={setStatus.isPending}
                onPress={() => setStatus.mutate('ACTIVE')}
              />
            ) : null}
            {canEdit && player.status !== 'PENDING' ? (
              <PrimaryButton
                label={player.status === 'INACTIVE' ? 'Reactivar' : 'Dar de baja'}
                size="sm"
                variant="ghost"
                loading={setStatus.isPending}
                onPress={() => setStatus.mutate(player.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE')}
              />
            ) : null}
            {player.user_id ? (
              <PrimaryButton
                label="Perfil X4Match"
                size="sm"
                variant="ghost"
                onPress={() => router.push(`/player/${player.user_id}` as any)}
              />
            ) : null}
          </View>
        </AppCard>

        <SectionHeader title="Estadísticas en el circuito" />
        <AppCard style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row' }}>
            <Stat label="Torneos" value={t.tournaments} />
            <Stat label="Partidos" value={t.matches} />
            <Stat label="Ganados" value={t.wins} />
            <Stat label="% victorias" value={`${t.winRate}%`} />
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: ui.colors.border, marginTop: 4 }}>
            <Stat label="Títulos" value={t.titles} />
            <Stat label="Finales" value={t.finals} />
            <Stat label="Sets" value={`${t.setsWon}-${t.setsLost}`} />
            <Stat label="Games" value={`${t.gamesWon}-${t.gamesLost}`} />
          </View>
        </AppCard>

        {stats.ranking.length ? (
          <>
            <SectionHeader title="Ranking" />
            {stats.ranking.map((r) => (
              <AppCard key={r.category_id} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: ui.colors.primary, width: 48 }}>
                    {r.position}°
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                      {[r.category_gender, r.category_label].filter(Boolean).join(' ')}
                    </Text>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                      {r.tournaments_played} torneo(s) · {r.wins}G {r.losses}P
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '800', color: ui.colors.textPrimary }}>{r.points} pts</Text>
                </View>
              </AppCard>
            ))}
          </>
        ) : null}

        {stats.placements.length ? (
          <>
            <SectionHeader title="Resultados por torneo" />
            {stats.placements.map((p) => (
              <TouchableOpacity
                key={`${p.tournament_id}-${p.placement}`}
                onPress={() => router.push(`/tournament/${p.tournament_id}` as any)}
              >
                <AppCard style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }} numberOfLines={1}>
                        {p.tournament_name}
                      </Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                        {p.category_label} · {PLACEMENT_LABELS[p.placement] ?? p.placement}
                      </Text>
                    </View>
                    <Text style={{ fontWeight: '800', color: ui.colors.primary }}>+{p.points}</Text>
                  </View>
                </AppCard>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {stats.recent.length ? (
          <>
            <SectionHeader title="Últimos partidos" />
            {stats.recent.map((m) => (
              <AppCard key={m.matchId} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: m.won ? ui.colors.successSoft : ui.colors.dangerSoft,
                    }}
                  >
                    <Text style={{ fontWeight: '800', color: m.won ? ui.colors.success : ui.colors.danger }}>
                      {m.won ? 'G' : 'P'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }} numberOfLines={1}>
                      vs {m.rival || 'Pareja'}
                    </Text>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary }} numberOfLines={1}>
                      {m.tournamentName}
                      {m.roundLabel ? ` · ${m.roundLabel}` : ''}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    {m.walkover ? 'W.O.' : m.sets.map(([a, b]) => `${a}-${b}`).join(' ')}
                  </Text>
                </View>
              </AppCard>
            ))}
          </>
        ) : null}

        <SectionHeader title="Historial de categoría" />
        {history.map((h) => (
          <View
            key={h.id}
            style={{
              flexDirection: 'row',
              gap: 10,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: ui.colors.border,
            }}
          >
            <Ionicons
              name={
                h.reason === 'PROMOTION'
                  ? 'arrow-up-circle'
                  : h.reason === 'RELEGATION'
                    ? 'arrow-down-circle'
                    : h.reason === 'INITIAL'
                      ? 'add-circle-outline'
                      : 'create-outline'
              }
              size={20}
              color={
                h.reason === 'PROMOTION'
                  ? ui.colors.success
                  : h.reason === 'RELEGATION'
                    ? ui.colors.danger
                    : ui.colors.textMuted
              }
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
                {LEVEL_REASON_LABELS[h.reason]}:{' '}
                {h.from_level != null ? `${levelLabel(h.from_level)} → ` : ''}
                {levelLabel(h.to_level)}
              </Text>
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                {formatDate(h.created_at)}
                {h.changed_by_name ? ` · ${h.changed_by_name}` : ''}
                {h.note ? ` · ${h.note}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <Sheet visible={editingLevel} onClose={() => setEditingLevel(false)} title="Categoría en el circuito">
        <View>
          <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 12 }}>
            Actual: {levelLabel(player.level)}. Si sube queda como ascenso, si baja como descenso.
          </Text>
          <LevelChips value={level} onChange={setLevel} />
          <InputField label="Motivo (opcional)" value={note} onChangeText={setNote} maxLength={300} />
          <PrimaryButton
            label="Guardar"
            fullWidth
            loading={saveLevel.isPending}
            disabled={level == null || level === player.level || saveLevel.isPending}
            onPress={() => saveLevel.mutate()}
          />
        </View>
      </Sheet>
    </Screen>
  );
}
