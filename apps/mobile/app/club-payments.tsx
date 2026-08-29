import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Linking,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import {
  clubPaymentStatusLabel,
  clubPaymentStatusTone,
  type ClubPaymentConfigStatus,
} from '@/lib/club-payments';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  PrimaryButton,
  EmptyState,
} from '@/components/padely';
import {
  ClubPicker,
  resolveActiveClubId,
  useMineClubs,
} from '@/components/club/ClubPicker';

function statusPillColors(tone: ReturnType<typeof clubPaymentStatusTone>) {
  switch (tone) {
    case 'success':
      return { bg: ui.colors.successSoft, text: ui.colors.success };
    case 'warning':
      return { bg: ui.colors.warningSoft, text: ui.colors.warning };
    case 'danger':
      return { bg: ui.colors.dangerSoft, text: ui.colors.danger };
    default:
      return { bg: ui.colors.surface3, text: ui.colors.textSecondary };
  }
}

export default function ClubPaymentsScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = isClub(user?.role);
  const params = useLocalSearchParams<{
    clubId?: string;
    clubName?: string;
    status?: string;
    message?: string;
  }>();

  const [selectedClubId, setSelectedClubId] = useState<string | null>(params.clubId || null);
  const { data: clubs } = useMineClubs(canManage);
  const activeClubId = useMemo(
    () => resolveActiveClubId(selectedClubId || params.clubId || null, clubs),
    [selectedClubId, params.clubId, clubs],
  );
  const activeClub = clubs?.find((c) => c.id === activeClubId);

  const {
    data: paymentStatus,
    isLoading,
    isRefetching,
    refetch,
    isError,
  } = useQuery({
    queryKey: ['club-mp-status', activeClubId],
    queryFn: async () => {
      const res = await api.get<ClubPaymentConfigStatus>(`/clubs/${activeClubId}/payments/status`);
      return res.data;
    },
    enabled: canManage && !!activeClubId,
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['club-mp-status', activeClubId] });
    await queryClient.invalidateQueries({ queryKey: ['club-manager-report', activeClubId] });
  }, [activeClubId, queryClient]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ authUrl: string }>(
        `/clubs/${activeClubId}/payments/oauth/start`,
      );
      return res.data;
    },
    onSuccess: async (data) => {
      const canOpen = await Linking.canOpenURL(data.authUrl);
      if (!canOpen) {
        Alert.alert('Error', 'No se pudo abrir Mercado Pago en este dispositivo.');
        return;
      }
      await Linking.openURL(data.authUrl);
    },
    onError: (err: any) => {
      Alert.alert(
        'No se pudo iniciar la conexión',
        err.response?.data?.message || 'Intentá de nuevo en unos minutos.',
      );
    },
  });

  const mockConnectMutation = useMutation({
    mutationFn: async () => api.post(`/clubs/${activeClubId}/payments/mock-connect`),
    onSuccess: async () => {
      await invalidate();
      Alert.alert('Listo', 'Mercado Pago simulado para pruebas.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo simular la conexión.');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => api.delete(`/clubs/${activeClubId}/payments/disconnect`),
    onSuccess: async () => {
      await invalidate();
      Alert.alert('Desconectado', 'Mercado Pago ya no está vinculado a este club.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo desconectar.');
    },
  });

  const modeMutation = useMutation({
    mutationFn: async (mode: 'online' | 'manual') =>
      api.patch(`/clubs/${activeClubId}/payments/mode`, { mode }),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo actualizar el modo de cobro.');
    },
  });

  useEffect(() => {
    if (params.status === 'connected') {
      void invalidate();
      Alert.alert('Mercado Pago conectado', 'Los cobros online van directo a la cuenta de tu club.');
    } else if (params.status === 'error') {
      Alert.alert(
        'No se pudo conectar',
        params.message ? decodeURIComponent(params.message) : 'Intentá de nuevo.',
      );
    }
  }, [params.status, params.message, invalidate]);

  const title = params.clubName
    ? `Pagos · ${params.clubName}`
    : activeClub?.name
      ? `Pagos · ${activeClub.name}`
      : 'Pagos del club';

  if (!canManage) {
    return (
      <Screen>
        <StackHeader title="Pagos" />
        <EmptyState
          icon={<Ionicons name="card-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
          description="Esta sección es solo para cuentas de club."
        />
      </Screen>
    );
  }

  const status = paymentStatus?.status ?? 'DISCONNECTED';
  const tone = clubPaymentStatusTone(status);
  const pillColors = statusPillColors(tone);

  return (
    <Screen>
      <StackHeader title={title} />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={ui.colors.primary} />
        }
      >
        <ClubPicker
          selectedClubId={activeClubId}
          onSelect={setSelectedClubId}
          enabled={canManage}
        />

        {!activeClubId ? (
          <EmptyState
            icon={<Ionicons name="business-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin club"
            description="Seleccioná un club para configurar Mercado Pago."
          />
        ) : isLoading ? (
          <Text style={{ color: ui.colors.textMuted }}>Cargando configuración de pagos...</Text>
        ) : isError ? (
          <AppCard>
            <Text style={{ color: ui.colors.danger }}>No se pudo cargar el estado de pagos.</Text>
            <PrimaryButton label="Reintentar" onPress={() => refetch()} style={{ marginTop: 12 }} />
          </AppCard>
        ) : (
          <>
            <AppCard variant="gradient" style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: 'rgba(245,197,24,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="wallet-outline" size={22} color={ui.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', fontSize: 17, color: ui.colors.textPrimary }}>
                    Mercado Pago del club
                  </Text>
                  <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 4 }}>
                    La plata de jugadores va directo a tu cuenta. x4 match no la recibe.
                  </Text>
                </View>
              </View>
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: pillColors.bg,
                  borderRadius: ui.radius.pill,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: ui.colors.border,
                }}
              >
                <Text style={{ color: pillColors.text, fontSize: 11, fontWeight: '700' }}>
                  {clubPaymentStatusLabel(status)}
                </Text>
              </View>
              {paymentStatus?.mpUserId ? (
                <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 10 }}>
                  Cuenta MP ·•••{paymentStatus.mpUserId.slice(-4)}
                  {paymentStatus.connectedAt
                    ? ` · conectada ${new Date(paymentStatus.connectedAt).toLocaleDateString('es-AR')}`
                    : ''}
                </Text>
              ) : null}
            </AppCard>

            {status !== 'CONNECTED' ? (
              <AppCard style={{ marginBottom: 16, borderColor: 'rgba(245,197,24,0.25)' }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 6 }}>
                  Conectá Mercado Pago para cobrar señas online
                </Text>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, lineHeight: 18 }}>
                  Sin conexión, los jugadores pueden pagar en recepción y vos marcás el cobro en
                  Finanzas del club.
                </Text>
              </AppCard>
            ) : null}

            {paymentStatus?.usesPlatformFallback ? (
              <AppCard style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, lineHeight: 18 }}>
                  Modo transición: los cobros usan la cuenta de plataforma hasta que conectes la tuya.
                </Text>
              </AppCard>
            ) : null}

            <SectionActions
              status={status}
              oauthConfigured={paymentStatus?.oauthConfigured ?? false}
              connecting={connectMutation.isPending}
              disconnecting={disconnectMutation.isPending}
              modeLoading={modeMutation.isPending}
              onConnect={() => connectMutation.mutate()}
              onDisconnect={() => {
                Alert.alert(
                  'Desconectar Mercado Pago',
                  'Los jugadores no podrán pagar online hasta que vuelvas a conectar.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Desconectar', style: 'destructive', onPress: () => disconnectMutation.mutate() },
                  ],
                );
              }}
              onManual={() => modeMutation.mutate('manual')}
              onOnline={() => modeMutation.mutate('online')}
              onMockConnect={() => mockConnectMutation.mutate()}
              mockLoading={mockConnectMutation.isPending}
            />

            <AppCard style={{ marginTop: 8 }}>
              <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 8 }}>
                ¿Cómo funciona?
              </Text>
              {[
                'El jugador paga la seña con Mercado Pago del club.',
                'x4 match solo registra el estado (cobrado / pendiente).',
                'La suscripción de x4 match se cobra aparte, nunca mezclada.',
              ].map((line) => (
                <View key={line} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="checkmark-circle" size={16} color={ui.colors.primary} style={{ marginTop: 2 }} />
                  <Text style={{ flex: 1, fontSize: 13, color: ui.colors.textSecondary, lineHeight: 18 }}>
                    {line}
                  </Text>
                </View>
              ))}
            </AppCard>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

