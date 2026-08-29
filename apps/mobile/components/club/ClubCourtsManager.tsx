import { useMemo, useState } from 'react';
import { View, Text, Switch, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import {
  AppCard,
  EmptyState,
  InputField,
  PrimaryButton,
  SectionHeader,
  SelectionChip,
} from '@/components/padely';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SLOT_START_MINUTES = 8 * 60;
const SLOT_END_MINUTES = 24 * 60;
const SLOT_STEP_MINUTES = 30;
const TIME_SLOTS = Array.from(
  { length: (SLOT_END_MINUTES - SLOT_START_MINUTES) / SLOT_STEP_MINUTES + 1 },
  (_, i) => SLOT_START_MINUTES + i * SLOT_STEP_MINUTES,
);

export interface ClubCourt {
  id: string;
  name: string;
  active: boolean;
  has_fixed_schedule: boolean;
  sort_order: number;
  schedules_count?: number;
}

interface CourtSchedule {
  id: string;
  day_of_week: number;
  start_hour: number;
  end_hour: number;
  active: boolean;
}

function formatSlotTime(value: number, fromApiHour = false) {
  const minutes = fromApiHour ? Math.round(value * 60) : value;
  if (minutes >= SLOT_END_MINUTES) return '00:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function minutesToApiHour(minutes: number) {
  return minutes / 60;
}

interface Props {
  clubId: string;
  clubName?: string;
}

export function ClubCourtsManager({ clubId, clubName }: Props) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [expandedCourtId, setExpandedCourtId] = useState<string | null>(null);

  const [schedDay, setSchedDay] = useState(1);
  const [schedStart, setSchedStart] = useState(9 * 60);
  const [schedEnd, setSchedEnd] = useState(22 * 60);

  const { data: courts, isLoading } = useQuery({
    queryKey: ['club-courts', clubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${clubId}/courts`);
      return res.data as ClubCourt[];
    },
    enabled: !!clubId,
  });

  const { data: schedules, isLoading: loadingSchedules } = useQuery({
    queryKey: ['club-court-schedules', clubId, expandedCourtId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${clubId}/courts/${expandedCourtId}/schedules`);
      return res.data as CourtSchedule[];
    },
    enabled: !!clubId && !!expandedCourtId,
  });

  const invalidateCourts = () => {
    queryClient.invalidateQueries({ queryKey: ['club-courts', clubId] });
    queryClient.invalidateQueries({ queryKey: ['court-slots', clubId] });
  };

  const createCourt = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/clubs/${clubId}/courts`, {
        name: newName.trim() || 'Cancha 1',
        active: true,
      });
      return res.data as ClubCourt;
    },
    onSuccess: (court) => {
      setNewName('');
      setShowAdd(false);
      setExpandedCourtId(court.id);
      invalidateCourts();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo crear la cancha');
    },
  });

  const updateCourt = useMutation({
    mutationFn: async (payload: { courtId: string; active?: boolean; hasFixedSchedule?: boolean }) => {
      const res = await api.patch(`/clubs/${clubId}/courts/${payload.courtId}`, {
        active: payload.active,
        hasFixedSchedule: payload.hasFixedSchedule,
      });
      return res.data as ClubCourt;
    },
    onSuccess: () => invalidateCourts(),
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo actualizar');
      invalidateCourts();
    },
  });

  const deleteCourt = useMutation({
    mutationFn: async (courtId: string) => {
      await api.delete(`/clubs/${clubId}/courts/${courtId}`);
    },
    onSuccess: (_, courtId) => {
      if (expandedCourtId === courtId) setExpandedCourtId(null);
      invalidateCourts();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo eliminar');
    },
  });

  const createSchedule = useMutation({
    mutationFn: async () => {
      if (!expandedCourtId) return;
      await api.post(`/clubs/${clubId}/courts/${expandedCourtId}/schedules`, {
        dayOfWeek: schedDay,
        startHour: minutesToApiHour(schedStart),
        endHour: minutesToApiHour(schedEnd),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-court-schedules', clubId, expandedCourtId] });
      invalidateCourts();
      Alert.alert('Listo', 'Horario fijo agregado');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo guardar el horario');
    },
  });

  const deleteSchedule = useMutation({
    mutationFn: async (scheduleId: string) => {
      if (!expandedCourtId) return;
      await api.delete(`/clubs/${clubId}/courts/${expandedCourtId}/schedules/${scheduleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-court-schedules', clubId, expandedCourtId] });
      invalidateCourts();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo eliminar');
    },
  });

  const generateSlots = useMutation({
    mutationFn: async (courtId: string) => {
      const res = await api.post(`/clubs/${clubId}/courts/${courtId}/generate-slots`, {
        daysAhead: 7,
      });
      return res.data as { created: number; skipped: number; daysAhead: number };
    },
    onSuccess: (data) => {
      invalidateCourts();
      Alert.alert(
        'Turnos generados',
        `Se crearon ${data.created} turnos para los próximos ${data.daysAhead} días` +
          (data.skipped ? ` (${data.skipped} ya existían).` : '.'),
      );
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudieron generar los turnos');
    },
  });

  const activeSchedules = useMemo(
    () => (schedules || []).filter((s) => s.active !== false),
    [schedules],
  );

  const handleToggleActive = (court: ClubCourt, active: boolean) => {
    if (!active) {
      Alert.alert(
        'Deshabilitar cancha',
        `¿Deshabilitar "${court.name}"? Se cancelarán los turnos abiertos futuros.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Deshabilitar',
            style: 'destructive',
            onPress: () => updateCourt.mutate({ courtId: court.id, active: false }),
          },
        ],
      );
      return;
    }
    updateCourt.mutate({ courtId: court.id, active: true });
  };

  const handleDeleteCourt = (court: ClubCourt) => {
    Alert.alert('Eliminar cancha', `¿Eliminar "${court.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => deleteCourt.mutate(court.id),
      },
    ]);
  };

  return (
    <View>
      <SectionHeader
        title="Canchas"
        subtitle={clubName ? `${clubName} · habilitación y horarios fijos` : 'Habilitación y horarios fijos'}
      />

      {showAdd ? (
        <AppCard style={{ marginBottom: 16 }}>
          <InputField
            label="Nombre"
            value={newName}
            onChangeText={setNewName}
            placeholder="Cancha 1"
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <SelectionChip
                label="Cancelar"
                selected={false}
                onPress={() => {
                  setShowAdd(false);
                  setNewName('');
                }}
                flex
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Crear"
                fullWidth
                loading={createCourt.isPending}
                onPress={() => createCourt.mutate()}
              />
            </View>
          </View>
        </AppCard>
      ) : (
        <PrimaryButton
          label="Agregar cancha"
          variant="outline"
          fullWidth
          onPress={() => setShowAdd(true)}
          style={{ marginBottom: 16 }}
          icon={<Ionicons name="add" size={18} color={ui.colors.primary} />}
        />
      )}

      {isLoading ? (
        <Text style={{ color: ui.colors.textMuted }}>Cargando canchas...</Text>
      ) : !courts?.length ? (
        <EmptyState
          icon={<Ionicons name="tennisball-outline" size={32} color={ui.colors.textMuted} />}
          title="Sin canchas"
          description="Agregá las canchas del club para habilitarlas y definir horarios fijos."
        />
      ) : (
        courts.map((court) => {
          const expanded = expandedCourtId === court.id;
          return (
            <AppCard key={court.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  onPress={() => setExpandedCourtId(expanded ? null : court.id)}
                >
                  <Ionicons
                    name={court.active ? 'tennisball' : 'tennisball-outline'}
                    size={22}
                    color={court.active ? ui.colors.primary : ui.colors.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontWeight: '700',
                        color: court.active ? ui.colors.textPrimary : ui.colors.textMuted,
                      }}
                    >
                      {court.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                      {court.active ? 'Habilitada' : 'Deshabilitada'}
                      {court.has_fixed_schedule
                        ? ` · ${court.schedules_count ?? 0} horario${(court.schedules_count ?? 0) === 1 ? '' : 's'} fijo${(court.schedules_count ?? 0) === 1 ? '' : 's'}`
                        : ' · sin horario fijo'}
                    </Text>
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={ui.colors.textMuted}
                  />
                </TouchableOpacity>
                <Switch
                  value={court.active}
                  onValueChange={(v) => handleToggleActive(court, v)}
                />
              </View>

              {expanded && (
                <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: ui.colors.border, paddingTop: 14 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 14,
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>Horario fijo</Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                        Franjas semanales recurrentes de esta cancha
                      </Text>
                    </View>
                    <Switch
                      value={court.has_fixed_schedule}
                      onValueChange={(v) =>
                        updateCourt.mutate({ courtId: court.id, hasFixedSchedule: v })
                      }
                    />
                  </View>

                  {court.has_fixed_schedule && (
                    <>
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>
                        Día
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {WEEKDAYS.map((d, i) => (
                            <SelectionChip
                              key={d}
                              label={d}
                              selected={schedDay === i}
                              onPress={() => setSchedDay(i)}
                            />
                          ))}
                        </View>
                      </ScrollView>

                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>
                        Desde
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {TIME_SLOTS.filter((m) => m < schedEnd).map((minutes) => (
                            <SelectionChip
                              key={`s-${minutes}`}
                              label={formatSlotTime(minutes)}
                              selected={schedStart === minutes}
                              onPress={() => setSchedStart(minutes)}
                            />
                          ))}
                        </View>
                      </ScrollView>

                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>
                        Hasta
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {TIME_SLOTS.filter((m) => m > schedStart).map((minutes) => (
                            <SelectionChip
                              key={`e-${minutes}`}
                              label={formatSlotTime(minutes)}
                              selected={schedEnd === minutes}
                              onPress={() => setSchedEnd(minutes)}
                            />
                          ))}
                        </View>
                      </ScrollView>

                      <PrimaryButton
                        label="Agregar franja"
                        size="sm"
                        fullWidth
                        loading={createSchedule.isPending}
                        onPress={() => createSchedule.mutate()}
                        style={{ marginBottom: 12 }}
                      />

                      {loadingSchedules ? (
                        <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando...</Text>
                      ) : activeSchedules.length === 0 ? (
                        <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                          Todavía no hay franjas fijas.
                        </Text>
                      ) : (
                        <View style={{ marginBottom: 12, gap: 8 }}>
                          {activeSchedules.map((s) => (
                            <View
                              key={s.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: ui.colors.surfaceAlt,
                                borderRadius: 10,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                              }}
                            >
                              <Text style={{ color: ui.colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                                {WEEKDAYS[s.day_of_week]} · {formatSlotTime(s.start_hour, true)}–
                                {formatSlotTime(s.end_hour, true)}
                              </Text>
                              <TouchableOpacity onPress={() => deleteSchedule.mutate(s.id)}>
                                <Ionicons name="trash-outline" size={18} color={ui.colors.danger} />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}

                      <PrimaryButton
                        label="Generar turnos (7 días)"
                        variant="outline"
                        size="sm"
                        fullWidth
                        loading={generateSlots.isPending}
                        disabled={!activeSchedules.length}
                        onPress={() => generateSlots.mutate(court.id)}
                        style={{ marginBottom: 8 }}
                        icon={<Ionicons name="calendar-outline" size={16} color={ui.colors.primary} />}
                      />
                    </>
                  )}

                  <TouchableOpacity
                    onPress={() => handleDeleteCourt(court)}
                    style={{ marginTop: 8, alignSelf: 'flex-start', paddingVertical: 6 }}
                  >
                    <Text style={{ color: ui.colors.danger, fontWeight: '600', fontSize: 13 }}>
                      Eliminar cancha
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </AppCard>
          );
        })
      )}
    </View>
  );
}
