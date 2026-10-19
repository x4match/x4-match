import { Image, Pressable, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useCircuitsEnabled } from '@/lib/features';
import type { CircuitUserRole } from '@/lib/circuits/staff';
import { fontFamily } from '@/theme/tokens';

const LIME = '#D7FF00';

type Props = {
  userId?: string | null;
  style?: ViewStyle;
};

/** Carteles de cargos en circuitos: rol + sigla del circuito ("Presidente CAS", "Fiscal CAS"...). */
export function CircuitRoleBadges({ userId, style }: Props) {
  const router = useRouter();
  const circuitsEnabled = useCircuitsEnabled();
  const { data: roles = [] } = useQuery({
    queryKey: ['circuit-roles-user', userId],
    queryFn: async () => {
      const res = await api.get(`/circuits/roles/user/${userId}`);
      return (Array.isArray(res.data) ? res.data : []) as CircuitUserRole[];
    },
    enabled: circuitsEnabled && !!userId,
    staleTime: 60_000,
  });

  if (!roles.length) return null;

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }, style]}>
      {roles.map((role) => {
        const isPresident = role.role === 'PRESIDENT';
        return (
          <Pressable
            key={role.memberId}
            onPress={() => router.push(`/circuit/${role.circuitId}` as any)}
            accessibilityRole="button"
            accessibilityLabel={`${role.displayTitle}, ver circuito ${role.circuitName}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingLeft: role.circuitLogoUrl ? 3 : 8,
              paddingRight: 10,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: isPresident ? LIME : 'rgba(215,255,0,0.12)',
              borderWidth: 1,
              borderColor: isPresident ? LIME : 'rgba(215,255,0,0.35)',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            {role.circuitLogoUrl ? (
              <Image
                source={{ uri: role.circuitLogoUrl }}
                style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#000' }}
              />
            ) : (
              <Ionicons
                name={isPresident ? 'ribbon' : 'shield-checkmark-outline'}
                size={13}
                color={isPresident ? '#000' : LIME}
              />
            )}
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12,
                fontWeight: '700',
                fontFamily: fontFamily.regular,
                color: isPresident ? '#000' : LIME,
                maxWidth: 220,
              }}
            >
              {role.displayTitle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
