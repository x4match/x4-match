import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: async () => {
      const res = await api.get(`/matches/${id}`);
      return res.data;
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/matches/${id}/confirm`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] });
      Alert.alert('Éxito', 'Partido confirmado');
    },
  });

  const isParticipant = match?.participants?.some((p: any) => p.userId === user?.id);
  const hasConfirmed = match?.participants?.find(
    (p: any) => p.userId === user?.id
  )?.confirmedAt;

  useEffect(() => {
    if (!match || !isParticipant) return;

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

    const socket = io(API_URL, {
      auth: {
        token: user?.token,
      },
    });

    socket.emit('join_match', { matchId: id });

    socket.on('new_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.disconnect();
    };
  }, [match, isParticipant, id, user?.token]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Cargando...</Text>
      </View>
    );
  }

  if (!match) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Partido no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 py-6">
        <Text className="text-2xl font-bold mb-4">
          {new Date(match.date).toLocaleDateString()}
        </Text>
        <Text className="text-gray-600 mb-4">
          {match.startHour}:00 - {match.endHour}:00
        </Text>
        {match.club && (
          <Text className="text-gray-600 mb-4">{match.club.name}</Text>
        )}

        <View className="bg-white rounded-lg p-4 mb-4">
          <Text className="font-semibold mb-2">Equipo A</Text>
          {match.participants
            ?.filter((p: any) => p.team === 'A')
            .map((p: any) => (
              <Text key={p.id} className="text-gray-600">
                {p.user.name} {p.confirmedAt ? '✓' : ''}
              </Text>
            ))}
        </View>

        <View className="bg-white rounded-lg p-4 mb-4">
          <Text className="font-semibold mb-2">Equipo B</Text>
          {match.participants
            ?.filter((p: any) => p.team === 'B')
            .map((p: any) => (
              <Text key={p.id} className="text-gray-600">
                {p.user.name} {p.confirmedAt ? '✓' : ''}
              </Text>
            ))}
        </View>

        {isParticipant && !hasConfirmed && match.status === 'PENDING' && (
          <TouchableOpacity
            className="bg-green-600 rounded-lg py-3 px-6 mb-4"
            onPress={() => confirmMutation.mutate()}
          >
            <Text className="text-white text-center font-semibold">
              Confirmar Asistencia
            </Text>
          </TouchableOpacity>
        )}

        {isParticipant && match.status === 'CONFIRMED' && !match.result && (
          <TouchableOpacity
            className="bg-amber-500 rounded-lg py-3 px-6 mb-4"
            onPress={() => router.push(`/match/${id}/result` as any)}
          >
            <Text className="text-white text-center font-semibold">
              Cargar Resultado
            </Text>
          </TouchableOpacity>
        )}

        {match.result && (
          <View className="bg-white rounded-lg p-4 mb-4">
            <Text className="font-semibold text-lg mb-2">Resultado Final</Text>
            <Text className="text-2xl font-bold">
              Equipo A: {match.result.teamAScore} - Equipo B: {match.result.teamBScore}
            </Text>
          </View>
        )}

        {isParticipant && (
          <View className="bg-white rounded-lg p-4">
            <Text className="font-semibold mb-2">Chat del Partido</Text>
            <ScrollView className="max-h-48 mb-2">
              {messages.map((msg, idx) => (
                <View key={idx} className="mb-2">
                  <Text className="font-semibold">{msg.user?.name}</Text>
                  <Text>{msg.content}</Text>
                </View>
              ))}
            </ScrollView>
            <View className="flex-row">
              <TextInput
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 mr-2"
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Escribe un mensaje..."
              />
              <TouchableOpacity
                className="bg-amber-500 rounded-lg px-4 py-2"
                onPress={() => {
                  if (messageText.trim()) {
                    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
                    const socket = io(API_URL, {
                      auth: { token: user?.token },
                    });
                    socket.emit('send_message', {
                      matchId: id,
                      content: messageText,
                    });
                    setMessageText('');
                  }
                }}
              >
                <Text className="text-white">Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

