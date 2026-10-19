import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  PrimaryButton,
  StatusPill,
  EmptyState,
  SectionHeader,
  withCircuitsEnabled,
} from '@/components/x4match';

export default withCircuitsEnabled(CircuitEventManageScreen);

function CircuitEventManageScreen() {
  const { id: circuitId, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const { data: event, refetch } = useQuery({
    queryKey: ['circuit-event', circuitId, eventId],
    queryFn: async () => {
      const res = await api.get(`/circuits/${circuitId}/events/${eventId}`);
      return res.data;
    },
    enabled: !!circuitId && !!eventId,
  });

  const { data: schedule, refetch: refetchSchedule } = useQuery({
    queryKey: ['circuit-event-schedule-draft', circuitId, eventId],
    queryFn: async () => {
      const res = await api.get(`/circuits/${circuitId}/events/${eventId}/schedule`, {
        params: { includeDraft: '1' },
      });
      return res.data as {
        scheduleStatus: string;
        matches: Array<{
          id: string;
          categoryLabel?: string | null;
          clubId?: string | null;
          clubName?: string | null;
          courtLabel?: string | null;
          teamAName?: string | null;
          teamBName?: string | null;
          scheduledAt?: string | null;
          status: string;
        }>;
        progress: { total: number; finished: number };
      };
    },
    enabled: !!circuitId && !!eventId,
  });

  const venues: Array<{ club_id: string; club_name: string; courts_count: number }> =
    event?.venues || [];

  const moveMatch = useMutation({
    mutationFn: async (payload: {
      matchId: string;
      clubId: string;
      courtLabel: string;
      scheduledAt: string;
    }) =>
      api.patch(
        `/circuits/${circuitId}/events/${eventId}/matches/${payload.matchId}/schedule`,
        {
          clubId: payload.clubId,
          courtLabel: payload.courtLabel,
          scheduledAt: payload.scheduledAt,
        },
      ),
    onSuccess: () => {
      setSelectedMatchId(null);
      void refetchSchedule();
      queryClient.invalidateQueries({ queryKey: ['circuit-event-schedule', circuitId, eventId] });
    },
    onError: (err: any) =>
      Alert.alert('Error', err?.response?.data?.message || 'No se pudo mover el partido'),
  });

  const publish = useMutation({
    mutationFn: () => api.post(`/circuits/${circuitId}/events/${eventId}/schedule/publish`),
    onSuccess: () => {
      Alert.alert('Publicado', 'Los jugadores ya ven la grilla en vivo.');
      void refetch();
      void refetchSchedule();
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message || 'No se pudo publicar'),
  });

  const selected = useMemo(
    () => schedule?.matches.find((m) => m.id === selectedMatchId) || null,
    [schedule?.matches, selectedMatchId],
  );

  return (
    <Screen>
      <StackHeader title="Gestionar grilla" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}>
        <AppCard>
          <Text style={{ fontWeight: '800', color: ui.colors.textPrimary, fontSize: 16 }}>
            {event?.name || 'Evento'}
          </Text>
          <Text style={{ color: ui.colors.textSecondary, marginTop: 6, fontSize: 13 }}>
            {schedule?.progress
              ? `${schedule.progress.finished}/${schedule.progress.total} finalizados · estado ${schedule.scheduleStatus}`
              : 'Sin partidos scheduleados todavía'}
          </Text>
          <View style={{ marginTop: 12 }}>
            <PrimaryButton
              label="Ver etapa en vivo"
              variant="outline"
              fullWidth
              onPress={() => router.replace(`/circuit/${circuitId}/event/${eventId}` as any)}
            />
          </View>
          {schedule?.scheduleStatus === 'DRAFT' ? (
            <View style={{ marginTop: 8 }}>
              <PrimaryButton
                label="Publicar grilla"
                fullWidth
                loading={publish.isPending}
                onPress={() => publish.mutate()}
              />
            </View>
          ) : null}
        </AppCard>

        <SectionHeader title="Sedes del evento" subtitle={`${venues.length} complejos`} dark />
        {venues.map((v) => (
          <AppCard key={v.club_id} style={{ marginBottom: 8 }}>
            <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{v.club_name}</Text>
            <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 4 }}>
              {v.courts_count} canchas
            </Text>
          </AppCard>
        ))}

        <SectionHeader
          title="Partidos"
          subtitle="Tocá uno para reasignar sede/cancha (misma hora)"
          dark
        />
        {(schedule?.matches || []).length === 0 ? (
          <EmptyState
            icon={<Ionicons name="calendar-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin horarios"
            description="Desde la etapa en vivo: generá cuadros y armá horarios multi-sede."
          />
        ) : (
          schedule!.matches.map((m) => (
            <AppCard
              key={m.id}
              style={{
                marginBottom: 8,
                borderColor: selectedMatchId === m.id ? ui.colors.primary : ui.colors.border,
              }}
              onPress={() => setSelectedMatchId(selectedMatchId === m.id ? null : m.id)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: ui.colors.textMuted, fontSize: 11, flex: 1 }} numberOfLines={1}>
                  {m.categoryLabel || 'Categoría'}
                </Text>
                <StatusPill status={m.status} />
              </View>
              <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginTop: 4 }}>
                {m.teamAName} vs {m.teamBName}
              </Text>
              <Text style={{ color: ui.colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                {[m.clubName, m.courtLabel, m.scheduledAt ? formatShortDate(m.scheduledAt) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </AppCard>
          ))
        )}

        {selected && venues.length > 0 ? (
          <AppCard>
            <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 10 }}>
              Mover partido
            </Text>
            <Text style={{ color: ui.colors.textSecondary, fontSize: 12, marginBottom: 10 }}>
              Elegí sede y cancha. Se mantiene el horario actual.
            </Text>
            {venues.map((v) => (
              <View key={v.club_id} style={{ marginBottom: 10 }}>
                <Text style={{ color: ui.colors.textPrimary, fontWeight: '600', marginBottom: 6 }}>
                  {v.club_name}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Array.from({ length: v.courts_count }, (_, i) => `Cancha ${i + 1}`).map((court) => (
                    <Pressable
                      key={court}
                      onPress={() => {
                        if (!selected.scheduledAt) {
                          Alert.alert('Sin hora', 'Este partido todavía no tiene horario.');
                          return;
                        }
                        moveMatch.mutate({
                          matchId: selected.id,
                          clubId: v.club_id,
                          courtLabel: court,
                          scheduledAt: selected.scheduledAt,
                        });
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: ui.radius.md,
                        backgroundColor: ui.colors.surface1,
                        borderWidth: 1,
                        borderColor: ui.colors.border,
                      }}
                    >
                      <Text style={{ color: ui.colors.textSecondary, fontSize: 12 }}>{court}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </AppCard>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
