import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import { AppCard, InputField, PrimaryButton, SectionHeader } from '@/components/x4match';

export const DEFAULT_SLOT_OFFER_RADIUS_KM = 10;

type OutreachTotals = {
  playersReached: number;
  notificationsSent: number;
  notificationsOpened: number;
  slotsOffered: number;
  slotsBooked: number;
};

type OutreachStats = OutreachTotals & {
  days: number;
  manual: OutreachTotals;
  auto: OutreachTotals;
};

function percent(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '–';
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: ui.colors.textPrimary, marginTop: 2 }}>{value}</Text>
      {hint ? <Text style={{ fontSize: 11, color: ui.colors.textSecondary, marginTop: 2 }}>{hint}</Text> : null}
    </View>
  );
}

function RadiusSetting({ clubId, radiusKm }: { clubId: string; radiusKm: number }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(String(radiusKm));
  useEffect(() => setValue(String(radiusKm)), [radiusKm]);

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 50;

  const save = useMutation({
    mutationFn: async () => {
      await api.patch(`/clubs/${clubId}/slot-offer-settings`, { radiusKm: parsed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-detail-slots', clubId] });
      Alert.alert('Listo', `Radio de aviso: ${parsed} km`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      Alert.alert('Error', (Array.isArray(message) ? message[0] : message) || 'No se pudo guardar el radio');
    },
  });

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <InputField
            label="Radio de aviso (km)"
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            error={value !== '' && !valid ? 'Entre 1 y 50 km' : undefined}
          />
        </View>
        <View style={{ marginBottom: ui.spacing.md }}>
          <PrimaryButton
            label="Guardar"
            size="sm"
            variant="outline"
            loading={save.isPending}
            disabled={!valid || parsed === radiusKm}
            onPress={() => save.mutate()}
          />
        </View>
      </View>
    </View>
  );
}

export function OutreachStatsCard({
  clubId,
  radiusKm,
  enabled = true,
}: {
  clubId?: string | null;
  radiusKm?: number;
  enabled?: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['club-outreach-stats', clubId],
    queryFn: async () => (await api.get(`/clubs/${clubId}/outreach-stats`, { params: { days: 30 } })).data as OutreachStats,
    enabled: enabled && !!clubId,
  });

  return (
    <>
      <SectionHeader
        style={{ marginTop: 16 }}
        title="Avisos a jugadores"
        subtitle="Avisar jugadores + Smart Fill · últimos 30 días"
      />
      <AppCard style={{ marginBottom: 20 }}>
        {clubId ? <RadiusSetting clubId={clubId} radiusKm={radiusKm ?? DEFAULT_SLOT_OFFER_RADIUS_KM} /> : null}
        {isLoading ? (
          <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando avisos...</Text>
        ) : !data || data.notificationsSent === 0 ? (
          <Text style={{ color: ui.colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            Todavía no se enviaron avisos. Cuando publiques un horario con “Avisar jugadores” vas a ver acá
            cuántos lo vieron y cuántos reservaron.
          </Text>
        ) : (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Metric label="Avisos" value={data.notificationsSent} hint={`${data.playersReached} jugadores`} />
              <Metric
                label="Vistos"
                value={data.notificationsOpened}
                hint={percent(data.notificationsOpened, data.notificationsSent)}
              />
              <Metric
                label="Reservas"
                value={data.slotsBooked}
                hint={`de ${data.slotsOffered} horarios`}
              />
            </View>
            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, lineHeight: 17 }}>
              Manual: {data.manual.notificationsSent} avisos · {data.manual.slotsBooked} reservas{'\n'}
              Smart Fill: {data.auto.notificationsSent} avisos · {data.auto.slotsBooked} reservas
            </Text>
            <Text style={{ fontSize: 11, color: ui.colors.textMuted, lineHeight: 16 }}>
              Una reserva cuenta cuando un jugador avisado se suma al partido de ese horario.
            </Text>
          </View>
        )}
      </AppCard>
    </>
  );
}
