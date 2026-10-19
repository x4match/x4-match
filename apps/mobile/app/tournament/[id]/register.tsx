import { View, Text, ScrollView, Alert, Linking, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useCircuitsEnabled } from '@/lib/features';
import {
  fetchTournamentDetail,
  fetchMyRegistration,
  registerTeam,
  createRegistrationCheckout,
  simulatePayment,
  withdrawRegistration,
} from '@/lib/tournament/api';
import {
  tournamentPrice,
  formatTournamentCategory,
  tournamentPaymentMethods,
  tournamentPaymentMethodsLabel,
  isWithdrawRefundable,
  registrationCountdown,
  WITHDRAW_REFUND_NOTICE_HOURS,
  type WithdrawRefundResult,
} from '@/lib/tournament/types';
import { formatCurrency } from '@/lib/format';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, PrimaryButton, InputField, SectionHeader } from '@/components/x4match';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function withdrawResultMessage(refund: WithdrawRefundResult | null): string {
  if (!refund || refund.status === 'NONE') return 'Tu inscripción quedó cancelada.';
  const amount = formatCurrency(refund.amount);
  if (refund.status === 'REFUNDED') {
    return `Te devolvimos ${amount} al medio de pago que usaste. Puede tardar unos días en verse.`;
  }
  if (refund.status === 'PENDING') {
    return `El organizador tiene que devolverte ${amount}: le quedó marcada como devolución pendiente en la gestión del torneo.`;
  }
  return refund.reason === 'POLICY_DISABLED'
    ? 'Este torneo no devuelve la inscripción al darse de baja.'
    : `Te bajaste con menos de ${WITHDRAW_REFUND_NOTICE_HOURS} h de anticipación, así que la inscripción no se devuelve.`;
}

