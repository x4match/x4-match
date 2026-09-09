import { View, Text, ScrollView, Alert, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchTournamentDetail,
  fetchMyRegistration,
  registerTeam,
  createRegistrationCheckout,
  simulatePayment,
} from '@/lib/tournament/api';
import { tournamentPrice, formatTournamentCategory } from '@/lib/tournament/types';
import { formatCurrency } from '@/lib/format';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, PrimaryButton, InputField, SectionHeader } from '@/components/padely';

export default function TournamentRegisterScreen() {
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const inviteToken = typeof invite === 'string' ? invite : undefined;

  const [player1Name, setPlayer1Name] = useState(user?.name || '');
  const [player2Name, setPlayer2Name] = useState('');
  const [player1Email, setPlayer1Email] = useState(user?.email || '');
  const [player2Email, setPlayer2Email] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');

  const { data: tournament } = useQuery({
    queryKey: ['tournament-detail', id, inviteToken],
    queryFn: () => fetchTournamentDetail(id!, inviteToken),
    enabled: !!id,
  });

  const { data: myReg, refetch: refetchMyReg } = useQuery({
    queryKey: ['tournament-my-reg', id],
    queryFn: () => fetchMyRegistration(id!),
    enabled: !!id,
  });

  const price = tournament ? tournamentPrice(tournament) : 0;
  const needsPayment = price > 0;

  const registerMutation = useMutation({
    mutationFn: () =>
      registerTeam(
        id!,
        {
          player1Name: player1Name.trim(),
          player2Name: player2Name.trim(),
          player1UserId: user?.id,
          player1Email: player1Email.trim() || undefined,
          player2Email: player2Email.trim() || undefined,
          phone: phone.trim() || undefined,
          category: tournament?.category || undefined,
        },
        inviteToken,
      ),
    onSuccess: (reg: any) => {
      queryClient.invalidateQueries({ queryKey: ['tournament-my-reg', id] });
      queryClient.invalidateQueries({ queryKey: ['tournament-registrations', id] });
      queryClient.invalidateQueries({ queryKey: ['tournament-detail', id] });
      refetchMyReg();
      if (!needsPayment) {
        const waitlisted = reg?.status === 'WAITLIST';
        Alert.alert(
          waitlisted ? 'Lista de espera' : '¡Inscripción enviada!',
          waitlisted
            ? 'El torneo está completo. Quedaste en lista de espera.'
            : 'Quedó pendiente de aprobación del organizador.',
          [{ text: 'Ver torneo', onPress: () => router.replace(`/tournament/${id}` as any) }],
        );
      }
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo inscribir'),
  });

  const checkoutMutation = useMutation({
    mutationFn: (regId: string) => createRegistrationCheckout(id!, regId),
    onSuccess: async (data) => {
      if (data.checkoutUrl) {
        await Linking.openURL(data.checkoutUrl);
      } else if (data.paid) {
        Alert.alert('Listo', 'No se requiere pago.');
      }
      refetchMyReg();
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo iniciar el pago'),
  });

  const simulateMutation = useMutation({
    mutationFn: (regId: string) => simulatePayment(id!, regId),
    onSuccess: () => {
      Alert.alert('Pago acreditado', 'Tu inscripción quedó pagada (modo prueba).');
      queryClient.invalidateQueries({ queryKey: ['tournament-my-reg', id] });
      refetchMyReg();
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo simular el pago'),
  });

  const alreadyRegistered = !!myReg;
  const paid = myReg?.payment_status === 'APPROVED';

  return (
    <Screen>
      <StackHeader title="Inscripción" />
      <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }}>
        {tournament ? (
          <AppCard>
            <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textPrimary }}>{tournament.name}</Text>
            <Text style={{ color: ui.colors.textSecondary, marginTop: 4 }}>
              {formatTournamentCategory(tournament.category, tournament.gender)}
            </Text>
            <Text style={{ color: ui.colors.textSecondary, marginTop: 4 }}>
              {needsPayment ? `Inscripción: ${formatCurrency(price)} por pareja` : 'Inscripción gratuita'}
            </Text>
          </AppCard>
        ) : null}

        {alreadyRegistered ? (
          <>
            <AppCard>
              <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 4 }}>
                Ya estás inscripto
              </Text>
              <Text style={{ color: ui.colors.textSecondary }}>
                {myReg!.player1_name} / {myReg!.player2_name}
              </Text>
              <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginTop: 8 }}>
                Estado:{' '}
                {myReg!.status === 'APPROVED'
                  ? 'Aprobada'
                  : myReg!.status === 'REJECTED'
                    ? 'Rechazada'
                    : myReg!.status === 'WAITLIST'
                      ? 'Lista de espera'
                      : 'Pendiente de aprobación'}
              </Text>
              {needsPayment ? (
                <Text style={{ color: paid ? ui.colors.success : ui.colors.warning, fontSize: 13, marginTop: 4, fontWeight: '600' }}>
                  Pago: {paid ? 'Acreditado' : 'Pendiente'}
                </Text>
              ) : null}
            </AppCard>

            {needsPayment && !paid ? (
              <>
                <PrimaryButton
                  label={`Pagar inscripción · ${formatCurrency(price)}`}
                  fullWidth
                  loading={checkoutMutation.isPending}
                  onPress={() => checkoutMutation.mutate(myReg!.id)}
                  style={{ marginBottom: 8 }}
                />
                <PrimaryButton
                  label="Ya pagué / actualizar estado"
                  variant="outline"
                  fullWidth
                  loading={simulateMutation.isPending}
                  onPress={() => simulateMutation.mutate(myReg!.id)}
                />
                <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                  Se abrirá el checkout de pago. Al volver, tocá “actualizar estado”.
                </Text>
              </>
            ) : (
              <PrimaryButton
                label="Volver al torneo"
                fullWidth
                onPress={() => router.replace(`/tournament/${id}` as any)}
              />
            )}
          </>
        ) : (
          <>
            <SectionHeader title="Datos de la pareja" dark />
            <AppCard>
              <InputField label="Jugador 1" value={player1Name} onChangeText={setPlayer1Name} placeholder="Nombre y apellido" />
              <InputField
                label="Email jugador 1"
                value={player1Email}
                onChangeText={setPlayer1Email}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <InputField label="Jugador 2 (compañero/a)" value={player2Name} onChangeText={setPlayer2Name} placeholder="Nombre y apellido" />
              <InputField
                label="Email jugador 2"
                value={player2Email}
                onChangeText={setPlayer2Email}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <InputField label="Teléfono de contacto" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <PrimaryButton
                label={needsPayment ? 'Inscribirme y pagar' : 'Enviar inscripción'}
                fullWidth
                loading={registerMutation.isPending}
                onPress={() => {
                  if (!player1Name.trim() || !player2Name.trim()) {
                    Alert.alert('Datos incompletos', 'Completá el nombre de ambos jugadores.');
                    return;
                  }
                  registerMutation.mutate();
                }}
              />
              <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                El organizador revisa y aprueba las inscripciones.
              </Text>
            </AppCard>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
