import { useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { safeMapCircuit } from '@/lib/mappers';
import { NO_CIRCUIT_ACCESS, apiErrorMessage, circuitBrand, hasCircuitPermission } from '@/lib/circuits/staff';
import {
  PLAYER_STATUS_LABELS,
  createCircuitPlayer,
  fetchCircuitPlayers,
  levelLabel,
  syncCircuitPlayers,
  type CircuitPlayer,
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
  SegmentedControl,
  Sheet,
  StackHeader,
  withCircuitsEnabled,
} from '@/components/x4match';
import { PlayerSearchField, type PickedPlayer } from '@/components/challenge/PlayerSearchField';
import { LevelBadge, LevelChips } from '@/components/circuit/LevelChips';

type NewPlayerMode = 'app' | 'manual';

function PlayerRow({ player, onPress }: { player: CircuitPlayer; onPress: () => void }) {
  const differsFromApp = player.app_level != null && player.level != null && player.app_level !== player.level;
  return (
    <AppCard onPress={onPress} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={player.full_name} photo={player.photo_url} size="sm" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }} numberOfLines={1}>
            {player.full_name}
          </Text>
          <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {[
              player.user_id ? 'X4Match' : 'Sin cuenta',
              player.tournaments_played ? `${player.tournaments_played} torneo(s)` : null,
              differsFromApp ? `App: ${levelLabel(player.app_level)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {player.status !== 'ACTIVE' ? (
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: player.status === 'PENDING' ? ui.colors.warning : ui.colors.textMuted,
            }}
          >
            {PLAYER_STATUS_LABELS[player.status]}
          </Text>
        ) : null}
        <LevelBadge level={player.level} muted={player.status !== 'ACTIVE'} />
      </View>
    </AppCard>
  );
}

export default withCircuitsEnabled(CircuitPlayersScreen);

function CircuitPlayersScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const circuitId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const [onlyPending, setOnlyPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<NewPlayerMode>('app');
  const [picked, setPicked] = useState<PickedPlayer | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const [newLevel, setNewLevel] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: circuitData } = useQuery({
    queryKey: ['circuit', circuitId],
    queryFn: async () => (await api.get(`/circuits/${circuitId}`)).data,
    enabled: !!circuitId,
  });
  const circuit = useMemo(() => safeMapCircuit(circuitData), [circuitData]);
  const access = circuit?.viewer ?? NO_CIRCUIT_ACCESS;
  const canEdit = hasCircuitPermission(access, 'circuit.edit');
  const brand = circuit ? circuitBrand(circuit) : 'Circuito';

  const { data: players = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['circuit-players', circuitId, debounced, level, onlyPending],
    queryFn: () =>
      fetchCircuitPlayers(circuitId!, { q: debounced, level, status: onlyPending ? 'PENDING' : null }),
    enabled: !!circuitId,
  });

  const counts = useMemo(() => {
    const byLevel = new Map<string, number>();
    for (const p of players) byLevel.set(levelLabel(p.level), (byLevel.get(levelLabel(p.level)) ?? 0) + 1);
    return byLevel;
  }, [players]);

  const resetForm = () => {
    setPicked(null);
    setFullName('');
    setPhone('');
    setDocument('');
    setNewLevel(null);
  };

  const create = useMutation({
    mutationFn: () =>
      createCircuitPlayer(
        circuitId!,
        mode === 'app'
          ? { userId: picked!.userId, level: newLevel ?? undefined }
          : {
            fullName: fullName.trim(),
            phone: phone.trim() || undefined,
            document: document.trim() || undefined,
            level: newLevel ?? undefined,
          },
      ),
    onSuccess: (player) => {
      setAdding(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['circuit-players', circuitId] });
      Alert.alert('Jugador agregado', `${player.full_name} quedó en ${levelLabel(player.level)}.`);
    },
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudo agregar el jugador')),
  });

  const sync = useMutation({
    mutationFn: () => syncCircuitPlayers(circuitId!),
    onSuccess: ({ linked }) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-players', circuitId] });
      Alert.alert(
        'Padrón actualizado',
        linked ? `Se vincularon ${linked} inscripción(es) anteriores.` : 'No había inscripciones sin vincular.',
      );
    },
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudo sincronizar')),
  });

  const canSubmit = mode === 'app' ? !!picked : fullName.trim().length >= 2;

  return (
    <Screen>
      <StackHeader title={`Padrón ${brand}`} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: ui.colors.cardMuted,
            borderRadius: ui.radius.md,
            paddingHorizontal: 12,
            marginBottom: 12,
          }}
        >
          <Ionicons name="search" size={18} color={ui.colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nombre o DNI"
            placeholderTextColor={ui.colors.textMuted}
            autoCorrect={false}
            style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: ui.colors.textPrimary }}
          />
        </View>

        <LevelChips value={level} onChange={setLevel} allLabel="Todas" />

        {canEdit ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <PrimaryButton label="Agregar jugador" size="sm" onPress={() => setAdding(true)} />
            <PrimaryButton
              label="Ascensos y descensos"
              size="sm"
              variant="outline"
              onPress={() => router.push(`/circuit/${circuitId}/promotions` as any)}
            />
            <PrimaryButton
              label={onlyPending ? 'Ver todos' : 'A validar'}
              size="sm"
              variant="ghost"
              onPress={() => setOnlyPending((v) => !v)}
            />
          </View>
        ) : null}

        <SectionHeader
          title={onlyPending ? 'Jugadores a validar' : 'Jugadores'}
          subtitle={
            level == null && counts.size > 1
              ? [...counts.entries()].map(([k, v]) => `${k}: ${v}`).join(' · ')
              : `${players.length}`
          }
        />

        {isLoading ? (
          <Text style={{ color: ui.colors.textMuted }}>Cargando...</Text>
        ) : players.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="people-outline" size={32} color={ui.colors.textMuted} />}
            title={debounced || level ? 'Sin resultados' : 'El padrón está vacío'}
            description={
              canEdit && !debounced && !level
                ? 'Los jugadores se suman solos al inscribirse. También podés cargarlos a mano o traer los de torneos anteriores.'
                : undefined
            }
            action={
              canEdit && !debounced && !level ? (
                <PrimaryButton
                  label="Traer de inscripciones anteriores"
                  variant="outline"
                  loading={sync.isPending}
                  onPress={() => sync.mutate()}
                />
              ) : undefined
            }
          />
        ) : (
          players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              onPress={() => router.push(`/circuit/${circuitId}/player/${player.id}` as any)}
            />
          ))
        )}

        {canEdit && players.length > 0 ? (
          <TouchableOpacity onPress={() => sync.mutate()} style={{ marginTop: 12, alignSelf: 'center' }}>
            <Text style={{ fontSize: 13, color: ui.colors.primary, fontWeight: '600' }}>
              {sync.isPending ? 'Sincronizando...' : 'Traer jugadores de inscripciones anteriores'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Agregar al padrón">
        <View>
          <SegmentedControl<NewPlayerMode>
            options={[
              { value: 'app', label: 'Con cuenta X4Match' },
              { value: 'manual', label: 'Sin cuenta' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <View style={{ height: 12 }} />
          {mode === 'app' ? (
            <>
              <PlayerSearchField value={picked} onChange={setPicked} placeholder="Buscar jugador de X4Match" />
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>
                Si no elegís categoría se usa la que tiene en X4Match según su rating.
              </Text>
            </>
          ) : (
            <>
              <InputField label="Nombre y apellido" value={fullName} onChangeText={setFullName} maxLength={120} />
              <InputField label="DNI (opcional)" value={document} onChangeText={setDocument} keyboardType="number-pad" />
              <InputField label="Teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </>
          )}
          <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textPrimary, marginBottom: 8 }}>
            Categoría en el circuito
          </Text>
          <LevelChips value={newLevel} onChange={setNewLevel} allLabel={mode === 'app' ? 'La de X4Match' : 'A definir'} />
          <PrimaryButton
            label="Agregar"
            fullWidth
            loading={create.isPending}
            disabled={!canSubmit || create.isPending}
            onPress={() => create.mutate()}
          />
        </View>
      </Sheet>
    </Screen>
  );
}
