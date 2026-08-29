import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  getPlayPeriod,
  isPlayPeriodDisabledForDate,
  PLAY_PERIODS,
  startOfDay,
  toLocalDateString,
  type PlayPeriod,
} from '@/lib/format';
import { resolveMatchGenderFromPartner, defaultMatchGenderFromUser, MATCH_GENDER_OPTIONS_WITH_OPEN, type MatchGender } from '@/lib/gender';
import { mapMatch } from '@/lib/mappers';
import type { MatchType } from '@/lib/types';
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
  EmptyState,
  buildMatchInvitesPayload,
} from '@/components/padely';
import type { InvitedPlayer } from '@/components/padely';
import { Ionicons } from '@expo/vector-icons';

type AvailableClub = {
  id: string;
  name: string;
  city?: string;
  zone?: string;
  openSlots: number;
  slots: { id: string; courtLabel: string; startHour: number; endHour: number }[];
};

export default function AutoMatchmakingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [selectedPeriod, setSelectedPeriod] = useState<PlayPeriod | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<MatchType>('friendly');
  const [matchGender, setMatchGender] = useState<MatchGender>(() =>
    defaultMatchGenderFromUser(user?.gender, 'friendly'),
  );
  const [partner, setPartner] = useState<InvitedPlayer | null>(null);
  const [opponents, setOpponents] = useState<InvitedPlayer[]>([]);

  const period = selectedPeriod ? getPlayPeriod(selectedPeriod) : null;
  const dateKey = toLocalDateString(selectedDate);

  const { data: availableClubs, isFetching: loadingClubs } = useQuery({
    queryKey: ['clubs-available-auto', dateKey, period?.startHour, period?.endHour],
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
    enabled: !!period,
  });

  const clubOptions = useMemo(
    () =>
      (availableClubs || []).map((club) => ({
        value: club.id,
        label: club.name,
        subtitle: [club.zone, club.city].filter(Boolean).join(', '),
      })),
    [availableClubs],
  );

  const invites = buildMatchInvitesPayload(partner, opponents);
  const resolvedGender = useMemo(() => {
    return resolveMatchGenderFromPartner(user?.gender, partner?.gender, matchGender);
  }, [user?.gender, partner?.gender, matchGender]);

  const matchmakingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPeriod || !selectedClubId || !matchMode) {
        throw new Error('Completá fecha, horario, club y modo');
      }
      const periodRange = getPlayPeriod(selectedPeriod);
      const reqRes = await api.post('/match-requests', {
        clubId: selectedClubId,
        date: dateKey,
        startHour: periodRange.startHour,
        endHour: periodRange.endHour,
      });
      const runRes = await api.post(`/match-requests/run/${reqRes.data.id}`, {
        invites: invites.length ? invites : undefined,
        mode: matchMode,
        gender: resolvedGender,
      });
      return mapMatch(runRes.data);
    },
    onSuccess: (match) => {
      router.replace(`/match/${match.id}` as any);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message;
      Alert.alert(
        'Sin jugadores',
        Array.isArray(msg)
          ? msg[0]
          : msg ||
              'No encontramos jugadores con tu disponibilidad y nivel. Configurá horarios en Perfil o invitá menos rivales.',
      );
    },
  });

  return (
    <Screen swipeBack>
      <StackHeader title="Matchmaking automático" />
      <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 120, gap: 16 }}>
        <Text style={{ fontSize: 14, color: ui.colors.textSecondary, lineHeight: 20 }}>
          Elegí franja y club: armamos un partido completo con jugadores disponibles.
        </Text>

        <MonthlyCalendar
          label="Fecha"
          value={selectedDate}
          onChange={(date) => {
            setSelectedDate(date);
            setSelectedClubId(null);
            if (selectedPeriod && isPlayPeriodDisabledForDate(date, selectedPeriod)) {
              setSelectedPeriod(null);
            }
          }}
        />

        <AppCard>
          <Text style={{ fontFamily: ui.typography.label.fontFamily, color: ui.colors.textPrimary, marginBottom: 12 }}>
            Franja
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
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: ui.radius.md,
                    backgroundColor: active ? ui.colors.primary : ui.colors.surface1,
                    borderWidth: 1,
                    borderColor: active ? ui.colors.primary : ui.colors.border,
                    opacity: disabled ? 0.4 : 1,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontWeight: '700', color: active ? '#fff' : ui.colors.textPrimary }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </AppCard>

        <AppCard>
          <Text style={{ fontFamily: ui.typography.label.fontFamily, color: ui.colors.textPrimary, marginBottom: 12 }}>
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
        </AppCard>

        {period ? (
          <AppCard>
            <Text style={{ fontFamily: ui.typography.label.fontFamily, color: ui.colors.textPrimary, marginBottom: 12 }}>
              Club
            </Text>
            {loadingClubs ? (
              <ActivityIndicator color={ui.colors.primary} />
            ) : !(availableClubs || []).length ? (
              <EmptyState
                icon={<Ionicons name="business-outline" size={28} color={ui.colors.textMuted} />}
                title="Sin canchas en esa franja"
                description="Probá otra fecha u horario."
              />
            ) : (
              <SearchableSelect
                placeholder="Elegí un club"
                value={selectedClubId}
                options={clubOptions}
                onChange={setSelectedClubId}
              />
            )}
          </AppCard>
        ) : null}

        <AppCard>
          <Text style={{ fontFamily: ui.typography.label.fontFamily, color: ui.colors.textPrimary, marginBottom: 12 }}>
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
          label={matchmakingMutation.isPending ? 'Buscando…' : 'Buscar partido automático'}
          onPress={() => matchmakingMutation.mutate()}
          disabled={!selectedPeriod || !selectedClubId || matchmakingMutation.isPending}
          loading={matchmakingMutation.isPending}
        />
      </ScrollView>
    </Screen>
  );
}
