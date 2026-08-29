import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  formatHour,
  getPlayPeriod,
  getPlayPeriodWindow,
  isPlayPeriodDisabledForDate,
  PLAY_PERIODS,
  startOfDay,
  toLocalDateString,
  type PlayPeriod,
} from '@/lib/format';
import { resolveMatchGenderFromPartner, defaultMatchGenderFromUser, MATCH_GENDER_OPTIONS_WITH_OPEN, type MatchGender } from '@/lib/gender';
import { mapMatch } from '@/lib/mappers';
import type { CourtBookingMode, MatchType } from '@/lib/types';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  PrimaryButton,
  MonthlyCalendar,
  PlayerInvitePicker,
  SearchableSelect,
  SegmentedControl,
  OptionChips,
  ClubVenueField,
  buildMatchInvitesPayload,
} from '@/components/padely';
import type { InvitedPlayer } from '@/components/padely';

type AvailableClubSlot = {
  id: string;
  courtLabel: string;
  startHour: number;
  endHour: number;
  bonusPoints: number;
};

type AvailableClub = {
  id: string;
  name: string;
  city?: string;
  zone?: string;
  address?: string;
  openSlots: number;
  slots: AvailableClubSlot[];
};

const COURT_OPTIONS: { value: CourtBookingMode; label: string }[] = [
  { value: 'none', label: 'Sin cancha' },
  { value: 'external', label: 'Externa' },
  { value: 'in_app', label: 'En app' },
];

