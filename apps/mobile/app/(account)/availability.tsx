import { useState, useEffect, type ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, EmptyState, PressableScale } from '@/components/x4match';

const ICON_CALENDAR = require('../../assets/figma/shared/calendar.png');
const ICON_RELOJ = require('../../assets/figma/shared/reloj.png');
const ICON_TRASH = require('../../assets/figma/shared/trash.png');

const CARD_BG = '#111115';
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
        backgroundColor: active ? ui.colors.primary : CARD_BG,
        borderWidth: 1,
        borderColor: active ? ui.colors.primary : ui.colors.border,
        marginRight: 8,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: active ? ui.colors.onPrimary : ui.colors.textPrimary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function AvailabilityCard({
  title,
  subtitle,
  icon,
  featured,
  onPress,
  rightAction,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  featured?: boolean;
  onPress?: () => void;
  rightAction?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: CARD_BG,
        borderRadius: ui.radius.lg,
        borderWidth: 1,
        borderColor: featured ? ui.colors.primary : ui.colors.border,
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      <PressableScale onPress={onPress} disabled={!onPress}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            paddingVertical: 18,
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: ui.colors.surface0,
              borderWidth: featured ? 1 : 0,
              borderColor: featured ? ui.colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: ui.colors.textPrimary,
                letterSpacing: -0.2,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 18,
                color: ui.colors.textSecondary,
                marginTop: 4,
              }}
            >
              {subtitle}
            </Text>
          </View>
          {rightAction}
        </View>
      </PressableScale>
      {children}
    </View>
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
    <TouchableOpacity
      onPress={handleSave}
      disabled={saveMutation.isPending}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
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
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 15,
            color: ui.colors.textSecondary,
            marginBottom: 22,
            lineHeight: 22,
          }}
        >
          Configurá los días y horarios en los que podés jugar.
        </Text>

        {availabilities.length === 0 ? (
          <EmptyState
            icon={
              <Image
                source={ICON_CALENDAR}
                style={{ width: 36, height: 36 }}
                resizeMode="contain"
              />
            }
            title="Sin horarios configurados"
            description="Agregá tus franjas para que el matchmaking automático te encuentre."
          />
        ) : (
          availabilities.map((slot, index) => {
            const isExpanded = expandedSlot === index;
            return (
              <AvailabilityCard
                key={slot.id ?? `slot-${index}`}
                title={DAYS[slot.dayOfWeek]}
                subtitle={`${formatHour(slot.startHour)} – ${formatHour(slot.endHour)}`}
                featured={isExpanded}
                onPress={() => setExpandedSlot(isExpanded ? null : index)}
                icon={
                  <Image
                    source={ICON_RELOJ}
                    style={{ width: 22, height: 22 }}
                    resizeMode="contain"
                  />
                }
                rightAction={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TouchableOpacity
                      onPress={() => removeSlot(index)}
                      hitSlop={8}
                      style={{ padding: 6 }}
                      accessibilityLabel="Eliminar horario"
                    >
                      <Image
                        source={ICON_TRASH}
                        style={{ width: 18, height: 18 }}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={ui.colors.textMuted}
                    />
                  </View>
                }
              >
                {isExpanded ? (
                  <View
                    style={{
                      paddingHorizontal: 16,
                      paddingBottom: 16,
                      borderTopWidth: 1,
                      borderTopColor: ui.colors.border,
                      zIndex: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: ui.colors.textSecondary,
                        marginTop: 14,
                        marginBottom: 8,
                      }}
                    >
                      Día
                    </Text>
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

                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>
                      Desde
                    </Text>
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

                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>
                      Hasta
                    </Text>
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
                ) : null}
              </AvailabilityCard>
            );
          })
        )}

        <PressableScale
          onPress={addSlot}
          accessibilityRole="button"
          accessibilityLabel="Agregar horario"
          style={{
            alignSelf: 'center',
            marginTop: availabilities.length === 0 ? 8 : 4,
            marginBottom: 8,
            backgroundColor: ui.colors.primary,
            borderRadius: ui.radius.pill,
            paddingVertical: 14,
            paddingHorizontal: 36,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: ui.colors.onPrimary,
              textAlign: 'center',
            }}
          >
            Agregar horario
          </Text>
        </PressableScale>

        <View style={{ marginTop: 12, paddingVertical: 4 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: ui.colors.textSecondary,
              marginBottom: 6,
            }}
          >
            Matchmaking automático
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: ui.colors.textMuted,
            }}
          >
            Armamos un partido con jugadores disponibles en tu franja.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
