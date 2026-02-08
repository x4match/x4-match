import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function MatchmakingScreen() {
  const router = useRouter();
  const [clubId, setClubId] = useState('');
  const [date, setDate] = useState('');
  const [startHour, setStartHour] = useState('14');
  const [endHour, setEndHour] = useState('16');
  const [minRating, setMinRating] = useState('');
  const [maxRating, setMaxRating] = useState('');

  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/match-requests', data);
      return res.data;
    },
    onSuccess: (data) => {
      Alert.alert('Éxito', 'Solicitud creada. Ejecutando matchmaking...');
      runMatchmakingMutation.mutate(data.id);
    },
  });

  const runMatchmakingMutation = useMutation({
    mutationFn: async (matchRequestId: string) => {
      const res = await api.post(`/match-requests/run/${matchRequestId}`);
      return res.data;
    },
    onSuccess: (match) => {
      Alert.alert('Éxito', '¡Partido creado!', [
        {
          text: 'Ver Partido',
          onPress: () => router.push(`/match/${match.id}`),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo crear el partido');
    },
  });

  const handleSubmit = () => {
    if (!date || !startHour || !endHour) {
      Alert.alert('Error', 'Completa fecha y horarios');
      return;
    }

    const matchDate = new Date(date);
    matchDate.setHours(parseInt(startHour), 0, 0, 0);

    createMutation.mutate({
      clubId: clubId || undefined,
      date: matchDate.toISOString(),
      startHour: parseInt(startHour),
      endHour: parseInt(endHour),
      minRating: minRating ? parseInt(minRating) : undefined,
      maxRating: maxRating ? parseInt(maxRating) : undefined,
    });
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 py-6">
        <Text className="text-2xl font-bold mb-6">Buscar Partido</Text>

        <View className="bg-white rounded-lg p-4 mb-4">
          <Text className="font-semibold mb-2">Club ID (opcional)</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3"
            placeholder="ID del club"
            value={clubId}
            onChangeText={setClubId}
          />
        </View>

        <View className="bg-white rounded-lg p-4 mb-4">
          <Text className="font-semibold mb-2">Fecha</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3"
            placeholder="YYYY-MM-DD"
            value={date}
            onChangeText={setDate}
          />
        </View>

        <View className="bg-white rounded-lg p-4 mb-4">
          <Text className="font-semibold mb-2">Hora Inicio</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3"
            placeholder="14"
            value={startHour}
            onChangeText={setStartHour}
            keyboardType="numeric"
          />
        </View>

        <View className="bg-white rounded-lg p-4 mb-4">
          <Text className="font-semibold mb-2">Hora Fin</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3"
            placeholder="16"
            value={endHour}
            onChangeText={setEndHour}
            keyboardType="numeric"
          />
        </View>

        <View className="bg-white rounded-lg p-4 mb-4">
          <Text className="font-semibold mb-2">Rating Mínimo (opcional)</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3"
            placeholder="1000"
            value={minRating}
            onChangeText={setMinRating}
            keyboardType="numeric"
          />
        </View>

        <View className="bg-white rounded-lg p-4 mb-6">
          <Text className="font-semibold mb-2">Rating Máximo (opcional)</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3"
            placeholder="1300"
            value={maxRating}
            onChangeText={setMaxRating}
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity
          className="bg-amber-500 rounded-lg py-3 px-6"
          onPress={handleSubmit}
          disabled={createMutation.isPending || runMatchmakingMutation.isPending}
        >
          <Text className="text-white text-center font-semibold text-lg">
            {createMutation.isPending || runMatchmakingMutation.isPending
              ? 'Buscando...'
              : 'Buscar Partido'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

