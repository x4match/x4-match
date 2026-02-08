import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function SubmitResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [teamAScore, setTeamAScore] = useState('');
  const [teamBScore, setTeamBScore] = useState('');

  const submitMutation = useMutation({
    mutationFn: async (data: { teamAScore: number; teamBScore: number }) => {
      const res = await api.post(`/matches/${id}/result`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] });
      Alert.alert('Éxito', 'Resultado cargado correctamente', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Error al cargar resultado');
    },
  });

  const handleSubmit = () => {
    const scoreA = parseInt(teamAScore);
    const scoreB = parseInt(teamBScore);

    if (isNaN(scoreA) || isNaN(scoreB)) {
      Alert.alert('Error', 'Ingresa puntajes válidos');
      return;
    }

    submitMutation.mutate({ teamAScore: scoreA, teamBScore: scoreB });
  };

  return (
    <View className="flex-1 bg-gray-50 px-4 py-6">
      <Text className="text-2xl font-bold mb-6">Cargar Resultado</Text>

      <View className="bg-white rounded-lg p-4 mb-4">
        <Text className="font-semibold mb-2">Equipo A</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 text-2xl text-center"
          placeholder="0"
          value={teamAScore}
          onChangeText={setTeamAScore}
          keyboardType="numeric"
        />
      </View>

      <View className="bg-white rounded-lg p-4 mb-6">
        <Text className="font-semibold mb-2">Equipo B</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 text-2xl text-center"
          placeholder="0"
          value={teamBScore}
          onChangeText={setTeamBScore}
          keyboardType="numeric"
        />
      </View>

      <TouchableOpacity
        className="bg-amber-500 rounded-lg py-3 px-6"
        onPress={handleSubmit}
        disabled={submitMutation.isPending}
      >
        <Text className="text-white text-center font-semibold text-lg">
          {submitMutation.isPending ? 'Cargando...' : 'Cargar Resultado'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

