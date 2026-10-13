import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { canOrganizeEvents } from '@/lib/roles';
import { useCircuitsEnabled } from '@/lib/features';
import {
  fetchTournamentDetail,
  fetchRegistrations,
  fetchMyRegistration,
  fetchMatches,
  fetchStandings,
  formatScore,
  joinTournamentByInviteToken,
} from '@/lib/tournament/api';
import {
  formatLabel,
  tournamentPrice,
  tournamentPaymentMethodsLabel,
  modalityLabel,
  clubValidationLabel,
  tournamentOrganizerLabel,
  isTournamentClosed,
  registrationCountdown,
  tournamentMatchLabel,
  WITHDRAW_REFUND_NOTICE_HOURS,
} from '@/lib/tournament/types';
import type { TournamentDetail, TournamentRegistration } from '@/lib/tournament/types';
import { getTournamentFlyer, FLYER_ASPECT_RATIO } from '@/lib/tournament/flyer';
import { hasBracketPhases } from '@/lib/tournament/brackets';
import { TournamentBracketView } from '@/components/tournament/TournamentBracketView';
import { formatFullDate, formatShortDate, formatTime, formatCurrency } from '@/lib/format';
import { ui, fontFamily } from '@/theme/tokens';
import {
  AppCard,
  SectionHeader,
  StatusPill,
  PrimaryButton,
  EmptyState,
  Avatar,
  Sheet,
  DraggableSheet,
} from '@/components/x4match';

const LIME = '#D7FF00';
const MUTED = '#A1A1AA';
const FALLBACK_FLYER = require('../../../assets/cancha.png');
const STRIPES = require('../../../assets/figma/matches/tiras.png');

type Tab = 'info' | 'teams' | 'fixture';

