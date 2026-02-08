import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 a 22:00

interface AvailabilitySlot {
  id?: string; // undefined si es nuevo y no se guardó aún
  dayOfWeek: number;
  startHour: number;
  endHour: number;
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
    mutationFn: async (data: any) => {
      const res = await api.post('/availability', data);
      return res.data;
    },
    onSuccess: () => {
      Alert.alert('Listo', 'Disponibilidad guardada correctamente');
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || 'No se pudo guardar la disponibilidad';
      Alert.alert('Error', Array.isArray(message) ? message[0] : message);
    },
  });

  const addSlot = () => {
    // Buscar un día que no tenga horarios aún
    const usedDays = new Set(availabilities.map((a) => a.dayOfWeek));
    let nextDay = 1; // Lunes por defecto
    for (let d = 1; d <= 6; d++) {
      if (!usedDays.has(d)) {
        nextDay = d;
        break;
      }
    }
    if (usedDays.has(nextDay)) {
      // Si todos los días de semana están ocupados, probar domingo
      nextDay = usedDays.has(0) ? 1 : 0;
    }

    const newIndex = availabilities.length;
    setAvailabilities([
      ...availabilities,
      { dayOfWeek: nextDay, startHour: 10, endHour: 18 },
    ]);
    setExpandedSlot(newIndex);
  };

  const updateSlot = (index: number, field: string, value: number) => {
    const updated = [...availabilities];
    updated[index] = { ...updated[index], [field]: value };
    setAvailabilities(updated);
  };

  const deleteMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await api.delete(`/availability/slot/${slotId}`);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || 'No se pudo eliminar el horario';
      Alert.alert('Error', Array.isArray(message) ? message[0] : message);
    },
  });

  const removeSlot = (index: number) => {
    const slot = availabilities[index];
    Alert.alert('Eliminar horario', `¿Eliminar ${DAYS[slot.dayOfWeek]}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          if (slot.id) {
            deleteMutation.mutate(slot.id);
          }
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

    const cleanedAvailabilities = availabilities.map(({ dayOfWeek, startHour, endHour }) => ({
      dayOfWeek,
      startHour,
      endHour,
    }));
    saveMutation.mutate({ availabilities: cleanedAvailabilities });
  };

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: 'Disponibilidad',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saveMutation.isPending}
              style={{ marginRight: 4 }}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-white text-base font-semibold">
                  Guardar
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView className="flex-1 pt-4" showsVerticalScrollIndicator={false}>
        {/* Descripción */}
        <View className="px-5 mb-5">
          <Text className="text-lg font-bold text-gray-900 mb-1">
            Tus horarios
          </Text>
          <Text className="text-sm text-gray-500">
            Configurá los días y horarios en los que podés jugar
          </Text>
        </View>

        {/* Slots de disponibilidad */}
        <View className="px-5">
          {availabilities.length === 0 && (
            <View className="bg-gray-50 rounded-xl px-5 py-8 items-center mb-4">
              <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-3">
                <Ionicons name="calendar-outline" size={28} color="#3B5BDB" />
              </View>
              <Text className="text-base font-semibold text-gray-900 mb-1">
                Sin horarios configurados
              </Text>
              <Text className="text-sm text-gray-500 text-center">
                Agregá tus horarios disponibles para que te encuentren otros jugadores
              </Text>
            </View>
          )}

          {availabilities.map((slot, index) => {
            const isExpanded = expandedSlot === index;

            return (
              <View key={index} className="bg-gray-50 rounded-xl mb-3 overflow-hidden">
                {/* Header del slot (siempre visible) */}
                <TouchableOpacity
                  className="px-4 py-3.5 flex-row items-center justify-between"
                  onPress={() => setExpandedSlot(isExpanded ? null : index)}
                >
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3">
                      <Text className="text-blue-600 font-bold text-xs">
                        {DAYS_SHORT[slot.dayOfWeek]}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-sm font-semibold text-gray-900">
                        {DAYS[slot.dayOfWeek]}
                      </Text>
                      <Text className="text-xs text-gray-500 mt-0.5">
                        {formatHour(slot.startHour)} - {formatHour(slot.endHour)}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center">
                    <TouchableOpacity
                      onPress={() => removeSlot(index)}
                      className="mr-2 p-1"
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#9ca3af"
                    />
                  </View>
                </TouchableOpacity>

                {/* Contenido expandido */}
                {isExpanded && (
                  <View className="px-4 pb-4 pt-1">
                    {/* Selector de día */}
                    <Text className="text-xs text-gray-500 mb-2">Día</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="mb-4"
                    >
                      <View className="flex-row gap-2">
                        {DAYS.map((day, dayIndex) => (
                          <TouchableOpacity
                            key={day}
                            className={`px-3.5 py-2 rounded-lg ${slot.dayOfWeek === dayIndex
                              ? 'bg-blue-600'
                              : 'bg-white'
                              }`}
                            onPress={() => updateSlot(index, 'dayOfWeek', dayIndex)}
                          >
                            <Text
                              className={`text-xs font-medium ${slot.dayOfWeek === dayIndex
                                ? 'text-white'
                                : 'text-gray-700'
                                }`}
                            >
                              {DAYS_SHORT[dayIndex]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Selector de hora inicio */}
                    <Text className="text-xs text-gray-500 mb-2">Desde</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="mb-4"
                    >
                      <View className="flex-row gap-2">
                        {HOURS.filter((h) => h < slot.endHour).map((hour) => (
                          <TouchableOpacity
                            key={hour}
                            className={`px-3 py-2 rounded-lg ${slot.startHour === hour
                              ? 'bg-blue-600'
                              : 'bg-white'
                              }`}
                            onPress={() => updateSlot(index, 'startHour', hour)}
                          >
                            <Text
                              className={`text-xs font-medium ${slot.startHour === hour
                                ? 'text-white'
                                : 'text-gray-700'
                                }`}
                            >
                              {formatHour(hour)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Selector de hora fin */}
                    <Text className="text-xs text-gray-500 mb-2">Hasta</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <View className="flex-row gap-2">
                        {HOURS.filter((h) => h > slot.startHour).map((hour) => (
                          <TouchableOpacity
                            key={hour}
                            className={`px-3 py-2 rounded-lg ${slot.endHour === hour
                              ? 'bg-blue-600'
                              : 'bg-white'
                              }`}
                            onPress={() => updateSlot(index, 'endHour', hour)}
                          >
                            <Text
                              className={`text-xs font-medium ${slot.endHour === hour
                                ? 'text-white'
                                : 'text-gray-700'
                                }`}
                            >
                              {formatHour(hour)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}
              </View>
            );
          })}

          {/* Botón agregar horario */}
          <TouchableOpacity
            className="bg-gray-50 rounded-xl px-4 py-3.5 flex-row items-center justify-center mb-8"
            onPress={addSlot}
          >
            <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center mr-2.5">
              <Ionicons name="add" size={20} color="#3B5BDB" />
            </View>
            <Text className="text-sm font-semibold text-blue-600">
              Agregar horario
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
