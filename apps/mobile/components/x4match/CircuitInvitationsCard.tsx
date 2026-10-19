import { Alert, Image, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useCircuitsEnabled } from '@/lib/features';
import {
  CIRCUIT_ROLE_DESCRIPTIONS,
  apiErrorMessage,
  type CircuitStaffInvitation,
} from '@/lib/circuits/staff';
import { fontFamily, ui } from '@/theme/tokens';
import { AppCard, PrimaryButton } from '@/components/ui';

const LIME = '#D7FF00';
const MUTED = '#8E8E9F';
const CARD_BG = '#161616';

/** Invitaciones pendientes a staffs de circuitos del usuario logueado. */
export function CircuitInvitationsCard({ style }: { style?: ViewStyle }) {
  const router = useRouter();
  const circuitsEnabled = useCircuitsEnabled();
  const queryClient = useQueryClient();
  const { data: invitations = [] } = useQuery({
    queryKey: ['circuit-staff-invitations-me'],
    queryFn: async () => {
      const res = await api.get('/circuits/staff/invitations/me');
      return (Array.isArray(res.data) ? res.data : []) as CircuitStaffInvitation[];
    },
    enabled: circuitsEnabled,
  });

  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) =>
      api.post(`/circuits/staff/invitations/${id}/${accept ? 'accept' : 'decline'}`),
    onSuccess: (_res, { accept }) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-staff-invitations-me'] });
      queryClient.invalidateQueries({ queryKey: ['circuit-roles-user'] });
      queryClient.invalidateQueries({ queryKey: ['organizer-circuits-mine'] });
      if (accept) Alert.alert('¡Listo!', 'Ya sos parte del staff del circuito.');
    },
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudo responder la invitación')),
  });

  if (!invitations.length) return null;

  return (
    <AppCard style={{ backgroundColor: CARD_BG, marginBottom: ui.spacing.md, ...style }}>
      <Text
        style={{
          fontSize: 15,
          fontWeight: '700',
          color: ui.colors.textPrimary,
          fontFamily: fontFamily.regular,
          marginBottom: 12,
        }}
      >
        Invitaciones a circuitos
      </Text>
      {invitations.map((inv, index) => (
        <View
          key={inv.id}
          style={{
            paddingTop: index ? 14 : 0,
            marginTop: index ? 14 : 0,
            borderTopWidth: index ? 1 : 0,
            borderTopColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {inv.circuitLogoUrl ? (
              <Image source={{ uri: inv.circuitLogoUrl }} style={{ width: 44, height: 44, borderRadius: 12 }} />
            ) : (
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: 'rgba(215,255,0,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="git-network" size={22} color={LIME} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontWeight: '700', color: ui.colors.textPrimary, fontFamily: fontFamily.regular }}
                onPress={() => router.push(`/circuit/${inv.circuitId}` as any)}
              >
                {inv.displayTitle}
              </Text>
              <Text style={{ fontSize: 12, color: MUTED, marginTop: 2, fontFamily: fontFamily.regular }}>
                {inv.invitedByName ? `${inv.invitedByName} te invitó · ` : ''}
                {CIRCUIT_ROLE_DESCRIPTIONS[inv.role]}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Rechazar"
                variant="outline"
                size="sm"
                fullWidth
                disabled={respond.isPending}
                onPress={() => respond.mutate({ id: inv.id, accept: false })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Aceptar"
                size="sm"
                fullWidth
                loading={respond.isPending && respond.variables?.id === inv.id && respond.variables.accept}
                disabled={respond.isPending}
                onPress={() => respond.mutate({ id: inv.id, accept: true })}
              />
            </View>
          </View>
        </View>
      ))}
    </AppCard>
  );
}
