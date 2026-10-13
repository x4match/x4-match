import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import {
  addTournamentPlayer,
  autoPairTournamentPlayers,
  createTournamentPair,
  fetchTournamentPlayers,
  removeTournamentPair,
  removeTournamentPlayer,
  updateTournamentPlayerSide,
} from '@/lib/tournament/api';
import type { TournamentPlayer, TournamentPlayerSide } from '@/lib/tournament/types';
import { hapticSelection } from '@/lib/haptics';
import { ui } from '@/theme/tokens';
import { AppCard, Avatar, InputField, PrimaryButton, SectionHeader } from '@/components/x4match';

type SearchResult = { userId: string; name: string; photo?: string };

const SIDE_LABEL: Record<TournamentPlayerSide, string> = { DRIVE: 'Drive', REVES: 'Revés' };

function errorMessage(e: any, fallback: string) {
  const raw = e?.response?.data?.message;
  return Array.isArray(raw) ? raw.join('\n') : typeof raw === 'string' ? raw : fallback;
}

function PlayerColumn({
  side,
  players,
  selectedId,
  onSelect,
}: {
  side: TournamentPlayerSide;
  players: TournamentPlayer[];
  selectedId: string | null;
  onSelect: (player: TournamentPlayer) => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: ui.radius.md,
        borderWidth: 1,
        borderColor: ui.colors.border,
        backgroundColor: ui.colors.surface1,
        padding: 10,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '800', color: ui.colors.textPrimary }}>{SIDE_LABEL[side]}</Text>
        <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>{players.length}</Text>
      </View>
      {players.length === 0 ? (
        <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>Sin jugadores libres</Text>
      ) : (
        players.map((player) => {
          const selected = player.id === selectedId;
          return (
            <Pressable
              key={player.id}
              onPress={() => onSelect(player)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 8,
                paddingHorizontal: 8,
                borderRadius: ui.radius.sm,
                borderWidth: 1,
                borderColor: selected ? ui.colors.primary : 'transparent',
                backgroundColor: selected ? ui.colors.primarySoft : ui.colors.surface,
              }}
            >
              <Avatar name={player.name} photo={player.photo_url} size="sm" />
              <Text
                numberOfLines={1}
                style={{ flex: 1, color: ui.colors.textPrimary, fontWeight: '600', fontSize: 13 }}
              >
                {player.name}
              </Text>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

export function InternalPairingBoard({
  tournamentId,
  onChanged,
}: {
  tournamentId: string;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [pickedUser, setPickedUser] = useState<SearchResult | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);
  const [selectedRevesId, setSelectedRevesId] = useState<string | null>(null);
  const searchSeq = useRef(0);

  const queryKey = ['tournament-players', tournamentId];
  const { data: players = [] } = useQuery({
    queryKey,
    queryFn: () => fetchTournamentPlayers(tournamentId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    onChanged();
  };

  const freeDrives = players.filter((p) => p.side === 'DRIVE' && !p.registration_id);
  const freeReveses = players.filter((p) => p.side === 'REVES' && !p.registration_id);

  const pairs = useMemo(() => {
    const byReg = new Map<string, { drive?: TournamentPlayer; reves?: TournamentPlayer }>();
    for (const p of players) {
      if (!p.registration_id) continue;
      const pair = byReg.get(p.registration_id) ?? {};
      if (p.side === 'DRIVE') pair.drive = p;
      else pair.reves = p;
      byReg.set(p.registration_id, pair);
    }
    return [...byReg.entries()].map(([registrationId, pair]) => ({ registrationId, ...pair }));
  }, [players]);

  const selectedPlayer =
    players.find((p) => p.id === selectedDriveId) ?? players.find((p) => p.id === selectedRevesId);
  const singleSelection =
    (selectedDriveId ? 1 : 0) + (selectedRevesId ? 1 : 0) === 1 ? selectedPlayer : undefined;

  const clearSelection = () => {
    setSelectedDriveId(null);
    setSelectedRevesId(null);
  };

  const addMutation = useMutation({
    mutationFn: (side: TournamentPlayerSide) =>
      addTournamentPlayer(tournamentId, {
        name: pickedUser?.name ?? name.trim(),
        side,
        userId: pickedUser?.userId,
      }),
    onSuccess: () => {
      setName('');
      setPickedUser(null);
      setResults([]);
      refresh();
    },
    onError: (e) => Alert.alert('Error', errorMessage(e, 'No se pudo agregar el jugador')),
  });

  const pairMutation = useMutation({
    mutationFn: ({ driveId, revesId }: { driveId: string; revesId: string }) =>
      createTournamentPair(tournamentId, driveId, revesId),
    onSuccess: () => {
      clearSelection();
      refresh();
    },
    onError: (e) => {
      clearSelection();
      Alert.alert('Error', errorMessage(e, 'No se pudo formar la pareja'));
    },
  });

  const autoPairMutation = useMutation({
    mutationFn: () => autoPairTournamentPlayers(tournamentId),
    onSuccess: () => {
      clearSelection();
      refresh();
    },
    onError: (e) => Alert.alert('Error', errorMessage(e, 'No se pudieron sortear las parejas')),
  });

  const splitMutation = useMutation({
    mutationFn: (regId: string) => removeTournamentPair(tournamentId, regId),
    onSuccess: refresh,
    onError: (e) => Alert.alert('Error', errorMessage(e, 'No se pudo separar la pareja')),
  });

  const switchSideMutation = useMutation({
    mutationFn: (player: TournamentPlayer) =>
      updateTournamentPlayerSide(tournamentId, player.id, player.side === 'DRIVE' ? 'REVES' : 'DRIVE'),
    onSuccess: () => {
      clearSelection();
      refresh();
    },
    onError: (e) => Alert.alert('Error', errorMessage(e, 'No se pudo cambiar de lado')),
  });

  const removeMutation = useMutation({
    mutationFn: (playerId: string) => removeTournamentPlayer(tournamentId, playerId),
    onSuccess: () => {
      clearSelection();
      refresh();
    },
    onError: (e) => Alert.alert('Error', errorMessage(e, 'No se pudo quitar el jugador')),
  });

  const onChangeName = async (text: string) => {
    setName(text);
    setPickedUser(null);
    const q = text.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    try {
      const res = await api.get('/players/search', { params: { q } });
      if (seq !== searchSeq.current) return;
      const taken = new Set(players.map((p) => p.user_id).filter(Boolean));
      setResults(
        (res.data || [])
          .map((row: any) => ({
            userId: String(row.userId),
            name: String(row.name || row.nickname || 'Jugador'),
            photo: row.photo ? String(row.photo) : undefined,
          }))
          .filter((p: SearchResult) => !taken.has(p.userId))
          .slice(0, 5),
      );
    } catch {
      if (seq === searchSeq.current) setResults([]);
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  };

  const onSelectPlayer = (player: TournamentPlayer) => {
    void hapticSelection();
    const isDrive = player.side === 'DRIVE';
    const current = isDrive ? selectedDriveId : selectedRevesId;
    const nextId = current === player.id ? null : player.id;
    const driveId = isDrive ? nextId : selectedDriveId;
    const revesId = isDrive ? selectedRevesId : nextId;
    setSelectedDriveId(driveId);
    setSelectedRevesId(revesId);
    if (driveId && revesId) pairMutation.mutate({ driveId, revesId });
  };

  const canAdd = !!pickedUser || name.trim().length > 0;

  return (
    <>
      <SectionHeader title="Jugadores" subtitle="Cargalos en su lado de juego" dark />
      <AppCard>
        <InputField
          label="Jugador"
          value={pickedUser?.name ?? name}
          onChangeText={onChangeName}
          placeholder="Buscá en la app o escribí el nombre"
          autoCorrect={false}
        />
        {searching ? (
          <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 8 }}>Buscando…</Text>
        ) : null}
        {!pickedUser &&
          results.map((player) => (
            <Pressable
              key={player.userId}
              onPress={() => {
                setPickedUser(player);
                setResults([]);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: ui.colors.border,
              }}
            >
              <Avatar name={player.name} photo={player.photo} size="sm" />
              <Text style={{ flex: 1, color: ui.colors.textPrimary, fontWeight: '600' }}>{player.name}</Text>
              <Ionicons name="add-circle-outline" size={18} color={ui.colors.primary} />
            </Pressable>
          ))}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {(['DRIVE', 'REVES'] as const).map((side) => (
            <View key={side} style={{ flex: 1 }}>
              <PrimaryButton
                label={`Agregar a ${SIDE_LABEL[side]}`}
                size="sm"
                fullWidth
                variant={side === 'DRIVE' ? 'primary' : 'outline'}
                disabled={!canAdd}
                loading={addMutation.isPending && addMutation.variables === side}
                onPress={() => addMutation.mutate(side)}
              />
            </View>
          ))}
        </View>
      </AppCard>

      <SectionHeader
        title="Armar parejas"
        subtitle="Tocá un drive y un revés para juntarlos"
        dark
      />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <PlayerColumn
          side="DRIVE"
          players={freeDrives}
          selectedId={selectedDriveId}
          onSelect={onSelectPlayer}
        />
        <PlayerColumn
          side="REVES"
          players={freeReveses}
          selectedId={selectedRevesId}
          onSelect={onSelectPlayer}
        />
      </View>

      {singleSelection ? (
        <AppCard padding="sm">
          <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
            {singleSelection.name} · elegí su compañero en la otra columna.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={`Pasar a ${SIDE_LABEL[singleSelection.side === 'DRIVE' ? 'REVES' : 'DRIVE']}`}
                size="sm"
                variant="outline"
                fullWidth
                loading={switchSideMutation.isPending}
                onPress={() => switchSideMutation.mutate(singleSelection)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Quitar"
                size="sm"
                variant="ghost"
                fullWidth
                loading={removeMutation.isPending}
                onPress={() => removeMutation.mutate(singleSelection.id)}
                style={{ backgroundColor: ui.colors.dangerSoft }}
              />
            </View>
          </View>
        </AppCard>
      ) : null}

      <PrimaryButton
        label="Sortear parejas"
        variant="outline"
        fullWidth
        disabled={freeDrives.length === 0 || freeReveses.length === 0}
        loading={autoPairMutation.isPending}
        icon={<Ionicons name="shuffle" size={18} color={ui.colors.primary} />}
        onPress={() => autoPairMutation.mutate()}
        style={{ marginBottom: 16 }}
      />

      <SectionHeader title="Parejas" subtitle={`${pairs.length} formadas`} dark />
      {pairs.length === 0 ? (
        <AppCard>
          <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>
            Todavía no hay parejas. Juntalas a mano o sorteá las que falten.
          </Text>
        </AppCard>
      ) : (
        pairs.map((pair, index) => (
          <AppCard key={pair.registrationId} padding="sm">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ width: 22, fontWeight: '800', color: ui.colors.primary }}>{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                  {pair.drive?.name ?? '—'}
                  <Text style={{ fontWeight: '400', color: ui.colors.textMuted }}> · Drive</Text>
                </Text>
                <Text numberOfLines={1} style={{ fontWeight: '700', color: ui.colors.textPrimary, marginTop: 2 }}>
                  {pair.reves?.name ?? '—'}
                  <Text style={{ fontWeight: '400', color: ui.colors.textMuted }}> · Revés</Text>
                </Text>
              </View>
              <PrimaryButton
                label="Separar"
                size="sm"
                variant="ghost"
                loading={splitMutation.isPending && splitMutation.variables === pair.registrationId}
                onPress={() => splitMutation.mutate(pair.registrationId)}
              />
            </View>
          </AppCard>
        ))
      )}
    </>
  );
}
