import { View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';
import { Avatar, PrimaryButton } from '@/components/padely';

type ClubHeroHeaderProps = {
  name: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  zone?: string | null;
  city?: string | null;
  playersCount?: number;
  matchesCount?: number;
  statsPeriodLabel?: string;
  pointsBalance?: number;
  showPoints?: boolean;
  onRedeemPress?: () => void;
};

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 72, flex: 1 }}>
      <Text style={[ui.typography.stat, { color: ui.colors.textPrimary, fontSize: 22, lineHeight: 26 }]}>
        {value}
      </Text>
      <Text
        style={[
          ui.typography.caption,
          { color: ui.colors.textMuted, marginTop: 4, textAlign: 'center', letterSpacing: 0 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function ClubHeroHeader({
  name,
  logoUrl,
  coverUrl,
  zone,
  city,
  playersCount = 0,
  matchesCount = 0,
  statsPeriodLabel = 'últimos 30 días',
  pointsBalance = 0,
  showPoints = false,
  onRedeemPress,
}: ClubHeroHeaderProps) {
  const locationLabel = [zone, city].filter(Boolean).join(' · ');

  return (
    <View style={{ marginBottom: 16 }}>
      <View
        style={{
          borderRadius: ui.radius.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: ui.colors.border,
          backgroundColor: ui.colors.surface1,
        }}
      >
        <View style={{ height: 168, position: 'relative' }}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[ui.colors.surface2, ui.colors.surface0]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="image-outline" size={28} color={ui.colors.textMuted} />
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.88)']}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              top: '30%',
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 14,
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 12,
            }}
          >
            <View
              style={{
                borderWidth: 3,
                borderColor: ui.colors.bg,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <Avatar name={name} photo={logoUrl || undefined} size="xl" style={{ marginBottom: 0 }} />
            </View>
            <View style={{ flex: 1, paddingBottom: 2 }}>
              <Text
                style={[ui.typography.h2, { color: '#fff' }]}
                numberOfLines={2}
              >
                {name}
              </Text>
              {locationLabel ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons name="location-outline" size={13} color={ui.colors.textSecondary} />
                  <Text style={[ui.typography.bodySm, { color: ui.colors.textSecondary }]} numberOfLines={1}>
                    {locationLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: 12,
            backgroundColor: ui.colors.surface1,
            borderTopWidth: 1,
            borderTopColor: ui.colors.border,
          }}
        >
          <StatItem label="Jugadores activos" value={playersCount} />
          <View style={{ width: 1, height: 28, backgroundColor: ui.colors.border }} />
          <StatItem label={`Partidos (${statsPeriodLabel})`} value={matchesCount} />
        </View>
      </View>

      {showPoints ? (
        <View
          style={{
            marginTop: 10,
            borderRadius: ui.radius.md,
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: ui.colors.surface1,
            borderWidth: 1,
            borderColor: ui.colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 4,
              alignSelf: 'stretch',
              borderRadius: 2,
              backgroundColor: ui.colors.primary,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={[ui.typography.label, { color: ui.colors.textSecondary, letterSpacing: 0.2 }]}>
              Puntos globales canjeables
            </Text>
            <Text style={[ui.typography.stat, { color: ui.colors.primary, fontSize: 26, lineHeight: 30, marginTop: 2 }]}>
              {pointsBalance}
            </Text>
            <Text style={[ui.typography.caption, { color: ui.colors.textMuted, marginTop: 4, letterSpacing: 0 }]}>
              Saldo para canjear en toda la app
            </Text>
          </View>
          <PrimaryButton label="Canjear" size="sm" onPress={onRedeemPress} />
        </View>
      ) : null}
    </View>
  );
}
