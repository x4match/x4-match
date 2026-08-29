import { View, Text, Alert, Linking } from 'react-native';
import { formatCurrency } from '@/lib/currency';
import { formatShortDate } from '@/lib/format';
import { isMovementCollected, type RevenueMovement } from '@/lib/club-revenue';
import { ui } from '@/theme/tokens';
import { AppCard, PrimaryButton } from '@/components/padely';

type RevenueMovementRowProps = {
  item: RevenueMovement;
  onMarkPaid?: (item: RevenueMovement) => void;
  confirming?: boolean;
};

export function RevenueMovementRow({ item, onMarkPaid, confirming }: RevenueMovementRowProps) {
  const collected = isMovementCollected(item.status);
  const canCollect = !collected && item.status === 'PENDING' && !!onMarkPaid;
  const checkoutUrl = item.checkoutUrl?.trim() || null;

  const openMercadoPago = async () => {
    if (!checkoutUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(checkoutUrl);
      if (canOpen) {
        await Linking.openURL(checkoutUrl);
        return;
      }
      Alert.alert('No se pudo abrir', 'Revisá el link de pago e intentá de nuevo.');
    } catch {
      Alert.alert('Error', 'No se pudo abrir el link de Mercado Pago.');
    }
  };

  return (
    <AppCard
      padding="sm"
      style={{
        marginBottom: 8,
        borderWidth: canCollect ? 1 : 0,
        borderColor: canCollect ? ui.colors.danger : 'transparent',
        backgroundColor: canCollect ? 'rgba(239,68,68,0.06)' : undefined,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{item.label}</Text>
          <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
            {item.userName} · {formatShortDate(item.occurredAt)}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: collected ? ui.colors.success : ui.colors.danger,
              marginTop: 2,
              fontWeight: '700',
            }}
          >
            {collected ? 'Cobrado' : 'Pendiente de cobro'}
          </Text>
        </View>
        <Text style={{ fontWeight: '800', color: ui.colors.primary }}>{formatCurrency(item.amount)}</Text>
      </View>
      {canCollect ? (
        <View style={{ marginTop: 10, gap: 8 }}>
          {checkoutUrl ? (
            <PrimaryButton
              label="Abrir link MP"
              size="sm"
              fullWidth
              variant="outline"
              onPress={() => void openMercadoPago()}
            />
          ) : null}
          <PrimaryButton
            label={item.kind === 'shop' ? 'Confirmar cobro' : 'Marcar seña pagada'}
            size="sm"
            fullWidth
            loading={confirming}
            onPress={() => {
              Alert.alert(
                'Confirmar cobro en recepción',
                item.kind === 'shop'
                  ? `¿Confirmás que ${item.userName} pagó ${formatCurrency(item.amount)} por ${item.label}?`
                  : `¿Confirmás que ${item.userName} pagó la seña de ${formatCurrency(item.amount)}?`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Cobrado', onPress: () => onMarkPaid?.(item) },
                ],
              );
            }}
          />
        </View>
      ) : null}
    </AppCard>
  );
}
