import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { formatSkillScore, resolveSkillScore } from '@/lib/skill';
import { ui } from '@/theme/tokens';
import { Avatar } from './Avatar';

export type InvitedPlayer = {
  userId?: string;
  guestName?: string;
  name: string;
  nickname?: string;
  photo?: string;
  skillScore?: number;
  levelCategory?: string;
  gender?: string;
  kind?: 'player' | 'guest';
};

type SlotKind = 'partner' | 'opponent';

type PlayerInvitePickerProps = {
  partner: InvitedPlayer | null;
  opponents: InvitedPlayer[];
  onPartnerChange: (player: InvitedPlayer | null) => void;
  onOpponentsChange: (players: InvitedPlayer[]) => void;
  excludeUserIds?: string[];
};

export function PlayerInvitePicker({
  partner,
  opponents,
  onPartnerChange,
  onOpponentsChange,
  excludeUserIds = [],
}: PlayerInvitePickerProps) {
  const [activeSlot, setActiveSlot] = useState<SlotKind | 'opponent-0' | 'opponent-1' | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InvitedPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const blockedIds = useMemo(() => {
    const ids = new Set(excludeUserIds.filter(Boolean));
    if (partner?.userId) ids.add(partner.userId);
    opponents.forEach((o) => {
      if (o.userId) ids.add(o.userId);
    });
    return ids;
  }, [excludeUserIds, partner, opponents]);

  const trimmedQuery = query.trim();

  const mapSearchRow = useCallback(
    (row: Record<string, unknown>): InvitedPlayer | null => {
      const rawUserId = row.userId ?? row.user_id ?? row.id;
      if (!rawUserId) return null;
      const userId = String(rawUserId);
      if (blockedIds.has(userId)) return null;
      const nickname = row.nickname ? String(row.nickname) : undefined;
      return {
        userId,
        name: String(row.name || nickname || 'Jugador'),
        nickname,
        photo: row.photo ? String(row.photo) : row.photo_url ? String(row.photo_url) : undefined,
        skillScore: resolveSkillScore(
          row.skillScore != null ? Number(row.skillScore) : undefined,
          row.rating != null ? Number(row.rating) : undefined,
        ),
        levelCategory: row.levelCategory ? String(row.levelCategory) : undefined,
        gender: row.gender ? String(row.gender) : undefined,
        kind: 'player',
      };
    },
    [blockedIds],
  );

  const searchPlayers = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await api.get('/players/search', { params: { q: q.trim() } });
        const rows = Array.isArray(res.data) ? res.data : res.data?.items || [];
        const mapped = rows
          .map((row: Record<string, unknown>) => mapSearchRow(row))
          .filter((player: InvitedPlayer | null): player is InvitedPlayer => player != null);
        setResults(mapped);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [mapSearchRow],
  );

  useEffect(() => {
    if (!activeSlot) return;
    const timer = setTimeout(() => searchPlayers(query), 300);
    return () => clearTimeout(timer);
  }, [query, activeSlot, searchPlayers]);

  useEffect(() => {
    if (!activeSlot) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [activeSlot]);

  const openSlot = (slot: typeof activeSlot) => {
    Keyboard.dismiss();
    setActiveSlot(slot);
    setQuery('');
    setResults([]);
  };

  const closeModal = () => {
    setActiveSlot(null);
    setQuery('');
    setResults([]);
  };

  const handleSelect = (player: InvitedPlayer) => {
    if (activeSlot === 'partner') {
      onPartnerChange(player);
    } else if (activeSlot === 'opponent-0') {
      const next = [...opponents];
      next[0] = player;
      onOpponentsChange(next.filter(Boolean).slice(0, 2));
    } else if (activeSlot === 'opponent-1') {
      const next = [...opponents];
      next[1] = player;
      onOpponentsChange(next.filter(Boolean).slice(0, 2));
    }
    closeModal();
  };

  const handleSelectGuest = () => {
    const name = trimmedQuery;
    if (name.length < 2) return;
    handleSelect({
      name,
      guestName: name,
      kind: 'guest',
    });
  };

  const slotTitle =
    activeSlot === 'partner'
      ? 'Elegir compañero'
      : activeSlot === 'opponent-0'
        ? 'Elegir rival 1'
        : activeSlot === 'opponent-1'
          ? 'Elegir rival 2'
          : '';

  const externalGuestLabel =
    activeSlot === 'partner'
      ? `Invitar a ${trimmedQuery} como compañero externo`
      : `Invitar a ${trimmedQuery} como rival externo`;

  const renderExternalGuestOption = (compact = false) => {
    if (trimmedQuery.length < 2) return null;
    return (
      <Pressable
        onPress={handleSelectGuest}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: ui.spacing.lg,
          marginTop: compact ? 4 : 8,
          marginBottom: compact ? 12 : 6,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: ui.radius.md,
          borderWidth: 1,
          borderColor: ui.colors.border,
          borderStyle: 'dashed',
          backgroundColor: pressed ? ui.colors.cardMuted : ui.colors.card,
        })}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: ui.colors.cardMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="person-outline" size={18} color={ui.colors.textMuted} />
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textSecondary }}>
            {externalGuestLabel}
          </Text>
          <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
            Sin cuenta en la app · cubre su parte de la cancha
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderSlot = (
    label: string,
    hint: string,
    player: InvitedPlayer | null | undefined,
    onPress: () => void,
    onClear: () => void,
  ) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: ui.radius.md,
        backgroundColor: ui.colors.card,
        borderWidth: 1,
        borderColor: ui.colors.border,
        marginBottom: 8,
      }}
    >
      <TouchableOpacity onPress={onPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        {player ? (
          <Avatar name={player.name} photo={player.photo} size="sm" />
        ) : (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: ui.colors.cardMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="person-add-outline" size={18} color={ui.colors.primary} />
          </View>
        )}
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>{label}</Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: player ? ui.colors.textPrimary : ui.colors.textMuted }}>
            {player ? player.name : hint}
          </Text>
          {player?.kind === 'guest' ? (
            <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>Invitado externo</Text>
          ) : null}
          {player?.skillScore != null ? (
            <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>
              {formatSkillScore(player.skillScore)}
              {player.levelCategory ? ` • ${player.levelCategory}` : ''}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
      {player ? (
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={22} color={ui.colors.textMuted} />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
      )}
    </View>
  );

  return (
    <View style={{ marginBottom: ui.spacing.lg }}>
      <Text style={{ fontSize: 17, fontWeight: '700', color: ui.colors.textInverse, marginBottom: 4 }}>
        Jugadores invitados
      </Text>
      <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 12 }}>
        Opcional: agregá tu compañero y hasta 2 rivales. El resto se completa automáticamente o queda el cupo abierto.
      </Text>

      {renderSlot('Compañero', 'Buscar compañero…', partner, () => openSlot('partner'), () => onPartnerChange(null))}
      {renderSlot(
        'Rival 1',
        'Buscar rival…',
        opponents[0],
        () => openSlot('opponent-0'),
        () => onOpponentsChange(opponents.filter((_, i) => i !== 0)),
      )}
      {renderSlot(
        'Rival 2',
        'Buscar rival…',
        opponents[1],
        () => openSlot('opponent-1'),
        () => onOpponentsChange(opponents.filter((_, i) => i !== 1)),
      )}

      <Modal visible={activeSlot != null} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={{
              backgroundColor: ui.colors.card,
              borderTopLeftRadius: ui.radius.xl,
              borderTopRightRadius: ui.radius.xl,
              maxHeight: '80%',
              paddingBottom: 24,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: ui.spacing.lg,
                borderBottomWidth: 1,
                borderBottomColor: ui.colors.border,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: ui.colors.textPrimary }}>{slotTitle}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={ui.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: ui.spacing.lg, paddingTop: 12 }}>
              <TextInput
                ref={searchInputRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Nombre o usuario (mín. 2 letras)"
                placeholderTextColor={ui.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  backgroundColor: ui.colors.cardMuted,
                  borderRadius: ui.radius.md,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: ui.colors.textPrimary,
                  marginBottom: 8,
                }}
              />
            </View>

            {loading ? (
              <ActivityIndicator style={{ marginVertical: 24 }} color={ui.colors.primary} />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.userId || item.guestName || item.name}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 360 }}
                ListEmptyComponent={
                  trimmedQuery.length < 2 ? (
                    <Text style={{ textAlign: 'center', color: ui.colors.textMuted, padding: 24 }}>
                      Escribí al menos 2 letras para buscar jugadores registrados
                    </Text>
                  ) : (
                    <View>
                      <Text style={{ textAlign: 'center', color: ui.colors.textMuted, paddingHorizontal: 24, paddingTop: 16 }}>
                        No encontramos jugadores con ese nombre.
                      </Text>
                      {renderExternalGuestOption()}
                    </View>
                  )
                }
                ListFooterComponent={results.length > 0 ? () => renderExternalGuestOption(true) : null}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleSelect(item)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: ui.spacing.lg,
                      paddingVertical: 12,
                      backgroundColor: pressed ? ui.colors.cardMuted : 'transparent',
                    })}
                  >
                    <Avatar name={item.name} photo={item.photo} size="sm" />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: ui.colors.textPrimary }}>
                        {item.name}
                      </Text>
                      {item.nickname ? (
                        <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>@{item.nickname}</Text>
                      ) : null}
                      {item.skillScore != null ? (
                        <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                          {formatSkillScore(item.skillScore)}
                          {item.levelCategory ? ` • ${item.levelCategory}` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                  </Pressable>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

export function buildMatchInvitesPayload(partner: InvitedPlayer | null, opponents: InvitedPlayer[]) {
  const invites: { userId?: string; guestName?: string; role: 'partner' | 'opponent' }[] = [];
  if (partner) {
    invites.push(
      partner.userId
        ? { userId: partner.userId, role: 'partner' }
        : { guestName: partner.guestName || partner.name, role: 'partner' },
    );
  }
  opponents.forEach((o) =>
    invites.push(
      o.userId
        ? { userId: o.userId, role: 'opponent' as const }
        : { guestName: o.guestName || o.name, role: 'opponent' as const },
    ),
  );
  return invites;
}