type SectionActionsProps = {
  status: ClubPaymentConfigStatus['status'];
  oauthConfigured: boolean;
  connecting: boolean;
  disconnecting: boolean;
  modeLoading: boolean;
  mockLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onManual: () => void;
  onOnline: () => void;
  onMockConnect: () => void;
};

function SectionActions({
  status,
  oauthConfigured,
  connecting,
  disconnecting,
  modeLoading,
  mockLoading,
  onConnect,
  onDisconnect,
  onManual,
  onOnline,
  onMockConnect,
}: SectionActionsProps) {
  return (
    <View style={{ gap: 10 }}>
      {status === 'CONNECTED' || status === 'EXPIRED' ? (
        <>
          {status === 'EXPIRED' ? (
            <PrimaryButton
              label="Reconectar Mercado Pago"
              onPress={onConnect}
              loading={connecting}
              icon={<Ionicons name="link-outline" size={18} color={ui.colors.textInverse} />}
            />
          ) : null}
          <PrimaryButton
            label="Desconectar cuenta"
            variant="outline"
            onPress={onDisconnect}
            loading={disconnecting}
          />
        </>
      ) : (
        <>
          <PrimaryButton
            label="Conectar Mercado Pago"
            onPress={onConnect}
            loading={connecting}
            disabled={!oauthConfigured}
            icon={<Ionicons name="link-outline" size={18} color={ui.colors.textInverse} />}
          />
          {!oauthConfigured ? (
            <Text style={{ fontSize: 12, color: ui.colors.textMuted, textAlign: 'center' }}>
              OAuth de Mercado Pago pendiente de configurar en el servidor.
            </Text>
          ) : null}
        </>
      )}

      {status === 'MANUAL_ONLY' ? (
        <PrimaryButton
          label="Activar cobros online"
          variant="outline"
          onPress={onOnline}
          loading={modeLoading}
        />
      ) : (
        <TouchableOpacity onPress={onManual} disabled={modeLoading}>
          <AppCard padding="sm">
            <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
              Usar solo cobro en recepción
            </Text>
            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
              Sin checkout online. Marcás los pagos manualmente en Finanzas.
            </Text>
          </AppCard>
        </TouchableOpacity>
      )}

      {__DEV__ ? (
        <PrimaryButton
          label="Simular conexión (dev)"
          variant="ghost"
          onPress={onMockConnect}
          loading={mockLoading}
        />
      ) : null}
    </View>
  );
}