export default function TournamentRegisterScreen() {
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const router = useRouter();
  const circuitsEnabled = useCircuitsEnabled();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const inviteToken = typeof invite === 'string' ? invite : undefined;

  const [player1Name, setPlayer1Name] = useState(user?.name || '');
  const [player2Name, setPlayer2Name] = useState('');
  const [player1Email, setPlayer1Email] = useState(user?.email || '');
  const [player2Email, setPlayer2Email] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [availDay, setAvailDay] = useState('');
  const [availStart, setAvailStart] = useState('10');
  const [availEnd, setAvailEnd] = useState('20');
  const [availSlots, setAvailSlots] = useState<
    Array<{ dayDate: string; startHour: number; endHour: number }>
  >([]);

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
  const countdown = tournament ? registrationCountdown(tournament) : null;
  const needsPayment = price > 0;
  const paymentMethods = tournament
    ? tournamentPaymentMethods(tournament)
    : { transfer: false, mercadopago: true };
  const transferData = {
    cbu: tournament?.transfer_cbu?.trim() || '',
    alias: tournament?.transfer_alias?.trim() || '',
    holderName: tournament?.transfer_holder_name?.trim() || '',
  };

  const shareTransferData = async () => {
    const lines = [
      `Inscripción ${tournament?.name || 'torneo'} · ${formatCurrency(price)}`,
      transferData.alias ? `Alias: ${transferData.alias}` : null,
      transferData.cbu ? `CBU/CVU: ${transferData.cbu}` : null,
      transferData.holderName ? `Titular: ${transferData.holderName}` : null,
    ].filter(Boolean);
    await Share.share({ message: lines.join('\n') });
  };

  const suggestedDays = useMemo(() => {
    if (!tournament?.start_date) return [] as string[];
    const start = new Date(tournament.start_date);
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      days.push(`${y}-${m}-${day}`);
    }
    return days;
  }, [tournament?.start_date]);

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
    onError: (err: any) => {
      const data = err.response?.data;
      Alert.alert(
        data?.code === 'CATEGORY_NOT_ALLOWED' ? 'Categoría no permitida' : 'Error',
        data?.message || 'No se pudo inscribir',
      );
      queryClient.invalidateQueries({ queryKey: ['tournament-detail', id] });
    },
  });

  const saveAvailability = useMutation({
    mutationFn: async () => {
      if (!myReg?.id) throw new Error('Sin inscripción');
      return api.put(`/tournaments/${id}/registrations/${myReg.id}/availability`, {
        slots: availSlots,
      });
    },
    onSuccess: () => Alert.alert('Guardado', 'Tu disponibilidad quedó cargada para el armado de horarios.'),
    onError: (err: any) =>
      Alert.alert('Error', err?.response?.data?.message || err.message || 'No se pudo guardar'),
  });

  const checkoutMutation = useMutation({
    mutationFn: (regId: string) => createRegistrationCheckout(id!, regId),
    onSuccess: async (data) => {
      if (data.checkoutUrl) {
        await Linking.openURL(data.checkoutUrl);
      } else if (data.paid) {
        Alert.alert('Listo', 'No se requiere pago.');
      } else if (data.provider === 'MANUAL' || data.methods?.transfer) {
        Alert.alert(
          'Transferencia',
          data.message || 'Transferí el monto con los datos de abajo. El organizador acredita el pago.',
        );
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

  const withdrawMutation = useMutation({
    mutationFn: (regId: string) => withdrawRegistration(id!, regId),
    onSuccess: ({ refund }) => {
      queryClient.invalidateQueries({ queryKey: ['tournament-my-reg', id] });
      queryClient.invalidateQueries({ queryKey: ['tournament-registrations', id] });
      queryClient.invalidateQueries({ queryKey: ['tournament-detail', id] });
      Alert.alert('Te diste de baja', withdrawResultMessage(refund), [
        { text: 'Ver torneo', onPress: () => router.replace(`/tournament/${id}` as any) },
      ]);
    },
    onError: (err: any) =>
      Alert.alert('Error', err.response?.data?.message || 'No se pudo cancelar la inscripción'),
  });

  const alreadyRegistered = !!myReg;
  const paid = myReg?.payment_status === 'APPROVED';
  const refundable = tournament ? isWithdrawRefundable(tournament) : false;

  const confirmWithdraw = () => {
    if (!myReg) return;
    const policy = !paid
      ? 'Tu pareja va a quedar fuera del torneo.'
      : refundable
        ? `Faltan más de ${WITHDRAW_REFUND_NOTICE_HOURS} h para el torneo: te devolvemos ${formatCurrency(Number(myReg.payment_amount ?? price))}.`
        : tournament?.refund_on_withdraw === false
          ? 'Este torneo no devuelve la inscripción al darse de baja.'
          : `Faltan menos de ${WITHDRAW_REFUND_NOTICE_HOURS} h para el torneo: la inscripción no se devuelve.`;
    Alert.alert('¿Darte de baja?', policy, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Darme de baja',
        style: 'destructive',
        onPress: () => withdrawMutation.mutate(myReg.id),
      },
    ]);
  };

  return (
    <Screen>
      <StackHeader title="Inscripción" />
      <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {tournament ? (
          <AppCard>
            <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textPrimary }}>{tournament.name}</Text>
            <Text style={{ color: ui.colors.textSecondary, marginTop: 4 }}>
              {formatTournamentCategory(tournament.category, tournament.gender)}
            </Text>
            <Text style={{ color: ui.colors.textSecondary, marginTop: 4 }}>
              {needsPayment ? `Inscripción: ${formatCurrency(price)} por jugador` : 'Inscripción gratuita'}
            </Text>
            {needsPayment ? (
              <Text style={{ color: ui.colors.textSecondary, marginTop: 4, fontSize: 13 }}>
                Pago: {tournamentPaymentMethodsLabel(tournament)}
              </Text>
            ) : null}
            {countdown ? (
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  fontWeight: '700',
                  color: countdown.closed ? ui.colors.danger : countdown.urgent ? ui.colors.warning : ui.colors.primary,
                }}
              >
                {countdown.label}
              </Text>
            ) : null}
            {circuitsEnabled && tournament.circuit_id ? (
              <Text style={{ color: ui.colors.textMuted, marginTop: 6, fontSize: 12 }}>
                Fecha de circuito: no podés jugar una categoría más baja que la tuya en el circuito.
              </Text>
            ) : null}
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

            <SectionHeader
              title="Disponibilidad para horarios"
              subtitle="Ayuda a ubicar tu partido en sedes y turnos"
              dark
            />
            <AppCard>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {suggestedDays.map((d) => {
                  const date = new Date(`${d}T12:00:00`);
                  const active = availDay === d;
                  return (
                    <PrimaryButton
                      key={d}
                      size="sm"
                      variant={active ? 'primary' : 'ghost'}
                      label={`${DAY_LABELS[date.getDay()]} ${d.slice(8)}`}
                      onPress={() => setAvailDay(d)}
                    />
                  );
                })}
              </View>
              <InputField label="Desde (hora)" value={availStart} onChangeText={setAvailStart} keyboardType="number-pad" />
              <InputField label="Hasta (hora)" value={availEnd} onChangeText={setAvailEnd} keyboardType="number-pad" />
              <PrimaryButton
                label="Agregar franja"
                variant="outline"
                fullWidth
                style={{ marginTop: 8 }}
                onPress={() => {
                  const startHour = Number(availStart);
                  const endHour = Number(availEnd);
                  if (!availDay) {
                    Alert.alert('Elegí un día', 'Seleccioná un día del evento.');
                    return;
                  }
                  if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) {
                    Alert.alert('Franja inválida', 'Revisá hora desde/hasta.');
                    return;
                  }
                  setAvailSlots((prev) => [...prev, { dayDate: availDay, startHour, endHour }]);
                }}
              />
              {availSlots.map((s, idx) => (
                <Text key={`${s.dayDate}-${idx}`} style={{ color: ui.colors.textSecondary, marginTop: 8, fontSize: 13 }}>
                  {s.dayDate} · {s.startHour}:00–{s.endHour}:00
                </Text>
              ))}
              <PrimaryButton
                label="Guardar disponibilidad"
                fullWidth
                style={{ marginTop: 12 }}
                loading={saveAvailability.isPending}
                disabled={!availSlots.length}
                onPress={() => saveAvailability.mutate()}
              />
            </AppCard>

            {needsPayment && !paid ? (
              <>
                {paymentMethods.transfer ? (
                  <AppCard>
                    <Text style={{ fontWeight: '800', color: ui.colors.textPrimary, marginBottom: 6 }}>
                      Transferencia
                    </Text>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                      Transferí {formatCurrency(price)} y avisale al organizador. El pago se acredita a mano.
                    </Text>
                    {transferData.alias ? (
                      <Text style={{ color: ui.colors.textPrimary, fontSize: 15, fontWeight: '700' }}>
                        Alias: {transferData.alias}
                      </Text>
                    ) : null}
                    {transferData.cbu ? (
                      <Text style={{ color: ui.colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 6 }}>
                        CBU/CVU: {transferData.cbu}
                      </Text>
                    ) : null}
                    {transferData.holderName ? (
                      <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginTop: 6 }}>
                        Titular: {transferData.holderName}
                      </Text>
                    ) : null}
                    <PrimaryButton
                      label="Compartir datos"
                      variant="outline"
                      fullWidth
                      style={{ marginTop: 12 }}
                      onPress={() => shareTransferData()}
                    />
                  </AppCard>
                ) : null}

                {paymentMethods.mercadopago ? (
                  <PrimaryButton
                    label={`Pagar con Mercado Pago · ${formatCurrency(price)}`}
                    fullWidth
                    loading={checkoutMutation.isPending}
                    onPress={() => checkoutMutation.mutate(myReg!.id)}
                    style={{ marginBottom: 8 }}
                  />
                ) : (
                  <PrimaryButton
                    label="Avisar que ya transferí"
                    fullWidth
                    loading={checkoutMutation.isPending}
                    onPress={() => checkoutMutation.mutate(myReg!.id)}
                    style={{ marginBottom: 8 }}
                  />
                )}
                {paymentMethods.mercadopago ? (
                  <PrimaryButton
                    label="Ya pagué / actualizar estado"
                    variant="outline"
                    fullWidth
                    loading={simulateMutation.isPending}
                    onPress={() => simulateMutation.mutate(myReg!.id)}
                  />
                ) : null}
                <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                  {paymentMethods.mercadopago
                    ? 'Mercado Pago abre el checkout. Si transferís, el organizador acredita el pago.'
                    : 'Cuando el organizador vea la transferencia, marca el pago como acreditado.'}
                </Text>
              </>
            ) : (
              <PrimaryButton
                label="Volver al torneo"
                fullWidth
                onPress={() => router.replace(`/tournament/${id}` as any)}
              />
            )}

            <PrimaryButton
              label="Darme de baja"
              variant="ghost"
              fullWidth
              style={{ marginTop: 16 }}
              loading={withdrawMutation.isPending}
              onPress={confirmWithdraw}
            />
            {needsPayment && tournament?.refund_on_withdraw !== false ? (
              <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                Si te bajás hasta {WITHDRAW_REFUND_NOTICE_HOURS} h antes del torneo, te devolvemos la inscripción.
              </Text>
            ) : null}
          </>
        ) : countdown?.closed ? (
          <AppCard>
            <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 4 }}>Inscripción cerrada</Text>
            <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
              El organizador ya cerró la inscripción de esta categoría.
            </Text>
            <PrimaryButton
              label="Volver al torneo"
              variant="outline"
              fullWidth
              style={{ marginTop: 12 }}
              onPress={() => router.replace(`/tournament/${id}` as any)}
            />
          </AppCard>
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
                label={
                  needsPayment
                    ? paymentMethods.transfer && !paymentMethods.mercadopago
                      ? 'Inscribirme y transferir'
                      : 'Inscribirme y pagar'
                    : 'Enviar inscripción'
                }
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
