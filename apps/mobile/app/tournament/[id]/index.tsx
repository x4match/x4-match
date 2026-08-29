import { View, Text, ScrollView, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { canOrganizeEvents } from '@/lib/roles';
import {
  fetchTournamentDetail,
  fetchRegistrations,
  fetchMatches,
  fetchStandings,
  formatScore,
  joinTournamentByInviteToken,
} from '@/lib/tournament/api';
import {
  formatLabel,
  formatTournamentCategory,
  tournamentPrice,
  modalityLabel,
  clubValidationLabel,
} from '@/lib/tournament/types';
import { getTournamentFlyer } from '@/lib/tournament-flyer';
import { formatFullDate, formatShortDate, formatTime, formatCurrency } from '@/lib/format';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  SectionHeader,
  StatusPill,
  PrimaryButton,
  EmptyState,
  Avatar,
  Sheet,
} from '@/components/padely';
import type { TournamentRegistration } from '@/lib/tournament/types';

type Tab = 'info' | 'teams' | 'fixture';

function PlayerRow({
  name,
  photo,
  email,
  userId,
  onPressProfile,
}: {
  name: string;
  photo?: string | null;
  email?: string | null;
  userId?: string | null;
  onPressProfile?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <Avatar name={name} photo={photo} size="md" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{name}</Text>
        {email ? (
          <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {email}
          </Text>
        ) : null}
      </View>
      {userId && onPressProfile ? (
        <PrimaryButton label="Ver" size="sm" variant="ghost" onPress={onPressProfile} />
      ) : null}
    </View>
  );
}

