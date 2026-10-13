import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import { useAuth } from '@/contexts/AuthContext';
import { Screen, StackHeader, AppCard, PrimaryButton, SectionHeader } from '@/components/x4match';
import { PlayerSearchField, type PickedPlayer } from '@/components/challenge/PlayerSearchField';

export default function CreateChallengeScreen() {
  const { targetUserId: presetTargetUserId } = useLocalSearchParams<{ targetUserId?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [rival, setRival] = useState<PickedPlayer | null>(null);
  const [partner, setPartner] = useState<PickedPlayer | null>(null);

  const { data: presetRival } = useQuery({
    queryKey: ['challenge-preset-rival', presetTargetUserId],
    queryFn: async () => {
      const res = await api.get(`/players/${presetTargetUserId}`);
      const row = res.data as Record<string, any>;
      return {
        userId: String(row.user_id ?? row.userId ?? presetTargetUserId),
        name: String(row.name ?? 'Jugador'),
        nickname: row.nickname ?? null,
        photo: row.photo_url ?? row.photo ?? null,
        city: row.city ?? null,
      } satisfies PickedPlayer;
    },
    enabled: !!presetTargetUserId,
  });

  useEffect(() => {
    if (presetRival) setRival((current) => current ?? presetRival);
  }, [presetRival]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/challenges', {
        challengedUserId: rival?.userId,
        ...(partner ? { partnerUserId: partner.userId } : {}),
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['challenges-me'] });
      Alert.alert('Desafío enviado', 'El rival tiene 72 h para aceptar.');
      router.replace(`/challenge/${data.id}` as any);
    },
    onError: (err: any) =>
      Alert.alert('Error', err?.response?.data?.message || 'No se pudo crear el desafío'),
  });

  const rivalName = rival?.name ?? null;

  return (
    <Screen>
      <StackHeader title="Desafío" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <SectionHeader title="Rival" />
        <PlayerSearchField
          value={rival}
          onChange={setRival}
          excludeUserIds={[user?.id, partner?.userId]}
          placeholder="Buscá a quién desafiar"
        />

        <SectionHeader title="Compañero" subtitle="Opcional" />
        <PlayerSearchField
          value={partner}
          onChange={setPartner}
          excludeUserIds={[user?.id, rival?.userId]}
          placeholder="Sumá un compañero (opcional)"
        />

        {rival ? (
          <AppCard style={{ marginTop: 8, marginBottom: 16 }}>
            <Text style={{ color: ui.colors.textPrimary, fontWeight: '700' }}>
              {partner
                ? `Vos y ${partner.name} contra ${rivalName} y compañero`
                : `Vos contra ${rivalName}`}
            </Text>
            <Text style={{ color: ui.colors.textMuted, marginTop: 4, fontSize: 13 }}>
              {partner ? 'Desafío 2 vs 2' : 'Desafío 1 vs 1'}
            </Text>
          </AppCard>
        ) : null}

        <PrimaryButton
          label="Enviar desafío"
          fullWidth
          size="lg"
          disabled={!rival}
          loading={createMutation.isPending}
          onPress={() => createMutation.mutate()}
          icon={<Ionicons name="flash" size={18} color={ui.colors.onPrimary} />}
        />
      </ScrollView>
    </Screen>
  );
}