export default function CreateOpenMatchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [selectedPeriod, setSelectedPeriod] = useState<PlayPeriod | null>(null);
  const [matchMode, setMatchMode] = useState<MatchType>('friendly');
  const [matchGender, setMatchGender] = useState<MatchGender>(() =>
    defaultMatchGenderFromUser(user?.gender, 'friendly'),
  );
  const [courtBooking, setCourtBooking] = useState<CourtBookingMode>('none');
  const [venueNote, setVenueNote] = useState('');
  const [zone, setZone] = useState(user?.location || '');
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [partner, setPartner] = useState<InvitedPlayer | null>(null);
  const [opponents, setOpponents] = useState<InvitedPlayer[]>([]);

  const period = selectedPeriod ? getPlayPeriod(selectedPeriod) : null;
  const dateKey = toLocalDateString(selectedDate);

  const { data: availableClubs, isFetching: loadingClubs } = useQuery({
    queryKey: ['clubs-available-create', dateKey, period?.startHour, period?.endHour],
    queryFn: async () => {
      const res = await api.get('/clubs/available', {
        params: {
          date: dateKey,
          startHour: period!.startHour,
          endHour: period!.endHour,
        },
      });
      return (res.data || []) as AvailableClub[];
    },
    enabled: courtBooking === 'in_app' && !!period,
  });

  const selectedClub = useMemo(
    () => (availableClubs || []).find((c) => c.id === selectedClubId) ?? null,
    [availableClubs, selectedClubId],
  );

  const clubOptions = useMemo(
    () =>
      (availableClubs || []).map((club) => ({
        value: club.id,
        label: club.name,
        subtitle: [
          club.openSlots === 1 ? '1 cancha libre' : `${club.openSlots} canchas libres`,
          [club.zone, club.city].filter(Boolean).join(', '),
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    [availableClubs],
  );

  const invites = buildMatchInvitesPayload(partner, opponents);
  const resolvedGender = useMemo(() => {
    return resolveMatchGenderFromPartner(user?.gender, partner?.gender, matchGender);
  }, [user?.gender, partner?.gender, matchGender]);

  const canCreate = useMemo(() => {
    if (!selectedPeriod || !matchMode) return false;
    if (courtBooking === 'in_app') return !!selectedClubId && !!selectedSlotId;
    if (courtBooking === 'external') return Boolean(venueNote.trim() || zone.trim());
    return true;
  }, [selectedPeriod, matchMode, courtBooking, selectedClubId, selectedSlotId, venueNote, zone]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPeriod || !matchMode) {
        throw new Error('Completá fecha, horario y modo');
      }
      const periodRange = getPlayPeriod(selectedPeriod);
      const { startsAt, endsAt } = getPlayPeriodWindow(selectedDate, selectedPeriod);
      const slot = selectedClub?.slots.find((s) => s.id === selectedSlotId);
      const slotStartsAt = new Date(selectedDate);
      if (slot) slotStartsAt.setHours(slot.startHour, 0, 0, 0);

      const payload: Record<string, unknown> = {
        title:
          matchMode === 'competitive'
            ? `Partido competitivo · ${periodRange.label}`
            : `Partido amistoso · ${periodRange.label}`,
        date: (courtBooking === 'in_app' && slot ? slotStartsAt : startsAt).toISOString(),
        endsAt: endsAt.toISOString(),
        gender: resolvedGender,
        mode: matchMode,
        neededPlayers: 4,
        courtBooking,
        invites: invites.length ? invites : undefined,
        zone: zone.trim() || selectedClub?.zone || user?.location || undefined,
      };

      if (courtBooking === 'in_app') {
        payload.clubId = selectedClubId;
        payload.courtSlotId = selectedSlotId;
        payload.description = slot
          ? `${slot.courtLabel} · ${formatHour(slot.startHour)}–${formatHour(slot.endHour)}`
          : `Busco jugadores · ${periodRange.hint}`;
      } else if (courtBooking === 'external') {
        payload.venueNote = venueNote.trim() || undefined;
        payload.description = venueNote.trim()
          ? `Reserva externa: ${venueNote.trim()}`
          : `Busco jugadores · ${periodRange.hint}`;
      } else {
        payload.description = `Busco jugadores · ${periodRange.hint}`;
      }

      const createRes = await api.post('/matches', payload);
      return mapMatch(createRes.data);
    },
    onSuccess: (match) => {
      router.replace(`/match/${match.id}` as any);
    },
    onError: (error: any) => {
      Alert.alert(
        'Error',
        error?.response?.data?.message || error.message || 'No se pudo crear el partido',
      );
    },
  });

  return (
    <Screen swipeBack>
      <StackHeader title="Crear partido abierto" />
      <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 120, gap: 16 }}>
        <MonthlyCalendar
          label="Fecha"
          value={selectedDate}
          onChange={(date) => {
            setSelectedDate(date);
            setSelectedClubId(null);
            setSelectedSlotId(null);
            if (selectedPeriod && isPlayPeriodDisabledForDate(date, selectedPeriod)) {
              setSelectedPeriod(null);
            }
          }}
        />

        <AppCard>
          <Text
            style={{
              fontFamily: ui.typography.label.fontFamily,
              color: ui.colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Franja horaria
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {PLAY_PERIODS.map((item) => {
              const disabled = isPlayPeriodDisabledForDate(selectedDate, item.id);
              const active = selectedPeriod === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  disabled={disabled}
                  onPress={() => {
                    setSelectedPeriod(item.id);
                    setSelectedClubId(null);
                    setSelectedSlotId(null);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    paddingHorizontal: 8,
                    borderRadius: ui.radius.md,
                    backgroundColor: active ? ui.colors.primary : ui.colors.surface1,
                    borderWidth: 1,
                    borderColor: active ? ui.colors.primary : ui.colors.border,
                    opacity: disabled ? 0.4 : 1,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: active ? '#fff' : ui.colors.textPrimary,
                      marginBottom: 2,
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: active ? 'rgba(255,255,255,0.85)' : ui.colors.textMuted,
                    }}
                  >
                    {item.hint}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </AppCard>

        <AppCard>
          <Text
            style={{
              fontFamily: ui.typography.label.fontFamily,
              color: ui.colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Modo
          </Text>
          <SegmentedControl
            options={[
              { value: 'friendly', label: 'Amistoso' },
              { value: 'competitive', label: 'Competitivo' },
            ]}
            value={matchMode}
            onChange={(value) => {
              setMatchMode(value);
              setMatchGender(defaultMatchGenderFromUser(user?.gender, value));
            }}
          />
        </AppCard>

        <AppCard>
          <OptionChips
            label="Busco partido"
            options={MATCH_GENDER_OPTIONS_WITH_OPEN.map((o) => o.label)}
            selected={
              MATCH_GENDER_OPTIONS_WITH_OPEN.find(
                (o) => o.value === (resolvedGender === 'mixed' && partner ? 'mixed' : matchGender),
              )?.label
            }
            onSelect={(label) => {
              const next = MATCH_GENDER_OPTIONS_WITH_OPEN.find((o) => o.label === label);
              if (next) setMatchGender(next.value);
            }}
          />
          {partner && resolvedGender === 'mixed' && matchGender !== 'mixed' ? (
            <Text style={{ marginTop: 8, color: ui.colors.textMuted, fontSize: 12 }}>
              Tu pareja es de otro género: el partido queda como mixto.
            </Text>
          ) : null}
        </AppCard>

        <AppCard>
          <Text
            style={{
              fontFamily: ui.typography.label.fontFamily,
              color: ui.colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Cancha
          </Text>
          <SegmentedControl
            options={COURT_OPTIONS}
            value={courtBooking}
            onChange={(value) => {
              setCourtBooking(value);
              setSelectedClubId(null);
              setSelectedSlotId(null);
            }}
          />

          {courtBooking === 'none' ? (
            <Text style={{ marginTop: 12, color: ui.colors.textSecondary, fontSize: 13 }}>
              Publicás el partido sin cancha. Pueden acordar dónde jugar después.
            </Text>
          ) : null}

          {courtBooking === 'external' ? (
            <View style={{ marginTop: 14 }}>
              <ClubVenueField
                venue={venueNote}
                onVenueChange={setVenueNote}
                zone={zone}
                onZoneChange={setZone}
                enabled={courtBooking === 'external'}
              />
            </View>
          ) : null}

          {courtBooking === 'in_app' ? (
            <View style={{ marginTop: 14, gap: 12 }}>
              {!period ? (
                <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>
                  Elegí una franja para ver canchas libres.
                </Text>
              ) : loadingClubs ? (
                <ActivityIndicator color={ui.colors.primary} />
              ) : !(availableClubs || []).length ? (
                <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>
                  No hay canchas libres en esa franja. Probá otra fecha u horario.
                </Text>
              ) : (
                <>
                  <SearchableSelect
                    label="Club"
                    placeholder="Elegí un club con cancha libre"
                    value={selectedClubId}
                    options={clubOptions}
                    onChange={(clubId) => {
                      setSelectedClubId(clubId);
                      const club = (availableClubs || []).find((c) => c.id === clubId);
                      setSelectedSlotId(club?.slots[0]?.id ?? null);
                      if (club?.zone) setZone(club.zone);
                    }}
                  />
                  {selectedClub && selectedClub.slots.length > 0 ? (
                    <View>
                      <Text style={{ fontSize: 13, color: ui.colors.textMuted, marginBottom: 8 }}>
                        Elegí el turno
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {selectedClub.slots.map((slot) => {
                          const active = selectedSlotId === slot.id;
                          return (
                            <TouchableOpacity
                              key={slot.id}
                              onPress={() => setSelectedSlotId(slot.id)}
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                borderRadius: ui.radius.md,
                                backgroundColor: active ? ui.colors.primarySoft : ui.colors.surface2,
                                borderWidth: 1,
                                borderColor: active ? ui.colors.primary : ui.colors.border,
                              }}
                            >
                              <Text
                                style={{
                                  fontWeight: '700',
                                  color: active ? ui.colors.primary : ui.colors.textPrimary,
                                  fontSize: 13,
                                }}
                              >
                                {slot.courtLabel}
                              </Text>
                              <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>
                                {formatHour(slot.startHour)}–{formatHour(slot.endHour)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          ) : null}
        </AppCard>

        <AppCard>
          <Text
            style={{
              fontFamily: ui.typography.label.fontFamily,
              color: ui.colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Invitados (opcional)
          </Text>
          <PlayerInvitePicker
            partner={partner}
            opponents={opponents}
            onPartnerChange={setPartner}
            onOpponentsChange={setOpponents}
            excludeUserIds={user?.id ? [user.id] : []}
          />
        </AppCard>

        <PrimaryButton
          label={createMutation.isPending ? 'Creando…' : 'Crear partido abierto'}
          onPress={() => createMutation.mutate()}
          disabled={!canCreate || createMutation.isPending}
        />
      </ScrollView>
    </Screen>
  );
}
