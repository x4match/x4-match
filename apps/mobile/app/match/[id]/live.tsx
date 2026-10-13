import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { ui } from '@/theme/tokens';
import { hapticMedium, hapticSuccess } from '@/lib/haptics';
import {
  AppCard,
  PressableScale,
  PrimaryButton,
  Screen,
  SegmentedControl,
  StackHeader,
  useToast,
} from '@/components/ui';
import { LiveScoreboard } from '@/components/match/LiveScoreboard';
import {
  addMatchLivePoint,
  discardMatchLiveScore,
  liveScoreQueryKey,
  startMatchLiveScore,
  teamLabel,
  undoMatchLivePoint,
  useMatchLiveScore,
  type LiveDeuceMode,
  type LiveTeam,
  type MatchLiveScore,
} from '@/lib/match/live-score';

function KeepScreenAwake() {
  useKeepAwake('match-live-score');
  return null;
}

function errorMessage(error: any, fallback: string) {
  const msg = error?.response?.data?.message;
  return Array.isArray(msg) ? msg.join('\n') : msg || error?.message || fallback;
}

export default function MatchLiveScoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [deuceMode, setDeuceMode] = useState<LiveDeuceMode>('advantage');
  const [thirdSet, setThirdSet] = useState<'full' | 'super'>('full');

  const { data: live, isLoading, refetch } = useMatchLiveScore(id);
  const key = liveScoreQueryKey(id ?? '');

  const applyResponse = (data: MatchLiveScore) => {
    queryClient.setQueryData(key, data);
    if (data.status !== 'LIVE') {
      queryClient.invalidateQueries({ queryKey: ['match', id] });
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
    }
  };

  const onMutationError = (error: any, fallback: string) => {
    if (error?.response?.status === 409) {
      void refetch();
      showToast(errorMessage(error, 'El marcador cambió'), 'info');
      return;
    }
    Alert.alert('Error', errorMessage(error, fallback));
  };

  const startMutation = useMutation({
    mutationFn: () =>
      startMatchLiveScore(id!, { deuceMode, superTiebreak: thirdSet === 'super' }),
    onSuccess: (data) => {
      applyResponse(data);
      queryClient.invalidateQueries({ queryKey: ['match', id] });
      void hapticSuccess();
    },
    onError: (error) => onMutationError(error, 'No se pudo iniciar el marcador'),
  });

  const pointMutation = useMutation({
    mutationFn: (team: LiveTeam) => addMatchLivePoint(id!, team, live?.version),
    onSuccess: (data) => {
      applyResponse(data);
      if (data.status === 'FINISHED') {
        void hapticSuccess();
        Alert.alert(
          '¡Partido terminado!',
          'El resultado se envió a los demás jugadores para que lo confirmen.',
        );
      }
    },
    onError: (error) => onMutationError(error, 'No se pudo sumar el punto'),
  });

  const undoMutation = useMutation({
    mutationFn: () => undoMatchLivePoint(id!, live?.version),
    onSuccess: applyResponse,
    onError: (error) => onMutationError(error, 'No se pudo deshacer'),
  });

  const discardMutation = useMutation({
    mutationFn: () => discardMatchLiveScore(id!),
    onSuccess: (data) => {
      applyResponse(data);
      router.back();
    },
    onError: (error) => onMutationError(error, 'No se pudo descartar el marcador'),
  });

  const busy = pointMutation.isPending || undoMutation.isPending || discardMutation.isPending;

  const scorePoint = (team: LiveTeam) => {
    if (busy || !live) return;
    void hapticMedium();
    if (live.matchPointFor === team) {
      Alert.alert(
        'Punto de partido',
        `Si sumás este punto, gana ${teamLabel(live.teams[team], `el equipo ${team}`)} y se envía el resultado.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sumar y terminar', onPress: () => pointMutation.mutate(team) },
        ],
      );
      return;
    }
    pointMutation.mutate(team);
  };

  const confirmDiscard = () => {
    Alert.alert(
      'Descartar marcador',
      'Se borra el marcador en vivo de este partido. Después podés cargar el resultado a mano.',
      [
        { text: 'Volver', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => discardMutation.mutate() },
      ],
    );
  };

  if (isLoading || !live) {
    return (
      <Screen>
        <StackHeader title="Marcador en vivo" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ui.colors.primary} />
        </View>
      </Screen>
    );
  }

  const viewer = live.viewer;

  return (
    <Screen>
      {live.status === 'LIVE' && <KeepScreenAwake />}
      <StackHeader title="Marcador en vivo" />
      <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 48 }}>
        {live.status === 'NOT_STARTED' ? (
          <>
            <AppCard>
              <Text style={{ color: ui.colors.textPrimary, fontSize: 17, fontWeight: '700' }}>
                Llevá el marcador punto a punto
              </Text>
              <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
                Cualquier jugador del partido puede sumar puntos y todos ven el marcador al instante.
                Al terminar, el resultado se propone automáticamente para que lo confirmen.
              </Text>
              <View style={{ marginTop: ui.spacing.lg, gap: 6 }}>
                {(['A', 'B'] as LiveTeam[]).map((team) => (
                  <Text key={team} style={{ color: ui.colors.textPrimary, fontSize: 14 }}>
                    <Text style={{ color: ui.colors.textMuted }}>Equipo {team}: </Text>
                    {teamLabel(live.teams[team], 'Sin jugadores')}
                  </Text>
                ))}
              </View>
            </AppCard>

            {viewer?.canStart ? (
              <AppCard>
                <Text style={{ color: ui.colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
                  En 40-40
                </Text>
                <SegmentedControl
                  options={[
                    { value: 'advantage', label: 'Ventaja' },
                    { value: 'golden', label: 'Punto de oro' },
                  ]}
                  value={deuceMode}
                  onChange={setDeuceMode}
                />
                <Text
                  style={{ color: ui.colors.textSecondary, fontSize: 12, marginTop: 16, marginBottom: 8 }}
                >
                  Tercer set
                </Text>
                <SegmentedControl
                  options={[
                    { value: 'full', label: 'Set completo' },
                    { value: 'super', label: 'Super tie-break' },
                  ]}
                  value={thirdSet}
                  onChange={setThirdSet}
                />
                <PrimaryButton
                  label="Empezar partido"
                  fullWidth
                  loading={startMutation.isPending}
                  onPress={() => startMutation.mutate()}
                  style={{ marginTop: ui.spacing.xl }}
                  icon={<Ionicons name="play" size={18} color={ui.colors.onPrimary} />}
                />
              </AppCard>
            ) : (
              <AppCard style={{ backgroundColor: ui.colors.surfaceAlt }}>
                <Text style={{ color: ui.colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
                  {viewer?.isParticipant
                    ? 'El marcador en vivo solo se puede iniciar con el partido completo y sin resultado cargado.'
                    : 'El partido todavía no empezó. Cuando los jugadores inicien el marcador lo vas a ver acá en vivo.'}
                </Text>
              </AppCard>
            )}
          </>
        ) : (
          <>
            <LiveScoreboard live={live} />

            {live.status === 'LIVE' && viewer?.canScore && (
              <View style={{ marginTop: ui.spacing.xl, gap: ui.spacing.md }}>
                <View style={{ flexDirection: 'row', gap: ui.spacing.md }}>
                  {(['A', 'B'] as LiveTeam[]).map((team) => (
                    <PressableScale
                      key={team}
                      disabled={busy}
                      onPress={() => scorePoint(team)}
                      haptic={false}
                      accessibilityLabel={`Sumar punto al equipo ${team}`}
                      style={{
                        flex: 1,
                        minHeight: 132,
                        borderRadius: ui.radius.xl,
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: ui.spacing.md,
                        backgroundColor: team === 'A' ? ui.colors.primary : ui.colors.surface3,
                        borderWidth: 1,
                        borderColor: team === 'A' ? ui.colors.primary : ui.colors.borderStrong,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 34,
                          fontWeight: '800',
                          color: team === 'A' ? ui.colors.onPrimary : ui.colors.textPrimary,
                        }}
                      >
                        +1
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          fontWeight: '700',
                          textAlign: 'center',
                          color: team === 'A' ? ui.colors.onPrimary : ui.colors.textPrimary,
                        }}
                      >
                        {teamLabel(live.teams[team], `Equipo ${team}`)}
                      </Text>
                    </PressableScale>
                  ))}
                </View>

                <PrimaryButton
                  label="Deshacer último punto"
                  variant="dark"
                  fullWidth
                  disabled={!live.canUndo || busy}
                  loading={undoMutation.isPending}
                  onPress={() => undoMutation.mutate()}
                  icon={<Ionicons name="arrow-undo" size={18} color={ui.colors.textPrimary} />}
                />
                <PrimaryButton
                  label="Descartar marcador"
                  variant="ghost"
                  fullWidth
                  disabled={busy}
                  onPress={confirmDiscard}
                />
              </View>
            )}

            {live.status === 'FINISHED' && (
              <AppCard style={{ marginTop: ui.spacing.lg, backgroundColor: ui.colors.successSoft }}>
                <Text style={{ color: ui.colors.success, fontSize: 16, fontWeight: '700' }}>
                  Ganó {teamLabel(live.teams[live.winner ?? 'A'], `el equipo ${live.winner}`)}
                </Text>
                <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginTop: 6 }}>
                  El resultado quedó propuesto. Los jugadores lo confirman desde el detalle del partido.
                </Text>
                <PrimaryButton
                  label="Ir al partido"
                  variant="outline"
                  fullWidth
                  onPress={() =>
                    router.canGoBack() ? router.back() : router.replace(`/match/${id}` as any)
                  }
                  style={{ marginTop: ui.spacing.md }}
                />
              </AppCard>
            )}

            {live.lastUpdatedBy?.name && live.status === 'LIVE' && (live.totalPoints ?? 0) > 0 ? (
              <Text
                style={{ color: ui.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: ui.spacing.lg }}
              >
                Último punto cargado por {live.lastUpdatedBy.name}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
