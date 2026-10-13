import { useState } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { buildChallengeShareMessage } from '@/lib/match/match-share';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  Avatar,
  PrimaryButton,
  SectionHeader,
  SkeletonCard,
} from '@/components/x4match';
import { PlayerSearchField, type PickedPlayer } from '@/components/challenge/PlayerSearchField';

type ChallengePlayer = {
  userId: string;
  name: string;
  nickname?: string;
  photo?: string;
  position?: string;
};

type Challenge = {
  id: string;
  status: string;
  format?: 'SINGLES' | 'DOUBLES';
  matchId?: string | null;
  viewerRole?: string | null;
  challengerClub?: { id: string; name: string } | null;
  challengedClub?: { id: string; name: string } | null;
  challengerAnchor?: ChallengePlayer | null;
  challengerPartner?: ChallengePlayer | null;
  challengedAnchor?: ChallengePlayer | null;
  challengedPartner?: ChallengePlayer | null;
  winnerClubId?: string | null;
  expiresAt?: string;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_OPPONENT: 'Esperando respuesta',
  ACCEPTED: 'Aceptado',
  SCHEDULED: 'Partido armado',
  COMPLETED: 'Finalizado',
  DECLINED: 'Rechazado',
  EXPIRED: 'Vencido',
  CANCELLED: 'Cancelado',
};

function playerName(player?: ChallengePlayer | null) {
  return player?.name ?? null;
}

function teamName(anchor?: ChallengePlayer | null, partner?: ChallengePlayer | null) {
  return [playerName(anchor), playerName(partner)].filter(Boolean).join(' y ') || 'Jugador';
}

function PlayerRow({ label, player }: { label: string; player?: ChallengePlayer | null }) {
  if (!player) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <Avatar name={player.name} photo={player.photo} size="sm" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>{label}</Text>
        <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
          {player.name}
        </Text>
      </View>
    </View>
  );
}

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [partner, setPartner] = useState<PickedPlayer | null>(null);

  const { data: challenge, isLoading, refetch } = useQuery({
    queryKey: ['challenge', id],
    queryFn: async () => {
      const res = await api.get(`/challenges/${id}`);
      return res.data as Challenge;
    },
    enabled: !!id,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(
        `/challenges/${id}/accept`,
        partner ? { partnerUserId: partner.userId } : {},
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenge', id] });
      queryClient.invalidateQueries({ queryKey: ['challenges-me'] });
      Alert.alert('Desafío aceptado', 'Ya está el partido armado.');
      refetch();
    },
    onError: (err: any) =>
      Alert.alert('Error', err?.response?.data?.message || 'No se pudo aceptar'),
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/challenges/${id}/decline`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges-me'] });
      refetch();
      Alert.alert('Rechazado', 'Le avisamos a tu rival.');
    },
    onError: (err: any) =>
      Alert.alert('Error', err?.response?.data?.message || 'No se pudo rechazar'),
  });

  if (isLoading || !challenge) {
    return (
      <Screen>
        <StackHeader title="Desafío" />
        <View style={{ padding: 16 }}>
          <SkeletonCard />
        </View>
      </Screen>
    );
  }

  const isDoubles = challenge.format
    ? challenge.format === 'DOUBLES'
    : !!challenge.challengerPartner;
  const challengerTeam = teamName(challenge.challengerAnchor, challenge.challengerPartner);
  const challengedTeam = teamName(challenge.challengedAnchor, challenge.challengedPartner);
  const canAccept =
    challenge.viewerRole === 'challenged_anchor' && challenge.status === 'PENDING_OPPONENT';
  const statusLabel = STATUS_LABELS[challenge.status] ?? challenge.status.replace(/_/g, ' ');

  const shareChallenge = async () => {
    const winnerName =
      challenge.winnerClubId && challenge.winnerClubId === challenge.challengerClub?.id
        ? challenge.challengerClub?.name
        : challenge.winnerClubId && challenge.winnerClubId === challenge.challengedClub?.id
          ? challenge.challengedClub?.name
          : null;
    try {
      await Share.share({
        message: buildChallengeShareMessage({
          challengeId: challenge.id,
          challengerName: challengerTeam,
          challengedName: challengedTeam,
          status: statusLabel,
          winnerName,
        }),
        title: 'Desafío',
      });
    } catch {
      // cancel
    }
  };

  return (
    <Screen>
      <StackHeader title="Desafío" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <AppCard style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: '800', fontSize: 18, color: ui.colors.textPrimary }}>
            {challengerTeam} vs {challengedTeam}
          </Text>
          <Text style={{ marginTop: 6, color: ui.colors.textSecondary }}>
            {isDoubles ? '2 vs 2' : '1 vs 1'} · {statusLabel}
          </Text>
        </AppCard>

        <SectionHeader title="Desafiante" subtitle={challenge.challengerClub?.name} />
        <AppCard style={{ marginBottom: 12 }}>
          <PlayerRow label="Jugador" player={challenge.challengerAnchor} />
          <PlayerRow label="Compañero" player={challenge.challengerPartner} />
        </AppCard>

        <SectionHeader title="Desafiado" subtitle={challenge.challengedClub?.name} />
        <AppCard style={{ marginBottom: 12 }}>
          <PlayerRow label="Jugador" player={challenge.challengedAnchor} />
          <PlayerRow label="Compañero" player={challenge.challengedPartner} />
        </AppCard>

        {canAccept ? (
          <>
            {isDoubles ? (
              <>
                <SectionHeader title="Elegí tu compañero" subtitle="Es un 2 vs 2" />
                <PlayerSearchField
                  value={partner}
                  onChange={setPartner}
                  excludeUserIds={[
                    challenge.challengerAnchor?.userId,
                    challenge.challengerPartner?.userId,
                    challenge.challengedAnchor?.userId,
                  ]}
                  placeholder="Buscá a tu compañero"
                />
              </>
            ) : null}
            <PrimaryButton
              label="Aceptar desafío"
              fullWidth
              disabled={isDoubles && !partner}
              loading={acceptMutation.isPending}
              onPress={() => acceptMutation.mutate()}
              style={{ marginBottom: 8 }}
            />
            <PrimaryButton
              label="Rechazar"
              fullWidth
              variant="outline"
              loading={declineMutation.isPending}
              onPress={() => declineMutation.mutate()}
              style={{ marginBottom: 12 }}
            />
          </>
        ) : null}

        {challenge.matchId ? (
          <PrimaryButton
            label="Ver partido"
            fullWidth
            onPress={() => router.push(`/match/${challenge.matchId}` as any)}
            style={{ marginBottom: 8 }}
            icon={<Ionicons name="tennisball-outline" size={18} color={ui.colors.onPrimary} />}
          />
        ) : null}

        <PrimaryButton
          label="Compartir en redes"
          fullWidth
          variant="outline"
          onPress={shareChallenge}
          icon={<Ionicons name="share-social-outline" size={18} color={ui.colors.primary} />}
        />
      </ScrollView>
    </Screen>
  );
}
