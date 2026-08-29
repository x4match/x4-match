import { useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import {
  shareRevenueCsv,
  type ClubRevenueResponse,
  type RevenueMovement,
} from '@/lib/club-revenue';
import { confirmShopPurchase, markDepositPaid } from '@/lib/shop-api';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, SelectionChip, EmptyState } from '@/components/padely';
import { RevenueMovementRow } from '@/components/club/RevenueMovementRow';

type RevenuePeriod = 7 | 30 | 90;

const PERIODS: RevenuePeriod[] = [7, 30, 90];
const ALL_MOVEMENTS_LIMIT = 500;

export default function ClubBillingScreen() {
  const queryClient = useQueryClient();
  const { clubId, clubName, days: initialDays } = useLocalSearchParams<{
    clubId: string;
    clubName?: string;
    days?: string;
  }>();

  const parsedInitialDays = Number(initialDays);
  const [period, setPeriod] = useState<RevenuePeriod>(
    parsedInitialDays === 7 || parsedInitialDays === 30 || parsedInitialDays === 90 ? parsedInitialDays : 30,
  );
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['club-billing-movements', clubId, period],
    queryFn: async () => {
      const res = await api.get<ClubRevenueResponse>(`/clubs/${clubId}/revenue`, {
        params: { days: period, movementsLimit: ALL_MOVEMENTS_LIMIT },
      });
      return res.data;
    },
    enabled: !!clubId,
  });

  const invalidateBilling = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['club-billing-movements'] }),
      queryClient.invalidateQueries({ queryKey: ['club-profile-revenue'] }),
      queryClient.invalidateQueries({ queryKey: ['club-manager-report'] }),
      queryClient.invalidateQueries({ queryKey: ['club-shop-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['club-shop-sales'] }),
    ]);
  };

  const markPaidMutation = useMutation({
    mutationFn: async (item: RevenueMovement) => {
      if (!clubId) throw new Error('Club inválido');
      setConfirmingId(item.id);
      if (item.kind === 'shop') {
        return confirmShopPurchase(clubId, item.id);
      }
      return markDepositPaid(clubId, item.id);
    },
    onSuccess: async () => {
      await invalidateBilling();
      Alert.alert('Listo', 'Cobro registrado en recepción.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo registrar el cobro');
    },
    onSettled: () => setConfirmingId(null),
  });

  const title = clubName ? `Movimientos · ${clubName}` : 'Movimientos';

  const exportCsv = async () => {
    if (!data?.recent.length) {
      Alert.alert('Sin datos', 'No hay movimientos para exportar en este período.');
      return;
    }
    try {
      await shareRevenueCsv({
        clubName: clubName || 'Club',
        periodDays: period,
        summary: data.summary,
        movements: data.recent,
      });
    } catch {
      // usuario canceló
    }
  };

  const headerAction = (
    <TouchableOpacity onPress={exportCsv} style={{ padding: 8 }} accessibilityLabel="Exportar CSV">
      <Ionicons name="download-outline" size={22} color={ui.colors.textInverse} />
    </TouchableOpacity>
  );

  const listHeader = useMemo(
    () => (
      <View style={{ paddingHorizontal: ui.spacing.lg, paddingTop: ui.spacing.md, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {PERIODS.map((days) => (
            <SelectionChip
              key={days}
              label={days === 7 ? '7 días' : days === 30 ? '30 días' : '90 días'}
              selected={period === days}
              onPress={() => setPeriod(days)}
              flex
            />
          ))}
        </View>

        {data ? (
          <>
            <AppCard variant="gradient" style={{ marginBottom: 12 }} padding="lg" glow>
              <Text style={{ color: ui.colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                Caja del período
              </Text>
              <Text style={{ color: ui.colors.textPrimary, fontSize: 28, fontWeight: '800', marginTop: 4 }}>
                {formatCurrency(data.summary.totalCollected)}
              </Text>
              <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 6 }}>
                Cobrado · {data.summary.depositCount + data.summary.shopSaleCount} movimientos
              </Text>
            </AppCard>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <AppCard padding="sm" style={{ width: '48%', marginBottom: 0 }}>
                <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Ingresos</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: ui.colors.success, marginTop: 4 }}>
                  {formatCurrency(data.summary.totalCollected)}
                </Text>
              </AppCard>
              <AppCard padding="sm" style={{ width: '48%', marginBottom: 0 }}>
                <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Pendientes</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: ui.colors.danger, marginTop: 4 }}>
                  {formatCurrency(data.summary.totalPending)}
                </Text>
              </AppCard>
              <AppCard padding="sm" style={{ width: '48%', marginBottom: 0 }}>
                <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Señas</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 4 }}>
                  {formatCurrency(data.summary.collectedDeposits)}
                </Text>
                <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>
                  {data.summary.depositCount} cobros
                </Text>
              </AppCard>
              <AppCard padding="sm" style={{ width: '48%', marginBottom: 0 }}>
                <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Tienda</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: ui.colors.primary, marginTop: 4 }}>
                  {formatCurrency(data.summary.collectedShop)}
                </Text>
                <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>
                  {data.summary.shopSaleCount} ventas
                </Text>
              </AppCard>
            </View>

            <AppCard padding="sm" style={{ marginBottom: 16 }}>
              <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 8 }}>
                Cobro en recepción
              </Text>
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary, lineHeight: 18 }}>
                Los pendientes en rojo se pueden marcar como cobrados sin bloquear otras canchas. Confirmá
                señas y compras de tienda cuando el jugador pague en el club.
              </Text>
            </AppCard>
          </>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: ui.colors.textInverse }}>Todos los movimientos</Text>
          <TouchableOpacity onPress={exportCsv} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}>
            <Ionicons name="document-text-outline" size={16} color={ui.colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.primary }}>CSV</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [data, period],
  );

  return (
    <Screen>
      <StackHeader title={title} rightAction={headerAction} />
      {isLoading ? (
        <View style={{ padding: ui.spacing.lg }}>
          <Text style={{ color: ui.colors.textMuted }}>Cargando movimientos...</Text>
        </View>
      ) : isError ? (
        <View style={{ padding: ui.spacing.lg }}>
          <EmptyState
            icon={<Ionicons name="cloud-offline-outline" size={32} color={ui.colors.textMuted} />}
            title="Error al cargar"
            description="No pudimos obtener los movimientos."
            action={
              <TouchableOpacity onPress={() => refetch()}>
                <Text style={{ color: ui.colors.primary, fontWeight: '700' }}>Reintentar</Text>
              </TouchableOpacity>
            }
          />
        </View>
      ) : (
        <FlatList
          data={data?.recent ?? []}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: ui.spacing.lg }}>
              <RevenueMovementRow
                item={item}
                confirming={confirmingId === item.id && markPaidMutation.isPending}
                onMarkPaid={(movement) => markPaidMutation.mutate(movement)}
              />
            </View>
          )}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: ui.spacing.lg }}>
              <AppCard>
                <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                  Sin movimientos en este período.
                </Text>
              </AppCard>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={ui.colors.primary} />
          }
        />
      )}
    </Screen>
  );
}
