import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { mapMatch } from '@/lib/mappers';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, MatchResultComposer } from '@/components/padely';
import { useAuth } from '@/contexts/AuthContext';
import type { PlayerMatchRating, SetScore } from '@/lib/types';

export default function SubmitResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: matchRaw } = useQuery({
    queryKey: ['match', id],
    queryFn: async () => {
      const res = await api.get(`/matches/${id}`);
      return res.data;
    },
  });
  const match = matchRaw ? mapMatch(matchRaw) : null;

  const submitMutation = useMutation({
    mutationFn: async ({ sets, playerRatings }: { sets: SetScore[]; playerRatings: PlayerMatchRating[] }) => {
      const res = await api.post(`/matches/${id}/result`, {
        sets,
        playerRatings: playerRatings.length ? playerRatings : undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] });
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
      Alert.alert(
        'Resultado propuesto',
        'Los demás jugadores tienen 48 horas para confirmar. Si no hay acuerdo, el partido cierra sin puntos y podrás dejar reseñas a tus rivales.',
        [{ text: 'OK', onPress: () => router.replace(`/match/${id}` as any) }],
      );
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message;
      Alert.alert(
        'Error',
        Array.isArray(msg) ? msg.join('\n') : msg || error.message || 'Error al cargar resultado',
      );
    },
  });

  return (
    <Screen>
      <StackHeader title="Cargar resultado" />
      <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }}>
        {match ? (
          <MatchResultComposer
            players={match.players.map((p) => ({ id: p.id, name: p.name, photo: p.photo }))}
            currentUserId={user?.id}
            initialSets={match.result?.sets}
            title={match.result?.score ? 'Actualizar resultado' : 'Completar resultado'}
            subtitle="Cargá el marcador final y, si querés, dejá reseñas opcionales a los jugadores que elijas."
            submitLabel={match.result?.score ? 'Guardar cambios' : 'Proponer resultado'}
            submitVariant="primary"
            loading={submitMutation.isPending}
            onSubmit={(payload) => submitMutation.mutate(payload)}
          />
        ) : (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
            <Text style={{ color: ui.colors.textMuted }}>Cargando partido...</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
