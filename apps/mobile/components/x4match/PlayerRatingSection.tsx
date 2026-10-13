import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';
import { Avatar } from './Avatar';

type Player = { id: string; name: string; photo?: string };

type PlayerRatingSectionProps = {
  players: Player[];
  currentUserId?: string;
  ratings: Record<string, number>;
  onChange: (userId: string, score: number | undefined) => void;
  title?: string;
  subtitle?: string;
};

export function PlayerRatingSection({
  players,
  currentUserId,
  ratings,
  onChange,
  title = 'Valorar jugadores (opcional)',
  subtitle = 'Del 1 al 5 · podés omitir',
}: PlayerRatingSectionProps) {
  const others = players.filter((p) => p.id !== currentUserId);
  if (others.length === 0) return null;

  return (
    <View style={{ marginTop: ui.spacing.md }}>
      <Text style={{ fontWeight: '700', fontSize: 15, color: ui.colors.textPrimary, marginBottom: 4 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 12 }}>
        {subtitle}
      </Text>
      {others.map((player) => (
        <View
          key={player.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
            gap: 10,
          }}
        >
          <Avatar name={player.name} photo={player.photo} size="sm" />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: ui.colors.textPrimary }}>
            {player.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((star) => {
              const active = (ratings[player.id] ?? 0) >= star;
              return (
                <TouchableOpacity
                  key={star}
                  onPress={() =>
                    onChange(player.id, ratings[player.id] === star ? undefined : star)
                  }
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                >
                  <Ionicons
                    name={active ? 'star' : 'star-outline'}
                    size={22}
                    color={active ? ui.colors.accent : ui.colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

export function buildPlayerRatingsPayload(ratings: Record<string, number>) {
  return Object.entries(ratings)
    .filter(([, score]) => score >= 1 && score <= 5)
    .map(([userId, score]) => ({ userId, score }));
}