function formatDay(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function tournamentSchedule(t: TournamentDetail) {
  const playDates = (t.dates ?? [])
    .map((d) => d.play_date)
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const first = playDates[0] ?? t.start_date ?? null;
  const last = playDates[playDates.length - 1] ?? null;
  if (!first) return { range: 'Fecha a confirmar', time: null as string | null };
  const firstLabel = formatDay(first);
  const lastLabel = last ? formatDay(last) : null;
  const range =
    firstLabel && lastLabel && lastLabel !== firstLabel
      ? `${firstLabel} - ${lastLabel}`
      : firstLabel ?? 'Fecha a confirmar';
  return { range, time: formatTime(first) };
}

function statusBadgeLabel(t: TournamentDetail, registrationOpen: boolean) {
  if (t.status === 'CANCELLED') return 'Cancelado';
  if (isTournamentClosed(t)) return 'Terminado';
  if (t.is_past) return 'Cargando resultados';
  if (t.status === 'IN_PROGRESS') return 'En juego';
  if (t.status === 'DRAFT') return 'Próximamente';
  return registrationOpen ? 'Inscripción abierta' : 'Inscripción cerrada';
}

function InfoRow({
  icon,
  children,
  large,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
  large?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 22, alignItems: 'center' }}>
        <Ionicons name={icon} size={large ? 20 : 19} color={LIME} />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: large ? 20 : 17,
          lineHeight: large ? 26 : 23,
          color: '#FFFFFF',
          fontFamily: fontFamily.regular,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

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

function SheetBackground() {
  return (
    <Image
      source={STRIPES}
      resizeMode="contain"
      style={{
        position: 'absolute',
        right: -70,
        bottom: -40,
        width: 300,
        height: 420,
        opacity: 0.9,
      }}
    />
  );
}

export default function TournamentDetailScreen() {
  const { id, invite, preview } = useLocalSearchParams<{
    id: string;
    invite?: string;
    preview?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const circuitsEnabled = useCircuitsEnabled();
  const [tab, setTab] = useState<Tab>('info');
  const [selectedReg, setSelectedReg] = useState<TournamentRegistration | null>(null);
  const [flyerFailed, setFlyerFailed] = useState(false);
  const inviteToken = typeof invite === 'string' ? invite : undefined;
  const previewAsPlayer =
    preview === '1' || preview === 'true' || preview === 'player';

  const dismiss = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home' as any);
  }, [router]);

  const { data: tournament, error } = useQuery({
    queryKey: ['tournament-detail', id, inviteToken],
    queryFn: () => fetchTournamentDetail(id!, inviteToken),
    enabled: !!id,
    retry: false,
  });

  useQuery({
    queryKey: ['tournament-join-invite', inviteToken],
    queryFn: () => joinTournamentByInviteToken(inviteToken!),
    enabled: !!inviteToken && !!user?.id && !previewAsPlayer,
    retry: false,
  });

  const canManage =
    !!user?.id &&
    (!!tournament?.viewer_can_manage ||
      (canOrganizeEvents(user.role) &&
        (!tournament ||
          tournament.organizer_user_id === user.id ||
          user.role === 'SUPER_ADMIN' ||
          user.role === 'CLUB_ADMIN')));
  const isOwnerOrganizer = !!user?.id && tournament?.organizer_user_id === user.id;
  const showOrganizerUi = canManage && !previewAsPlayer;
  const showOwnerUi = isOwnerOrganizer && !previewAsPlayer;
  const tournamentClosed = isTournamentClosed(tournament);
  const canEditTournament =
    showOrganizerUi && (!tournamentClosed || user?.role === 'SUPER_ADMIN');

  const { data: registrations } = useQuery({
    queryKey: ['tournament-registrations', id],
    queryFn: () => fetchRegistrations(id!),
    enabled: !!id,
  });

  const { data: myReg } = useQuery({
    queryKey: ['tournament-my-reg', id],
    queryFn: () => fetchMyRegistration(id!),
    enabled: !!id && !!user?.id && !previewAsPlayer,
  });

  const { data: matches } = useQuery({
    queryKey: ['tournament-matches', id],
    queryFn: () => fetchMatches(id!),
    enabled: !!id && tab === 'fixture',
  });

  const { data: standings } = useQuery({
    queryKey: ['tournament-standings', id],
    queryFn: () => fetchStandings(id!),
    enabled: !!id && tab === 'fixture' && !hasBracketPhases(matches),
  });

  const headerRight = canEditTournament ? (
    <TouchableOpacity
      onPress={() => router.push(`/tournament/${id}/manage` as any)}
      accessibilityRole="button"
      accessibilityLabel="Gestionar torneo"
      hitSlop={10}
      style={{ padding: 4 }}
    >
      <Ionicons name="settings-outline" size={20} color={ui.colors.textPrimary} />
    </TouchableOpacity>
  ) : previewAsPlayer && canManage ? (
    <TouchableOpacity onPress={dismiss} hitSlop={10} style={{ padding: 4 }}>
      <Text style={{ color: LIME, fontWeight: '700', fontSize: 13 }}>Salir</Text>
    </TouchableOpacity>
  ) : undefined;

  if (!tournament) {
    return (
      <View style={{ flex: 1 }}>
        <DraggableSheet onClose={dismiss} background={<SheetBackground />}>
          {error ? (
            <EmptyState
              icon={<Ionicons name="lock-closed-outline" size={32} color={ui.colors.textMuted} />}
              title="Torneo no disponible"
              description="Este torneo es privado o todavía no fue publicado. Pedile el link de invitación al organizador."
            />
          ) : (
            <View style={{ paddingVertical: 80, alignItems: 'center' }}>
              <ActivityIndicator color={LIME} />
            </View>
          )}
        </DraggableSheet>
      </View>
    );
  }

  const approved = (registrations || []).filter((r) => r.status === 'APPROVED');
  const pending = (registrations || []).filter((r) => r.status === 'PENDING');
  const isInternal = tournament.modality === 'INTERNAL';
  const price = tournamentPrice(tournament);
  const organizerLabel = tournamentOrganizerLabel(tournament);
  const registrationOpen =
    !isInternal &&
    tournament.status === 'OPEN_REGISTRATION' &&
    !tournament.is_past &&
    !tournament.registration_closed &&
    (tournament.modality !== 'EXTERNAL' || tournament.club_validation_status === 'APPROVED');
  const countdown = !isInternal && tournament.status === 'OPEN_REGISTRATION' ? registrationCountdown(tournament) : null;
  const spotsLeft = tournament.spots_left;
  const flyer = getTournamentFlyer(tournament.photos);
  const extraPhotos = (tournament.photos || []).filter((p) => p.id !== flyer?.id);
  const schedule = tournamentSchedule(tournament);
  const eyebrow = [tournament.category, tournament.gender]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(' - ');
  const modalityLine = tournament.modality
    ? [
        modalityLabel(tournament.modality),
        tournament.modality === 'EXTERNAL' && tournament.club_validation_status
          ? clubValidationLabel(tournament.club_validation_status)
          : null,
      ]
        .filter(Boolean)
        .join('  ·  ')
    : null;
  const pairsLine = isInternal
    ? `${approved.length} parejas`
    : `${approved.length} parejas${
        tournament.max_teams ? ` / ${tournament.max_teams}` : ''
      }${spotsLeft != null ? `  ·  ${spotsLeft} cupos libres` : ''}`;
  const badgeLabel = statusBadgeLabel(tournament, registrationOpen);

  return (
    <View style={{ flex: 1 }}>
      <DraggableSheet
        onClose={dismiss}
        headerRight={headerRight}
        background={<SheetBackground />}
        contentContainerStyle={{ paddingHorizontal: ui.spacing.lg, gap: 12 }}
      >
        {previewAsPlayer ? (
          <View
            style={{
              padding: 12,
              borderRadius: ui.radius.md,
              borderWidth: 1,
              borderColor: ui.colors.primary,
              backgroundColor: ui.colors.primarySoft,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Ionicons name="eye-outline" size={20} color={ui.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: ui.colors.primary, fontWeight: '800', fontSize: 13 }}>
                Vista previa para jugadores
              </Text>
              <Text style={{ color: ui.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                Así se ve el torneo en la app. Los botones de gestión están ocultos.
              </Text>
            </View>
          </View>
        ) : null}

        <View
          style={{
            width: '100%',
            aspectRatio: FLYER_ASPECT_RATIO,
            borderRadius: 18,
            overflow: 'hidden',
            backgroundColor: '#0B0B0F',
          }}
        >
          <Image
            source={flyer && !flyerFailed ? { uri: flyer.photo_url } : FALLBACK_FLYER}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => setFlyerFailed(true)}
          />
          <View
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.82)',
              borderWidth: 1,
              borderColor: LIME,
            }}
          >
            <Text style={{ color: LIME, fontSize: 12, fontWeight: '700', fontFamily: fontFamily.regular }}>
              {badgeLabel}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          <Text
            style={{
              fontSize: 13,
              color: MUTED,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              fontFamily: fontFamily.regular,
            }}
          >
            {eyebrow || 'Categoría abierta'}
          </Text>
          <Text
            style={{
              fontSize: 30,
              lineHeight: 36,
              color: '#FFFFFF',
              marginTop: 4,
              fontFamily: fontFamily.regular,
            }}
          >
            {tournament.name}
          </Text>
          {modalityLine ? (
            <Text style={{ fontSize: 13, color: MUTED, marginTop: 6, fontFamily: fontFamily.regular }}>
              {modalityLine}
            </Text>
          ) : null}
        </View>

        <View style={{ height: 1, backgroundColor: LIME, opacity: 0.85, marginVertical: 8 }} />

        <View style={{ gap: 6 }}>
          <InfoRow icon="calendar" large>
            {schedule.range}
          </InfoRow>
          {schedule.time ? (
            <InfoRow icon="time" large>
              {schedule.time}
            </InfoRow>
          ) : null}
        </View>

        <View style={{ gap: 14, marginTop: 14 }}>
          {tournament.club_name ? (
            <InfoRow icon="location-sharp">{tournament.club_name}</InfoRow>
          ) : (tournament.venue_count ?? 0) > 1 ? (
            <InfoRow icon="location-sharp">{`${tournament.venue_count} sedes`}</InfoRow>
          ) : null}
          {organizerLabel ? <InfoRow icon="person">{`Organiza ${organizerLabel}`}</InfoRow> : null}
          <InfoRow icon="tennisball">
            {isInternal ? 'Parejas drive / revés · solo fixture' : formatLabel(tournament.format)}
          </InfoRow>
          {!isInternal ? (
            <InfoRow icon="cash">
              {price > 0 ? `${formatCurrency(price)} por jugador` : 'Inscripción gratis'}
            </InfoRow>
          ) : null}
          {!isInternal && price > 0 ? (
            <InfoRow icon="card">
              {tournamentPaymentMethodsLabel(tournament)}
              {tournament.accept_transfer && tournament.transfer_alias
                ? ` · Alias ${tournament.transfer_alias}`
                : tournament.accept_transfer && tournament.transfer_cbu
                  ? ` · CBU ${tournament.transfer_cbu}`
                  : ''}
            </InfoRow>
          ) : null}
          {!isInternal && price > 0 ? (
            <InfoRow icon="refresh">
              {tournament.refund_on_withdraw === false
                ? 'Sin devolución de la inscripción'
                : `Devolución si te bajás hasta ${WITHDRAW_REFUND_NOTICE_HOURS} h antes`}
            </InfoRow>
          ) : null}
          <InfoRow icon="people">{pairsLine}</InfoRow>
          {countdown ? <InfoRow icon="hourglass">{countdown.label}</InfoRow> : null}
          {circuitsEnabled && tournament.circuit_id ? (
            <TouchableOpacity onPress={() => router.push(`/circuit/${tournament.circuit_id}` as any)}>
              <InfoRow icon="trophy">Fecha de circuito · ver circuito</InfoRow>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ marginTop: 20 }}>
          {canEditTournament ? (
            <PrimaryButton
              label={isInternal ? 'Armar parejas' : 'Inscribir parejas'}
              fullWidth
              onPress={() => router.push(`/tournament/${id}/manage?tab=teams` as any)}
            />
          ) : myReg && !isInternal && !tournament.is_past && !tournamentClosed ? (
            <PrimaryButton
              label="Mi inscripción"
              fullWidth
              onPress={() =>
                router.push(
                  (inviteToken
                    ? `/tournament/${id}/register?invite=${inviteToken}`
                    : `/tournament/${id}/register`) as any,
                )
              }
            />
          ) : registrationOpen && !previewAsPlayer ? (
            <PrimaryButton
              label="Inscribirme"
              fullWidth
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
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 999,
                paddingVertical: 14,
                paddingHorizontal: 16,
              }}
            >
              <Text style={{ color: ui.colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
                {tournamentClosed
                  ? 'Torneo terminado'
                  : isInternal
                  ? 'El organizador arma las parejas y el fixture'
                  : tournament.is_past
                    ? 'Torneo jugado · cargando resultados'
                    : previewAsPlayer && registrationOpen
                    ? 'Acá el jugador vería el botón «Inscribirme»'
                    : tournament.status === 'DRAFT'
                      ? 'Inscripciones aún no abiertas'
                      : 'Inscripciones cerradas'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {(
            [
              { key: 'info' as const, label: 'Info' },
              {
                key: 'teams' as const,
                label: `${isInternal ? 'Parejas' : 'Inscriptos'} (${approved.length})`,
              },
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

            {tournament.venues?.length || tournament.club_name ? (
              <>
                <SectionHeader
                  title="Sedes"
                  subtitle={
                    (tournament.venue_count ?? tournament.venues?.length ?? 0) > 1
                      ? `${tournament.venue_count ?? tournament.venues?.length} complejos`
                      : undefined
                  }
                  dark
                />
                {(tournament.venues?.length
                  ? tournament.venues
                  : tournament.club_id
                    ? [
                        {
                          club_id: tournament.club_id,
                          club_name: tournament.club_name,
                          is_primary: true,
                        },
                      ]
                    : []
                ).map((venue) => (
                  <AppCard key={venue.club_id} onPress={() => router.push(`/club/${venue.club_id}` as any)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons
                        name={venue.is_primary ? 'business' : 'location-outline'}
                        size={18}
                        color={venue.is_primary ? ui.colors.primary : ui.colors.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                          {venue.club_name || 'Club'}
                        </Text>
                        {venue.is_primary ? (
                          <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
                            Sede principal
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={ui.colors.textMuted} />
                    </View>
                  </AppCard>
                ))}
              </>
            ) : null}

            <SectionHeader
              title={
                tournament.schedule_type === 'MULTI_DAY' && (tournament.dates?.length ?? 0) > 1
                  ? 'Jornadas'
                  : 'Día del torneo'
              }
              dark
            />
            {!tournament.dates?.length ? (
              <AppCard>
                <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>
                  {tournament.start_date
                    ? `${formatFullDate(tournament.start_date)}`
                    : tournament.schedule_type === 'MULTI_DAY'
                      ? 'Todavía no hay jornadas cargadas.'
                      : 'Todavía no se cargó el día del torneo.'}
                </Text>
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
                        backgroundColor: 'rgba(215,255,0,0.12)',
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
                      {showOwnerUi && r.payment_required ? (
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
                    {showOwnerUi && r.payment_status === 'APPROVED' ? (
                      <Ionicons name="checkmark-circle" size={20} color={ui.colors.success} />
                    ) : showOwnerUi && r.payment_required ? (
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
                        {showOwnerUi && r.payment_required ? (
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

        {tab === 'fixture' && matches && hasBracketPhases(matches) ? (
          <TournamentBracketView
            tournamentId={id!}
            matches={matches}
            inviteToken={inviteToken}
            highlightRegistrationIds={myReg?.id ? [myReg.id] : undefined}
          />
        ) : null}

        {tab === 'fixture' && !hasBracketPhases(matches) && (
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
                      {tournamentMatchLabel(m, tournament?.modality)}
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
      </DraggableSheet>

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
            {showOwnerUi && selectedReg.payment_required ? (
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
            {showOrganizerUi && selectedReg.phone ? (
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                Contacto: {selectedReg.phone}
              </Text>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}
