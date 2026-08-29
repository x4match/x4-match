import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, PrimaryButton, EmptyState } from '@/components/padely';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

interface AvailabilitySlot {
  id?: string;
  dayOfWeek: number;
  startHour: number;
  endHour: number;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: ui.radius.sm,
        backgroundColor: active ? ui.colors.primary : ui.colors.card,
        borderWidth: 1,
        borderColor: active ? ui.colors.primary : ui.colors.border,
        marginRight: 8,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : ui.colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AvailabilityScreen() {
  const [availabilities, setAvailabilities] = useState<AvailabilitySlot[]>([]);
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);

  const { data: currentAvailability } = useQuery({
    queryKey: ['my-availability'],
    queryFn: async () => {
      const res = await api.get('/availability/me');
      return res.data;
    },
  });

  useEffect(() => {
    if (currentAvailability) {
      setAvailabilities(
        currentAvailability.map((av: any) => ({
          id: av.id,
          dayOfWeek: av.dayOfWeek,
          startHour: av.startHour,
          endHour: av.endHour,
        })),
      );
    }
  }, [currentAvailability]);

  const saveMutation = useMutation({
    mutationFn: async (data: { availabilities: AvailabilitySlot[] }) => {
      const res = await api.post('/availability', data);
      return res.data;
    },
    onSuccess: () => Alert.alert('Listo', 'Disponibilidad guardada correctamente'),
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'No se pudo guardar la disponibilidad';
      Alert.alert('Error', Array.isArray(message) ? message[0] : message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (slotId: string) => api.delete(`/availability/slot/${slotId}`),
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'No se pudo eliminar el horario';
      Alert.alert('Error', Array.isArray(message) ? message[0] : message);
    },
  });

  const addSlot = () => {
    const usedDays = new Set(availabilities.map((a) => a.dayOfWeek));
    let nextDay = 1;
    for (let d = 1; d <= 6; d++) {
      if (!usedDays.has(d)) {
        nextDay = d;
        break;
      }
    }
    if (usedDays.has(nextDay)) nextDay = usedDays.has(0) ? 1 : 0;
    const newIndex = availabilities.length;
    setAvailabilities([...availabilities, { dayOfWeek: nextDay, startHour: 10, endHour: 18 }]);
    setExpandedSlot(newIndex);
  };

  const updateSlot = (index: number, field: keyof AvailabilitySlot, value: number) => {
    const updated = [...availabilities];
    updated[index] = { ...updated[index], [field]: value };
    setAvailabilities(updated);
  };

  const removeSlot = (index: number) => {
    const slot = availabilities[index];
    Alert.alert('Eliminar horario', `¿Eliminar ${DAYS[slot.dayOfWeek]}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          if (slot.id) deleteMutation.mutate(slot.id);
          setAvailabilities(availabilities.filter((_, i) => i !== index));
          if (expandedSlot === index) setExpandedSlot(null);
        },
      },
    ]);
  };

  const findOverlap = (): string | null => {
    for (let i = 0; i < availabilities.length; i++) {
      for (let j = i + 1; j < availabilities.length; j++) {
        if (
          availabilities[i].dayOfWeek === availabilities[j].dayOfWeek &&
          availabilities[i].startHour < availabilities[j].endHour &&
          availabilities[j].startHour < availabilities[i].endHour
        ) {
          return `Los horarios del ${DAYS[availabilities[i].dayOfWeek]} se solapan`;
        }
      }
    }
    return null;
  };

  const handleSave = () => {
    const overlap = findOverlap();
    if (overlap) {
      Alert.alert('Horarios superpuestos', overlap);
      return;
    }
    saveMutation.mutate({
      availabilities: availabilities.map(({ dayOfWeek, startHour, endHour }) => ({
        dayOfWeek,
        startHour,
        endHour,
      })),
    });
  };

  const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

  const saveButton = (
    <TouchableOpacity onPress={handleSave} disabled={saveMutation.isPending} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      {saveMutation.isPending ? (
        <ActivityIndicator size="small" color={ui.colors.primary} />
      ) : (
        <Text style={{ color: ui.colors.primary, fontWeight: '700', fontSize: 15 }}>Guardar</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <Screen>
      <StackHeader title="Disponibilidad" rightAction={saveButton} />
      <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 14, color: ui.colors.textMuted, marginBottom: ui.spacing.lg }}>
          Configurá los días y horarios en los que podés jugar
        </Text>

        {availabilities.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="calendar-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin horarios configurados"
            description="Agregá tus horarios para que otros jugadores te encuentren"
            action={<PrimaryButton label="Agregar horario" onPress={addSlot} />}
          />
        ) : (
          availabilities.map((slot, index) => {
            const isExpanded = expandedSlot === index;
            return (
              <AppCard key={index} style={{ padding: 0, overflow: 'hidden' }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}
                  onPress={() => setExpandedSlot(isExpanded ? null : index)}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: 'rgba(20,184,166,0.15)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ color: ui.colors.primary, fontWeight: '800', fontSize: 11 }}>
                      {DAYS_SHORT[slot.dayOfWeek]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{DAYS[slot.dayOfWeek]}</Text>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                      {formatHour(slot.startHour)} – {formatHour(slot.endHour)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeSlot(index)} style={{ padding: 8, marginRight: 4 }}>
                    <Ionicons name="trash-outline" size={18} color={ui.colors.danger} />
                  </TouchableOpacity>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={ui.colors.textMuted} />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: ui.colors.border }}>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 12, marginBottom: 8 }}>Día</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row' }}>
                        {DAYS_SHORT.map((day, dayIndex) => (
                          <Chip
                            key={day}
                            label={day}
                            active={slot.dayOfWeek === dayIndex}
                            onPress={() => updateSlot(index, 'dayOfWeek', dayIndex)}
                          />
                        ))}
                      </View>
                    </ScrollView>

                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>Desde</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row' }}>
                        {HOURS.filter((h) => h < slot.endHour).map((hour) => (
                          <Chip
                            key={hour}
                            label={formatHour(hour)}
                            active={slot.startHour === hour}
                            onPress={() => updateSlot(index, 'startHour', hour)}
                          />
                        ))}
                      </View>
                    </ScrollView>

                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>Hasta</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row' }}>
                        {HOURS.filter((h) => h > slot.startHour).map((hour) => (
                          <Chip
                            key={hour}
                            label={formatHour(hour)}
                            active={slot.endHour === hour}
                            onPress={() => updateSlot(index, 'endHour', hour)}
                          />
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}
              </AppCard>
            );
          })
        )}

        {availabilities.length > 0 && (
          <TouchableOpacity
            onPress={addSlot}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              marginTop: 8,
              borderRadius: ui.radius.md,
              borderWidth: 1,
              borderColor: ui.colors.primary,
              borderStyle: 'dashed',
            }}
          >
            <Ionicons name="add-circle-outline" size={22} color={ui.colors.primary} style={{ marginRight: 8 }} />
            <Text style={{ color: ui.colors.primary, fontWeight: '700' }}>Agregar horario</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Screen>
  );
}