export default function TournamentDetailScreen() {
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('info');
  const [selectedReg, setSelectedReg] = useState<TournamentRegistration | null>(null);
  const inviteToken = typeof invite === 'string' ? invite : undefined;

  const { data: tournament, isLoading, refetch, error } = useQuery({
    queryKey: ['tournament-detail', id, inviteToken],
    queryFn: () => fetchTournamentDetail(id!, inviteToken),
    enabled: !!id,
    retry: false,
  });

  useQuery({
    queryKey: ['tournament-join-invite', inviteToken],
    queryFn: () => joinTournamentByInviteToken(inviteToken!),
    enabled: !!inviteToken && !!user?.id,
    retry: false,
  });

  const canManage =
    !!user?.id &&
    canOrganizeEvents(user.role) &&
    (!tournament ||
      tournament.organizer_user_id === user.id ||
      user.role === 'SUPER_ADMIN' ||
      user.role === 'CLUB_ADMIN');
  const isOwnerOrganizer = !!user?.id && tournament?.organizer_user_id === user.id;

  const { data: registrations, refetch: refetchRegs } = useQuery({
    queryKey: ['tournament-registrations', id],
    queryFn: () => fetchRegistrations(id!),
    enabled: !!id,
  });

  const { data: matches } = useQuery({
    queryKey: ['tournament-matches', id],
    queryFn: () => fetchMatches(id!),
    enabled: !!id && tab === 'fixture',
  });

  const { data: standings } = useQuery({
    queryKey: ['tournament-standings', id],
    queryFn: () => fetchStandings(id!),
    enabled: !!id && tab === 'fixture',
  });

  const onRefresh = useCallback(() => {
    refetch();
    refetchRegs();
  }, [refetch, refetchRegs]);

  if (error && !tournament) {
    return (
      <Screen>
        <StackHeader title="Torneo" />
        <EmptyState
          icon={<Ionicons name="lock-closed-outline" size={32} color={ui.colors.textMuted} />}
          title="Torneo no disponible"
          description="Este torneo es privado o todavía no fue publicado. Pedile el link de invitación al organizador."
        />
      </Screen>
    );
  }

  if (isLoading || !tournament) {
    return (
      <Screen>
        <StackHeader title="Torneo" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: ui.colors.textMuted }}>Cargando...</Text>
        </View>
      </Screen>
    );
  }

  const approved = (registrations || []).filter((r) => r.status === 'APPROVED');
  const pending = (registrations || []).filter((r) => r.status === 'PENDING');
  const price = tournamentPrice(tournament);
  const registrationOpen =
    tournament.status === 'OPEN_REGISTRATION' &&
    (tournament.modality !== 'EXTERNAL' || tournament.club_validation_status === 'APPROVED');
  const spotsLeft = tournament.spots_left;
  const flyer = getTournamentFlyer(tournament.photos);
  const extraPhotos = (tournament.photos || []).filter((p) => p.id !== flyer?.id);

  return (
    <Screen>
      <StackHeader
        title="Torneo"
        rightAction={
          canManage ? (
            <TouchableOpacity onPress={() => router.push(`/tournament/${id}/manage` as any)} style={{ padding: 6 }}>
              <Ionicons name="settings-outline" size={22} color={ui.colors.textInverse} />
            </TouchableOpacity>
          ) : undefined
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={ui.colors.primary} />}
      >
        <AppCard>
          {flyer ? (
            <Image
              source={{ uri: flyer.photo_url }}
              style={{
                width: '100%',
                height: 240,
                borderRadius: ui.radius.md,
                backgroundColor: ui.colors.cardMuted,
                marginBottom: 14,
              }}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: ui.colors.textPrimary }}>{tournament.name}</Text>
              {tournament.category || tournament.gender ? (
                <Text style={{ color: ui.colors.textSecondary, marginTop: 4 }}>
                  {formatTournamentCategory(tournament.category, tournament.gender)}
                </Text>
              ) : null}
            </View>
            <StatusPill status={tournament.status} size="md" />
          </View>
          <View style={{ marginTop: 12, gap: 6 }}>
            {tournament.modality ? (
              <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                {modalityLabel(tournament.modality)}
                {tournament.modality === 'EXTERNAL' && tournament.club_validation_status
                  ? ` · ${clubValidationLabel(tournament.club_validation_status)}`
                  : ''}
              </Text>
            ) : null}
            {tournament.club_name ? (
              <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>📍 {tournament.club_name}</Text>
            ) : null}
            {tournament.start_date ? (
              <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>🗓️ {formatFullDate(tournament.start_date)}</Text>
            ) : null}
            <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
              🎾 {formatLabel(tournament.format)}
              {price > 0 ? ` · ${formatCurrency(price)} por pareja` : ' · Gratis'}
            </Text>
            <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
              👥 {approved.length} parejas{tournament.max_teams ? ` / ${tournament.max_teams}` : ''}
              {spotsLeft != null ? ` · ${spotsLeft} cupos libres` : ''}
            </Text>
          </View>

          {canManage ? (
            <PrimaryButton
              label="Inscribir parejas"
              fullWidth
              style={{ marginTop: 16 }}
              onPress={() => router.push(`/tournament/${id}/manage?tab=teams` as any)}
            />
          ) : registrationOpen ? (
            <PrimaryButton
              label="Inscribirme"
              fullWidth
              style={{ marginTop: 16 }}
              onPress={() =>
                router.push(
                  (inviteToken
                    ? `/tournament/${id}/register?invite=${inviteToken}`
                    : `/tournament/${id}/register`) as any,
                )
              }
            />
          ) : (
            <View
              style={{
                marginTop: 16,
                backgroundColor: ui.colors.cardMuted,
                borderRadius: ui.radius.md,
                padding: 12,
              }}
            >
              <Text style={{ color: ui.colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
                {tournament.status === 'DRAFT' ? 'Inscripciones aún no abiertas' : 'Inscripciones cerradas'}
              </Text>
            </View>
          )}
        </AppCard>

        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 16 }}>
          {(
            [
              { key: 'teams' as const, label: `Inscriptos (${approved.length})` },
              { key: 'fixture' as const, label: 'Partidos' },
            ] as const
          ).map(({ key, label }) => (
            <PrimaryButton
              key={key}
              label={label}
              size="sm"
              variant={tab === key ? 'primary' : 'ghost'}
              onPress={() => setTab(key)}
              style={tab !== key ? { backgroundColor: ui.colors.surface, flex: 1 } : { flex: 1 }}
            />
          ))}
        </View>

        {tab === 'info' && (
          <>
            {tournament.description ? (
              <AppCard>
                <Text style={{ color: ui.colors.textSecondary, lineHeight: 20 }}>{tournament.description}</Text>
              </AppCard>
            ) : null}

            <SectionHeader title="Fechas" dark />
            {!tournament.dates?.length ? (
              <AppCard>
                <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Todavía no se cargaron fechas.</Text>
              </AppCard>
            ) : (
              tournament.dates.map((d) => (
                <AppCard key={d.id}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    {formatShortDate(d.play_date)} · {formatTime(d.play_date)}
                  </Text>
                  {d.label ? (
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginTop: 2 }}>{d.label}</Text>
                  ) : null}
                </AppCard>
              ))
            )}

            {tournament.prizes ? (
              <>
                <SectionHeader title="Premios" dark />
                <AppCard>
                  <Text style={{ color: ui.colors.textSecondary, lineHeight: 20 }}>{tournament.prizes}</Text>
                </AppCard>
              </>
            ) : null}

            {tournament.rules ? (
              <>
                <SectionHeader title="Reglamento" dark />
                <AppCard>
                  <Text style={{ color: ui.colors.textSecondary, lineHeight: 20 }}>{tournament.rules}</Text>
                </AppCard>
              </>
            ) : null}

            {extraPhotos.length ? (
              <>
                <SectionHeader title="Fotos" dark />
                {extraPhotos.map((p) => (
                  <AppCard key={p.id}>
                    <Image
                      source={{ uri: p.photo_url }}
                      style={{ width: '100%', height: 180, borderRadius: ui.radius.md, backgroundColor: ui.colors.cardMuted }}
                      resizeMode="cover"
                    />
                  </AppCard>
                ))}
              </>
            ) : null}
          </>
        )}

        {tab === 'teams' && (
          <>
            <SectionHeader title="Parejas inscriptas" subtitle={`${approved.length} confirmadas`} dark />
            {approved.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="people-outline" size={32} color={ui.colors.textMuted} />}
                title="Sin inscriptos aún"
                description="Sé la primera pareja en anotarse."
              />
            ) : (
              approved.map((r, idx) => (
                <AppCard key={r.id} onPress={() => setSelectedReg(r)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: 'rgba(20,184,166,0.12)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontWeight: '800', color: ui.colors.primary }}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                        {r.player1_name} / {r.player2_name}
                      </Text>
                      {r.category ? (
                        <Text style={{ color: ui.colors.textSecondary, fontSize: 12, marginTop: 2 }}>Cat. {r.category}</Text>
                      ) : null}
                      {isOwnerOrganizer && r.payment_required ? (
                        <Text
                          style={{
                            color:
                              r.payment_status === 'APPROVED' ? ui.colors.success : ui.colors.warning,
                            fontSize: 12,
                            marginTop: 2,
                            fontWeight: '600',
                          }}
                        >
                          {r.payment_status === 'APPROVED' ? 'Pago acreditado' : 'Pago pendiente'}
                          {r.payment_amount != null
                            ? ` · ${formatCurrency(Number(r.payment_amount))}`
                            : ''}
                        </Text>
                      ) : null}
                    </View>
                    {isOwnerOrganizer && r.payment_status === 'APPROVED' ? (
                      <Ionicons name="checkmark-circle" size={20} color={ui.colors.success} />
                    ) : isOwnerOrganizer && r.payment_required ? (
                      <Ionicons name="card-outline" size={18} color={ui.colors.warning} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                    )}
                  </View>
                </AppCard>
              ))
            )}

            {pending.length > 0 ? (
              <>
                <SectionHeader title="En lista de espera / pendientes" subtitle={`${pending.length}`} dark />
                {pending.map((r) => (
                  <AppCard key={r.id} onPress={() => setSelectedReg(r)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ flexDirection: 'row' }}>
                        <Avatar
                          name={r.player1_name}
                          photo={r.player1_photo}
                          size="sm"
                          style={{ marginLeft: 0 }}
                          borderColor={ui.colors.card}
                        />
                        <Avatar
                          name={r.player2_name}
                          photo={r.player2_photo}
                          size="sm"
                          style={{ marginLeft: -8 }}
                          borderColor={ui.colors.card}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
                          {r.player1_name} / {r.player2_name}
                        </Text>
                        <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                          Pendiente de aprobación · tocá para ver
                        </Text>
                        {isOwnerOrganizer && r.payment_required ? (
                          <Text
                            style={{
                              color:
                                r.payment_status === 'APPROVED'
                                  ? ui.colors.success
                                  : ui.colors.warning,
                              fontSize: 12,
                              marginTop: 2,
                              fontWeight: '600',
                            }}
                          >
                            {r.payment_status === 'APPROVED'
                              ? 'Pago acreditado'
                              : 'Pago pendiente'}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                    </View>
                  </AppCard>
                ))}
              </>
            ) : null}
          </>
        )}

        {tab === 'fixture' && (
          <>
            {standings && standings.length > 0 ? (
              <>
                <SectionHeader title="Posiciones" dark />
                <AppCard>
                  <View style={{ flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: ui.colors.border }}>
                    <Text style={{ width: 28, color: ui.colors.textMuted, fontSize: 12, fontWeight: '700' }}>#</Text>
                    <Text style={{ flex: 1, color: ui.colors.textMuted, fontSize: 12, fontWeight: '700' }}>Pareja</Text>
                    <Text style={{ width: 36, color: ui.colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>PJ</Text>
                    <Text style={{ width: 36, color: ui.colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>Pts</Text>
                  </View>
                  {standings.map((s) => (
                    <View key={s.registrationId} style={{ flexDirection: 'row', paddingVertical: 8 }}>
                      <Text style={{ width: 28, fontWeight: '700', color: ui.colors.textPrimary }}>{s.position}</Text>
                      <Text style={{ flex: 1, color: ui.colors.textPrimary }} numberOfLines={1}>{s.teamName}</Text>
                      <Text style={{ width: 36, textAlign: 'center', color: ui.colors.textSecondary }}>{s.played}</Text>
                      <Text style={{ width: 36, textAlign: 'center', fontWeight: '700', color: ui.colors.primary }}>{s.points}</Text>
                    </View>
                  ))}
                </AppCard>
              </>
            ) : null}

            <SectionHeader title="Partidos" dark />
            {!matches?.length ? (
              <EmptyState
                icon={<Ionicons name="tennisball-outline" size={32} color={ui.colors.textMuted} />}
                title="Fixture no generado"
                description="El organizador todavía no cargó los partidos."
              />
            ) : (
              matches.map((m) => (
                <AppCard key={m.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                      {m.round_label || `Ronda ${m.round}`}
                      {m.court_label ? ` · ${m.court_label}` : ''}
                    </Text>
                    <StatusPill status={m.status} size="sm" />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontWeight: '600', color: ui.colors.textPrimary, flex: 1 }}>{m.team_a_name || 'TBD'}</Text>
                    <Text style={{ color: ui.colors.primary, fontWeight: '800' }}>{formatScore(m)}</Text>
                  </View>
                  <Text style={{ fontWeight: '600', color: ui.colors.textPrimary, marginTop: 4 }}>{m.team_b_name || 'TBD'}</Text>
                </AppCard>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Sheet
        visible={!!selectedReg}
        onClose={() => setSelectedReg(null)}
        title="Jugadores de la pareja"
      >
        {selectedReg ? (
          <>
            <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 14 }}>
              {selectedReg.status === 'PENDING' ? 'Pendiente de aprobación' : 'Pareja confirmada'}
              {selectedReg.category ? ` · Cat. ${selectedReg.category}` : ''}
            </Text>
            {isOwnerOrganizer && selectedReg.payment_required ? (
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color:
                    selectedReg.payment_status === 'APPROVED'
                      ? ui.colors.success
                      : ui.colors.warning,
                  marginBottom: 12,
                }}
              >
                {selectedReg.payment_status === 'APPROVED' ? 'Pago acreditado' : 'Pago pendiente'}
                {selectedReg.payment_amount != null
                  ? ` · ${formatCurrency(Number(selectedReg.payment_amount))}`
                  : ''}
              </Text>
            ) : null}
            <PlayerRow
              name={selectedReg.player1_name}
              photo={selectedReg.player1_photo}
              email={selectedReg.player1_email}
              userId={selectedReg.player1_user_id}
              onPressProfile={
                selectedReg.player1_user_id
                  ? () => {
                    setSelectedReg(null);
                    router.push(`/player/${selectedReg.player1_user_id}` as any);
                  }
                  : undefined
              }
            />
            <PlayerRow
              name={selectedReg.player2_name}
              photo={selectedReg.player2_photo}
              email={selectedReg.player2_email}
              userId={selectedReg.player2_user_id}
              onPressProfile={
                selectedReg.player2_user_id
                  ? () => {
                    setSelectedReg(null);
                    router.push(`/player/${selectedReg.player2_user_id}` as any);
                  }
                  : undefined
              }
            />
            {canManage && selectedReg.phone ? (
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                Contacto: {selectedReg.phone}
              </Text>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
