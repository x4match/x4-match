import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@/lib/currency';
import { ui } from '@/theme/tokens';
import { AppCard } from '@/components/padely';

export interface ClubImpactSummary {
  monthKey: string;
  revenueCollected: number;
  revenueDeposits: number;
  revenueShop: number;
  newPlayers: number;
  matchesFinished: number;
  activePlayers: number;
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return 'Este mes';
  return new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

type ClubImpactBannerProps = {
  impact?: ClubImpactSummary;
  clubName?: string;
  loading?: boolean;
};

export function ClubImpactBanner({ impact, clubName, loading }: ClubImpactBannerProps) {
  if (loading) {
    return (
      <AppCard style={{ marginBottom: 16 }} padding="md">
        <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>Cargando impacto del mes...</Text>
      </AppCard>
    );
  }

  if (!impact) return null;

  const hasActivity =
    impact.revenueCollected > 0 ||
    impact.newPlayers > 0 ||
    impact.matchesFinished > 0;

  const on = ui.colors.onPrimary;
  const onMuted = ui.colors.bgElevated === '#FFFFFF' ? 'rgba(255,255,255,0.85)' : 'rgba(10,10,10,0.7)';
  const onSoft = ui.colors.bgElevated === '#FFFFFF' ? 'rgba(255,255,255,0.15)' : 'rgba(10,10,10,0.1)';
  const iconBg = ui.colors.bgElevated === '#FFFFFF' ? 'rgba(255,255,255,0.2)' : 'rgba(10,10,10,0.12)';

  return (
    <AppCard style={{ marginBottom: 16, backgroundColor: ui.colors.primary }} padding="lg">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="trending-up" size={20} color={on} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: onMuted, fontSize: 12, fontWeight: '600' }}>
            Impacto x4 match · {monthLabel(impact.monthKey)}
          </Text>
          <Text style={{ color: on, fontSize: 16, fontWeight: '800', marginTop: 2 }}>
            {clubName ? `Rendimiento de ${clubName}` : 'Rendimiento del club'}
          </Text>
        </View>
      </View>

      {!hasActivity ? (
        <Text style={{ color: onMuted, fontSize: 13, lineHeight: 20 }}>
          Todavía no hay movimiento este mes. Publicá horarios y activá la tienda para empezar a recaudar.
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: onSoft,
                borderRadius: ui.radius.sm,
                padding: 12,
              }}
            >
              <Text style={{ color: onMuted, fontSize: 11 }}>Recaudado</Text>
              <Text style={{ color: on, fontSize: 22, fontWeight: '800', marginTop: 4 }}>
                {formatCurrency(impact.revenueCollected)}
              </Text>
              {(impact.revenueDeposits > 0 || impact.revenueShop > 0) && (
                <Text style={{ color: onMuted, fontSize: 10, marginTop: 4 }}>
                  {impact.revenueDeposits > 0 ? `Señas ${formatCurrency(impact.revenueDeposits)}` : ''}
                  {impact.revenueDeposits > 0 && impact.revenueShop > 0 ? ' · ' : ''}
                  {impact.revenueShop > 0 ? `Tienda ${formatCurrency(impact.revenueShop)}` : ''}
                </Text>
              )}
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: onSoft,
                borderRadius: ui.radius.sm,
                padding: 12,
              }}
            >
              <Text style={{ color: onMuted, fontSize: 11 }}>Jugadores nuevos</Text>
              <Text style={{ color: on, fontSize: 22, fontWeight: '800', marginTop: 4 }}>
                {impact.newPlayers}
              </Text>
              <Text style={{ color: onMuted, fontSize: 10, marginTop: 4 }}>
                Primera vez en el club
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            <Text style={{ color: onMuted, fontSize: 12 }}>
              {impact.matchesFinished}{' '}
              {impact.matchesFinished === 1 ? 'partido finalizado' : 'partidos finalizados'}
            </Text>
            <Text style={{ color: onMuted, fontSize: 12 }}>
              {impact.activePlayers}{' '}
              {impact.activePlayers === 1 ? 'jugador activo' : 'jugadores activos'}
            </Text>
          </View>
        </>
      )}
    </AppCard>
  );
}
