import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import { AppCard, Avatar } from '@/components/x4match';

export type PickedPlayer = {
  userId: string;
  name: string;
  nickname?: string | null;
  photo?: string | null;
  city?: string | null;
};

type Props = {
  value: PickedPlayer | null;
  onChange: (player: PickedPlayer | null) => void;
  excludeUserIds?: (string | null | undefined)[];
  placeholder?: string;
  locked?: boolean;
};

function mapRow(row: Record<string, any>): PickedPlayer | null {
  const userId = row.userId ?? row.user_id;
  if (!userId) return null;
  return {
    userId: String(userId),
    name: String(row.name ?? 'Jugador'),
    nickname: row.nickname ?? null,
    photo: row.photo ?? row.photo_url ?? null,
    city: row.city ?? null,
  };
}

export function PlayerSearchField({
  value,
  onChange,
  excludeUserIds = [],
  placeholder = 'Buscar por nombre o usuario',
  locked = false,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickedPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  const excludedKey = excludeUserIds.filter(Boolean).join(',');
  const excluded = useMemo(
    () => new Set(excludedKey ? excludedKey.split(',') : []),
    [excludedKey],
  );

  useEffect(() => {
    const q = query.trim();
    if (value || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/players/search', { params: { q } });
        const rows = Array.isArray(res.data) ? res.data : res.data?.items || [];
        if (cancelled) return;
        setResults(
          rows
            .map((row: Record<string, any>) => mapRow(row))
            .filter((p: PickedPlayer | null): p is PickedPlayer => !!p && !excluded.has(p.userId))
            .slice(0, 8),
        );
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, value, excluded]);

  if (value) {
    return (
      <AppCard style={{ marginBottom: 12, borderWidth: 1, borderColor: ui.colors.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={value.name} photo={value.photo} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
              {value.name}
            </Text>
            {value.city ? (
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>{value.city}</Text>
            ) : null}
          </View>
          {locked ? (
            <Ionicons name="checkmark-circle" size={22} color={ui.colors.primary} />
          ) : (
            <Pressable
              hitSlop={10}
              onPress={() => {
                onChange(null);
                setQuery('');
              }}
              accessibilityLabel="Quitar jugador"
            >
              <Ionicons name="close-circle" size={22} color={ui.colors.textMuted} />
            </Pressable>
          )}
        </View>
      </AppCard>
    );
  }

  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: ui.colors.cardMuted,
          borderRadius: ui.radius.md,
          paddingHorizontal: 12,
        }}
      >
        <Ionicons name="search" size={18} color={ui.colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={ui.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: ui.colors.textPrimary }}
        />
        {loading ? <ActivityIndicator size="small" color={ui.colors.primary} /> : null}
      </View>

      {results.map((player) => (
        <Pressable key={player.userId} onPress={() => onChange(player)} style={{ marginTop: 8 }}>
          <AppCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={player.name} photo={player.photo} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                  {player.name}
                </Text>
                {player.city ? (
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>{player.city}</Text>
                ) : null}
              </View>
              <Ionicons name="add-circle-outline" size={22} color={ui.colors.primary} />
            </View>
          </AppCard>
        </Pressable>
      ))}

      {!loading && query.trim().length >= 2 && results.length === 0 ? (
        <Text style={{ marginTop: 8, fontSize: 13, color: ui.colors.textMuted }}>
          No encontramos jugadores con ese nombre.
        </Text>
      ) : null}
    </View>
  );
}
