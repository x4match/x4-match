import { useState } from 'react';
import { View, Text, Image, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { hapticSelection } from '@/lib/haptics';
import { ui, fontFamily } from '@/theme/tokens';
import { Skeleton } from '@/components/ui';

const LIME = '#D7FF00';
const MUTED = '#8E8E9F';
const CARD_BG = '#161616';
const TROPHY = require('../../assets/figma/shared/trofeo.png');
const COLLAPSED_COUNT = 3;

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export type TournamentTitle = {
  tournamentId: string;
  name: string;
  category: string | null;
  gender: string | null;
  format: 'ELIMINATION' | 'LEAGUE';
  clubId: string | null;
  clubName: string | null;
  clubCity: string | null;
  circuitName: string | null;
  flyerUrl: string | null;
  partnerName: string | null;
  partnerUserId: string | null;
  wonAt: string | null;
};

type TournamentTitlesResponse = { total: number; titles: TournamentTitle[] };

function formatWonAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatGender(value: string | null) {
  const key = value?.trim().toLowerCase();
  if (!key) return null;
  if (['male', 'masculino', 'caballeros', 'caballero', 'hombres'].includes(key)) return 'Caballeros';
  if (['female', 'femenino', 'damas', 'dama', 'mujeres'].includes(key)) return 'Damas';
  if (['mixed', 'mixto', 'mixta'].includes(key)) return 'Mixto';
  return value!.charAt(0).toUpperCase() + value!.slice(1);
}

function TitleRow({ title, onPress }: { title: TournamentTitle; onPress: () => void }) {
  const meta = [title.category, formatGender(title.gender), title.clubName ?? title.circuitName]
    .filter(Boolean)
    .join(' · ');
  const footer = [
    title.partnerName ? `con ${title.partnerName}` : null,
    formatWonAt(title.wonAt),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Campeón de ${title.name}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: 16,
        backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: 'rgba(215,255,0,0.1)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {title.flyerUrl ? (
          <Image source={{ uri: title.flyerUrl }} style={{ width: 48, height: 48 }} resizeMode="cover" />
        ) : (
          <Image source={TROPHY} style={{ width: 24, height: 24 }} resizeMode="contain" />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 14,
              fontWeight: '700',
              color: ui.colors.textPrimary,
              fontFamily: fontFamily.regular,
            }}
          >
            {title.name}
          </Text>
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: LIME,
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: '800', color: '#000', letterSpacing: 0.4 }}>
              {title.format === 'LEAGUE' ? '1° LIGA' : 'CAMPEÓN'}
            </Text>
          </View>
        </View>
        {meta ? (
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, color: MUTED, marginTop: 3, fontFamily: fontFamily.regular }}
          >
            {meta}
          </Text>
        ) : null}
        {footer ? (
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.55)',
              marginTop: 2,
              fontFamily: fontFamily.regular,
            }}
          >
            {footer}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={16} color={MUTED} />
    </Pressable>
  );
}

export function TournamentTitlesCard({
  playerId,
  isSelf = false,
  style,
}: {
  playerId?: string | null;
  isSelf?: boolean;
  style?: ViewStyle;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['player-tournament-titles', playerId],
    queryFn: async () => {
      const res = await api.get(`/players/${playerId}/tournament-titles`);
      return res.data as TournamentTitlesResponse;
    },
    enabled: !!playerId,
  });

  const titles = data?.titles ?? [];
  const total = data?.total ?? titles.length;
  const visible = expanded ? titles : titles.slice(0, COLLAPSED_COUNT);
  const hasMore = titles.length > COLLAPSED_COUNT;

  return (
    <View
      style={[
        {
          borderRadius: ui.radius.lg,
          backgroundColor: CARD_BG,
          borderWidth: 1,
          borderColor: total > 0 ? 'rgba(215,255,0,0.28)' : 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {total > 0 ? (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(215,255,0,0.16)', 'rgba(215,255,0,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.6 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140 }}
        />
      ) : null}

      <View style={{ padding: ui.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(215,255,0,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(215,255,0,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image source={TROPHY} style={{ width: 24, height: 24 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 11,
                letterSpacing: 1.2,
                fontWeight: '700',
                color: MUTED,
                fontFamily: fontFamily.regular,
              }}
            >
              GALARDONES
            </Text>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: ui.colors.textPrimary,
                fontFamily: fontFamily.regular,
                marginTop: 2,
              }}
            >
              Torneos ganados
            </Text>
          </View>
          {total > 0 ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={{
                  fontSize: 28,
                  lineHeight: 30,
                  fontWeight: '800',
                  color: LIME,
                  fontFamily: fontFamily.regular,
                }}
              >
                {total}
              </Text>
              <Text style={{ fontSize: 11, color: MUTED, fontFamily: fontFamily.regular }}>
                {total === 1 ? 'título' : 'títulos'}
              </Text>
            </View>
          ) : null}
        </View>

        {isLoading ? (
          <View style={{ marginTop: 16, gap: 10 }}>
            <Skeleton height={68} radius={16} />
            <Skeleton height={68} radius={16} />
          </View>
        ) : isError ? (
          <Text style={{ fontSize: 13, color: MUTED, marginTop: 14, fontFamily: fontFamily.regular }}>
            No pudimos cargar los torneos ganados.
          </Text>
        ) : total === 0 ? (
          <Text
            style={{
              fontSize: 13,
              color: MUTED,
              marginTop: 14,
              lineHeight: 19,
              fontFamily: fontFamily.regular,
            }}
          >
            {isSelf
              ? 'Todavía no ganaste ningún torneo. Anotate en uno y empezá a sumar títulos.'
              : 'Todavía no ganó ningún torneo.'}
          </Text>
        ) : (
          <View style={{ marginTop: 16, gap: 8 }}>
            {visible.map((title) => (
              <TitleRow
                key={title.tournamentId}
                title={title}
                onPress={() => router.push(`/tournament/${title.tournamentId}` as any)}
              />
            ))}
            {hasMore ? (
              <Pressable
                onPress={() => {
                  hapticSelection();
                  setExpanded((v) => !v);
                }}
                accessibilityRole="button"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  paddingVertical: 8,
                  marginTop: 2,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: LIME, fontFamily: fontFamily.regular }}>
                  {expanded ? 'Ver menos' : `Ver los ${total} títulos`}
                </Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={LIME} />
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}
