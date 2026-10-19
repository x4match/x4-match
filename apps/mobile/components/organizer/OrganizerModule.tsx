import { useEffect, useState, useCallback } from 'react';
import { ScrollView, Text, View, Alert, Keyboard, Pressable, Image } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { canOrganizeEvents } from '@/lib/roles';
import { mapTournament, extractCircuitId, safeMapCircuit } from '@/lib/mappers';
import { defaultCircuitTitle } from '@/lib/circuits/staff';
import type { Circuit, Tournament } from '@/lib/types';
import { createTournament, fetchMyTournaments } from '@/lib/tournament/api';
import {
  TOURNAMENT_FORMATS,
  TOURNAMENT_TYPE_OPTIONS,
  TOURNAMENT_MODALITY_OPTIONS,
  TOURNAMENT_SCHEDULE_OPTIONS,
  FIXED_CATEGORY_OPTIONS,
  SUM_CATEGORY_OPTIONS,
  CATEGORY_MODE_OPTIONS,
  formatSumCategory,
  isSumCategoryCap,
  modalityLabel,
  clubValidationLabel,
  isTournamentClosed,
  WITHDRAW_REFUND_NOTICE_HOURS,
  type TournamentCategoryMode,
  type TournamentModality,
  type TournamentScheduleType,
  type SumCategoryCap,
} from '@/lib/tournament/types';
import {
  pickTournamentFlyer,
  showFlyerPickerOptions,
  uploadTournamentFlyer,
  type PickedFlyer,
} from '@/lib/tournament/flyer';
import { ui } from '@/theme/tokens';
import { getTabScreenPaddingBottom, tabScreenPadding } from '@/lib/layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticSelection } from '@/lib/haptics';
import {
  AppCard,
  SectionHeader,
  PrimaryButton,
  InputField,
  MoneyInputField,
  OptionChips,
  DateTimeField,
  EmptyState,
  StatusPill,
  SearchableSelect,
  TournamentFlyerField,
  TournamentCard,
  CircuitsUnderConstruction,
} from '@/components/x4match';
import { parseMoneyInput } from '@/lib/currency';
import { useCircuitsEnabled } from '@/lib/features';

type OrganizerArea = 'hub' | 'tournaments' | 'circuits' | 'ranking';

const AREAS: { value: OrganizerArea; label: string }[] = [
  { value: 'hub', label: 'Inicio' },
  { value: 'tournaments', label: 'Torneos' },
  { value: 'circuits', label: 'Circuitos' },
  { value: 'ranking', label: 'Ranking' },
];

function initialArea(create?: string | null): OrganizerArea {
  if (create === 'tournament') return 'tournaments';
  if (create === 'circuit') return 'circuits';
  return 'hub';
}

export function OrganizerModule({ initialCreate }: { initialCreate?: string | null }) {
  const router = useRouter();
  const circuitsEnabled = useCircuitsEnabled();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [area, setArea] = useState<OrganizerArea>(initialArea(initialCreate));
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentDescription, setTournamentDescription] = useState('');
  const [tournamentPrizes, setTournamentPrizes] = useState<string[]>(['']);
  const [tournamentModality, setTournamentModality] = useState<TournamentModality>('INTERNAL');
  const [tournamentClubId, setTournamentClubId] = useState<string | null>(null);
  const [tournamentVenueClubIds, setTournamentVenueClubIds] = useState<string[]>([]);
  const [categoryMode, setCategoryMode] = useState<TournamentCategoryMode>('FIXED');
  const [tournamentCategory, setTournamentCategory] = useState('');
  const [sumCap, setSumCap] = useState<SumCategoryCap | null>(null);
  const [tournamentType, setTournamentType] = useState('');
  const [tournamentMaxTeams, setTournamentMaxTeams] = useState('16');
  const [tournamentFormat, setTournamentFormat] = useState<string>('GROUPS_THEN_ELIMINATION');
  const [tournamentScheduleType, setTournamentScheduleType] =
    useState<TournamentScheduleType>('SINGLE_DAY');
  const [tournamentPrice, setTournamentPrice] = useState('0');
  const [acceptTransfer, setAcceptTransfer] = useState(false);
  const [acceptMercadopago, setAcceptMercadopago] = useState(true);
  const [refundOnWithdraw, setRefundOnWithdraw] = useState(true);
  const [transferCbu, setTransferCbu] = useState('');
  const [transferAlias, setTransferAlias] = useState('');
  const [transferHolderName, setTransferHolderName] = useState('');
  const [tournamentCourts, setTournamentCourts] = useState('4');
  const [tournamentStartDate, setTournamentStartDate] = useState<Date | null>(null);
  const [tournamentStartTime, setTournamentStartTime] = useState<Date | null>(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [tournamentFlyer, setTournamentFlyer] = useState<PickedFlyer | null>(null);
  const [showCreateCircuit, setShowCreateCircuit] = useState(false);
  const [circuitName, setCircuitName] = useState('');
  const [circuitShortName, setCircuitShortName] = useState('');
  const [circuitCity, setCircuitCity] = useState('');
  const [circuitSeason, setCircuitSeason] = useState('');
  const [circuitDescription, setCircuitDescription] = useState('');

  const [creatingCircuit, setCreatingCircuit] = useState(false);

  useEffect(() => {
    if (initialCreate === 'tournament') {
      setArea('tournaments');
      setShowCreateTournament(true);
    } else if (initialCreate === 'circuit') {
      setArea('circuits');
      setShowCreateCircuit(true);
    }
  }, [initialCreate]);

  const canManageEvents = canOrganizeEvents(user?.role);

  const { data: tournaments } = useQuery({
    queryKey: ['organizer-tournaments-mine'],
    queryFn: () => fetchMyTournaments('ALL'),
    enabled: canManageEvents,
  });

  const { data: clubs } = useQuery({
    queryKey: ['clubs-for-tournament'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return res.data as { id: string; name: string; city?: string; location?: string; address?: string }[];
    },
    enabled: canManageEvents && showCreateTournament,
  });

  const { data: circuits } = useQuery({
    queryKey: ['organizer-circuits-mine', user?.id],
    queryFn: async () => {
      const res = await api.get('/circuits/mine');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: circuitsEnabled && canManageEvents && !!user?.id,
  });

  const handleCreateCircuit = useCallback(async () => {
    const savedName = circuitName.trim();
    const savedShortName = circuitShortName.trim().toUpperCase();
    const savedCity = circuitCity.trim();
    const savedSeason = circuitSeason.trim();
    const savedDescription = circuitDescription.trim();

    if (!savedName) {
      Alert.alert('Falta el nombre', 'Ingresá un nombre para el circuito.');
      return;
    }
    if (!savedShortName) {
      Alert.alert('Falta la sigla', 'La sigla identifica al circuito en los carteles de perfil (por ejemplo "Presidente CAS").');
      return;
    }

    Keyboard.dismiss();
    setCreatingCircuit(true);

    try {
      const payload: { name: string; shortName: string; city?: string; season?: string; description?: string } = {
        name: savedName,
        shortName: savedShortName,
      };
      if (savedCity) payload.city = savedCity;
      if (savedSeason) payload.season = savedSeason;
      if (savedDescription) payload.description = savedDescription;

      const res = await api.post('/circuits', payload);
      const circuitId = extractCircuitId(res.data);

      setCreatingCircuit(false);
      setCircuitName('');
      setCircuitShortName('');
      setCircuitCity('');
      setCircuitSeason('');
      setCircuitDescription('');
      setShowCreateCircuit(false);

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['organizer-circuits-mine'] });
        queryClient.invalidateQueries({ queryKey: ['circuits-tab'] });
        queryClient.invalidateQueries({ queryKey: ['circuit-roles-user'] });
      }, 0);

      if (!circuitId) {
        Alert.alert('Listo', 'Circuito creado. Configuralo desde la lista.');
        return;
      }

      Alert.alert(
        'Circuito creado',
        `“${savedName}” quedó guardado como borrador. Ya sos ${defaultCircuitTitle('PRESIDENT', savedShortName)}: armá tu staff, categorías y sedes.`,
        [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Configurar',
          onPress: () => {
            requestAnimationFrame(() => {
              router.push(`/circuit/${circuitId}` as any);
            });
          },
        },
      ]);
    } catch (err: any) {
      setCreatingCircuit(false);
      const rawMessage = err?.response?.data?.message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join('\n')
        : typeof rawMessage === 'string'
          ? rawMessage
          : 'No se pudo crear el circuito';
      Alert.alert('Error', message);
    }
  }, [circuitName, circuitShortName, circuitCity, circuitSeason, circuitDescription, queryClient, router]);

  const isInternalDraft = tournamentModality === 'INTERNAL';

  const resolvedTournamentCategory =
    categoryMode === 'SUM' && sumCap != null ? formatSumCategory(sumCap) : tournamentCategory;

  const createTournamentMutation = useMutation({
    mutationFn: async () => {
      const isSingleDay = tournamentScheduleType === 'SINGLE_DAY';
      if (isSingleDay && !tournamentStartDate) {
        throw new Error('Falta la fecha del torneo');
      }
      if (isSingleDay && !tournamentStartTime) {
        throw new Error('Falta la hora del torneo');
      }

      let startDate: string | undefined;
      if (tournamentStartDate) {
        const playAt = new Date(tournamentStartDate);
        if (tournamentStartTime) {
          playAt.setHours(
            tournamentStartTime.getHours(),
            tournamentStartTime.getMinutes(),
            0,
            0,
          );
        } else {
          playAt.setHours(9, 0, 0, 0);
        }
        startDate = playAt.toISOString();
      }

      const prizeLines = tournamentPrizes
        .map((prize, index) => {
          const text = prize.trim();
          if (!text) return null;
          return `${index + 1}°: ${text}`;
        })
        .filter(Boolean);
      const prizesText = prizeLines.length ? prizeLines.join('\n') : undefined;

      const venueClubIds =
        tournamentVenueClubIds.length > 0
          ? tournamentVenueClubIds
          : tournamentClubId
            ? [tournamentClubId]
            : [];

      if (tournamentModality === 'INTERNAL') {
        return createTournament({
          name: tournamentName,
          modality: 'INTERNAL',
          clubId: venueClubIds[0],
          venueClubIds: venueClubIds.length ? venueClubIds : undefined,
          scheduleType: 'SINGLE_DAY',
          courtsAvailable: Number(tournamentCourts) || 2,
          startDate,
        });
      }

      const created = await createTournament({
        name: tournamentName,
        modality: tournamentModality,
        clubId: venueClubIds[0],
        venueClubIds: venueClubIds.length ? venueClubIds : undefined,
        category: resolvedTournamentCategory || undefined,
        gender: tournamentType || undefined,
        maxTeams: Number(tournamentMaxTeams) || 16,
        format: tournamentFormat,
        scheduleType: tournamentScheduleType,
        price: parseMoneyInput(tournamentPrice),
        acceptTransfer: parseMoneyInput(tournamentPrice) > 0 ? acceptTransfer : false,
        acceptMercadopago: parseMoneyInput(tournamentPrice) > 0 ? acceptMercadopago : false,
        transferCbu: acceptTransfer ? transferCbu.trim() || undefined : undefined,
        transferAlias: acceptTransfer ? transferAlias.trim() || undefined : undefined,
        transferHolderName: acceptTransfer ? transferHolderName.trim() || undefined : undefined,
        refundOnWithdraw,
        courtsAvailable: Number(tournamentCourts) || 4,
        startDate,
        description: tournamentDescription.trim() || undefined,
        prizes: prizesText,
      });
      if (tournamentFlyer) {
        try {
          await uploadTournamentFlyer(created.id, tournamentFlyer);
        } catch {
          Alert.alert(
            'Torneo creado',
            'El torneo se creó, pero no se pudo subir el flyer. Podés agregarlo después desde la gestión.',
          );
        }
      }
      return created;
    },
    onSuccess: (created) => {
      setTournamentName('');
      setTournamentDescription('');
      setTournamentPrizes(['']);
      setTournamentModality('INTERNAL');
      setTournamentClubId(null);
      setTournamentVenueClubIds([]);
      setAcceptTransfer(false);
      setAcceptMercadopago(true);
      setRefundOnWithdraw(true);
      setTransferCbu('');
      setTransferAlias('');
      setTransferHolderName('');
      setCategoryMode('FIXED');
      setTournamentCategory('');
      setSumCap(null);
      setTournamentType('');
      setTournamentFormat('GROUPS_THEN_ELIMINATION');
      setTournamentScheduleType('SINGLE_DAY');
      setTournamentStartDate(null);
      const defaultTime = new Date();
      defaultTime.setHours(9, 0, 0, 0);
      setTournamentStartTime(defaultTime);
      setTournamentFlyer(null);
      setShowCreateTournament(false);
      queryClient.invalidateQueries({ queryKey: ['organizer-tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['organizer-tournaments-mine'] });
      router.push(
        (created.modality === 'INTERNAL'
          ? `/tournament/${created.id}/manage?tab=teams`
          : `/tournament/${created.id}/manage`) as any,
      );
    },
    onError: (err: any) => {
      const msg = err?.message;
      if (msg === 'Falta la fecha del torneo') {
        Alert.alert('Falta el día', 'Un torneo de un día necesita fecha.');
        return;
      }
      if (msg === 'Falta la hora del torneo') {
        Alert.alert('Falta la hora', 'Un torneo de un día necesita hora de inicio.');
        return;
      }
      Alert.alert('Error', err.response?.data?.message || 'No se pudo crear el torneo');
    },
  });

  if (!canManageEvents) {
    return (
      <EmptyState
        icon={<Ionicons name="shield-outline" size={32} color={ui.colors.textMuted} />}
        title="Acceso restringido"
        description="Iniciá sesión como jugador para organizar torneos y circuitos."
        action={<PrimaryButton label="Volver al inicio" onPress={() => router.replace('/(tabs)/home')} />}
      />
    );
  }

  const rawTournaments = tournaments || [];
  const tournamentList: Tournament[] = rawTournaments.map(mapTournament);
  const circuitList: Circuit[] = (circuits || [])
    .map((row) => safeMapCircuit(row))
    .filter((circuit): circuit is Circuit => circuit != null && Boolean(circuit.id));
  const pendingRegistrations = rawTournaments.reduce((sum, row) => sum + (row.pending_count || 0), 0);
  const openTournaments = rawTournaments.filter(
    (row) => !isTournamentClosed(row) && row.status !== 'CANCELLED',
  );
  const activeTournaments = openTournaments.length;
  const clubOptions = (clubs || []).map((c) => ({
    value: c.id,
    label: c.name,
    subtitle: [c.city, c.location, c.address].filter(Boolean).join(' · ') || undefined,
  }));

  const openLatestTournamentManage = () => {
    const next =
      openTournaments.find((row) => row.status === 'OPEN_REGISTRATION' || row.status === 'IN_PROGRESS') ||
      openTournaments[0];
    if (!next) {
      setArea('tournaments');
      setShowCreateTournament(true);
      return;
    }
    router.push(`/tournament/${next.id}/manage` as any);
  };

  const controlTools: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    onPress: () => void;
  }[] = [
      {
        icon: 'people-outline',
        title: 'Inscripciones',
        subtitle: pendingRegistrations > 0 ? `${pendingRegistrations} pendientes` : 'Parejas y confirmación',
        onPress: openLatestTournamentManage,
      },
      {
        icon: 'git-branch-outline',
        title: 'Cuadros',
        subtitle: 'Sorteo y fixture',
        onPress: openLatestTournamentManage,
      },
      {
        icon: 'pulse-outline',
        title: 'Resultados',
        subtitle: 'Marcadores en vivo',
        onPress: openLatestTournamentManage,
      },
      {
        icon: 'card-outline',
        title: 'Pagos',
        subtitle: 'Señas e inscripciones',
        onPress: openLatestTournamentManage,
      },
      {
        icon: 'business-outline',
        title: 'Sedes',
        subtitle: 'Clubes y canchas',
        onPress: () => setArea('circuits'),
      },
      {
        icon: 'podium-outline',
        title: 'Ranking',
        subtitle: 'Puntos y posiciones',
        onPress: () => setArea('ranking'),
      },
      {
        icon: 'notifications-outline',
        title: 'Avisos',
        subtitle: 'Inscripciones y partidos',
        onPress: () => router.push('/notifications' as any),
      },
      {
        icon: 'time-outline',
        title: 'Historial',
        subtitle: 'Torneos que cerraste',
        onPress: () => router.push('/(tabs)/history' as any),
      },
    ];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        ...tabScreenPadding,
        paddingBottom: getTabScreenPaddingBottom(insets.bottom),
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, alignItems: 'center' }}
        style={{ marginBottom: 16, flexGrow: 0, height: 40 }}
      >
        {AREAS.map((item) => {
          const active = area === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                void hapticSelection();
                setArea(item.value);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: ui.radius.pill,
                backgroundColor: active ? ui.colors.primary : ui.colors.surface1,
                borderWidth: 1,
                borderColor: active ? ui.colors.primary : ui.colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: active ? ui.colors.onPrimary : ui.colors.textSecondary,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {area === 'hub' && (
        <>
          <Text style={{ fontSize: 15, lineHeight: 22, color: ui.colors.textSecondary, marginBottom: 16 }}>
            Organizá torneos y circuitos. Inscripciones, cuadros, sedes, ranking y resultados están en este módulo.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 8 }}>
            {[
              { value: String(activeTournaments), label: 'Torneos activos' },
              { value: String(circuitList.length), label: 'Circuitos' },
              { value: String(pendingRegistrations), label: 'Inscripciones' },
              { value: String(tournamentList.length), label: 'Torneos totales' },
            ].map((stat) => (
              <View key={stat.label} style={{ width: '50%', padding: 5 }}>
                <View
                  style={{
                    backgroundColor: ui.colors.surface1,
                    borderRadius: ui.radius.lg,
                    borderWidth: 1,
                    borderColor: ui.colors.border,
                    padding: 14,
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: '800', color: ui.colors.primary }}>{stat.value}</Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>{stat.label}</Text>
                </View>
              </View>
            ))}
          </View>

          <SectionHeader title="Crear" subtitle="El evento arranca acá" dark />
          <AppCard
            onPress={() => {
              setArea('tournaments');
              setShowCreateTournament(true);
            }}
            style={{ marginBottom: 10 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="trophy-outline" size={22} color={ui.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Torneo</Text>
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                  Categorías, cuadros automáticos e inscripciones.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
            </View>
          </AppCard>
          <AppCard
            onPress={() => {
              setArea('circuits');
              setShowCreateCircuit(true);
            }}
            style={{ marginBottom: 16 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="git-network-outline" size={22} color={ui.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Circuito</Text>
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                  {circuitsEnabled ? 'Fechas, sedes, puntos y ranking.' : 'En construcción · muy pronto.'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
            </View>
          </AppCard>

          <SectionHeader title="Centro de control" subtitle="De cada competencia" dark />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>
            {controlTools.map((tool) => (
              <View key={tool.title} style={{ width: '50%', padding: 5 }}>
                <AppCard onPress={tool.onPress} padding="sm">
                  <Ionicons name={tool.icon} size={20} color={ui.colors.primary} />
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginTop: 8 }}>{tool.title}</Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>{tool.subtitle}</Text>
                </AppCard>
              </View>
            ))}
          </View>
        </>
      )}

      {area === 'ranking' && (
        <>
          <Text style={{ fontSize: 13, lineHeight: 19, color: ui.colors.textSecondary, marginBottom: 14 }}>
            Los circuitos suman puntos por fecha. El ranking general de la app sigue el nivel de cada jugador.
          </Text>
          <AppCard onPress={() => router.push('/ranking-general' as any)} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="podium-outline" size={22} color={ui.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Ranking general</Text>
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                  Posiciones de jugadores en x4 match.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
            </View>
          </AppCard>
          <SectionHeader title="Rankings de tus circuitos" subtitle={`${circuitList.length} circuitos`} dark />
          {!circuitsEnabled ? (
            <CircuitsUnderConstruction />
          ) : circuitList.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="podium-outline" size={32} color={ui.colors.textMuted} />}
              title="Sin circuitos"
              description="Creá un circuito, sumá fechas y el ranking de puntos aparece en cada uno."
              action={
                <PrimaryButton
                  label="Crear circuito"
                  size="sm"
                  onPress={() => {
                    setArea('circuits');
                    setShowCreateCircuit(true);
                  }}
                />
              }
            />
          ) : (
            circuitList.map((circuit) => (
              <AppCard
                key={circuit.id}
                onPress={() => router.push(`/circuit/${circuit.id}` as any)}
                style={{ marginBottom: 10 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{circuit.name}</Text>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                      {[circuit.season, circuit.categoryCount ? `${circuit.categoryCount} categorías` : null]
                        .filter(Boolean)
                        .join(' · ') || 'Puntos por fecha'}
                    </Text>
                  </View>
                  <StatusPill status={circuit.status} />
                </View>
              </AppCard>
            ))
          )}
        </>
      )}

      {area === 'circuits' && !circuitsEnabled && <CircuitsUnderConstruction />}

      {area === 'circuits' && circuitsEnabled && (
        <>
          {showCreateCircuit ? (
            <AppCard>
              <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary, marginBottom: 12 }}>
                Crear circuito
              </Text>
              <InputField
                label="Nombre *"
                value={circuitName}
                onChangeText={setCircuitName}
                placeholder="Ej: Circuito Amateur del Sur"
              />
              <InputField
                label="Sigla *"
                value={circuitShortName}
                onChangeText={(value) => setCircuitShortName(value.toUpperCase())}
                autoCapitalize="characters"
                maxLength={12}
                placeholder="Ej: CAS"
                hint={`En tu perfil vas a ver el cartel "${defaultCircuitTitle('PRESIDENT', circuitShortName.trim() || 'de tu circuito')}".`}
              />
              <InputField label="Zona / ciudad" value={circuitCity} onChangeText={setCircuitCity} placeholder="Ej: Zona Sur · GBA" />
              <InputField label="Temporada" value={circuitSeason} onChangeText={setCircuitSeason} placeholder="2026" />
              <InputField
                label="Descripción"
                value={circuitDescription}
                onChangeText={setCircuitDescription}
                placeholder="Varias sedes y categorías en un solo circuito"
                blurOnSubmit
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton label="Cancelar" variant="ghost" fullWidth onPress={() => setShowCreateCircuit(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="Crear"
                    fullWidth
                    loading={creatingCircuit}
                    onPress={handleCreateCircuit}
                  />
                </View>
              </View>
            </AppCard>
          ) : (
            <PrimaryButton
              label="Crear nuevo circuito"
              variant="outline"
              fullWidth
              onPress={() => setShowCreateCircuit(true)}
              style={{ marginBottom: 16 }}
            />
          )}
          <SectionHeader title="Mis circuitos" subtitle={`${circuitList.length} circuitos`} dark />
          {circuitList.map((c) => (
            <AppCard key={c.id} onPress={() => router.push(`/circuit/${c.id}` as any)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: 'rgba(20,184,166,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {c.logoUrl ? (
                    <Image source={{ uri: c.logoUrl }} style={{ width: 48, height: 48 }} />
                  ) : c.shortName ? (
                    <Text style={{ fontSize: 12, fontWeight: '900', color: ui.colors.primary }} numberOfLines={1}>
                      {c.shortName.slice(0, 4)}
                    </Text>
                  ) : (
                    <Ionicons name="git-network" size={24} color={ui.colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{c.name}</Text>
                  {c.myDisplayTitle || c.season ? (
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                      {[c.myDisplayTitle, c.season].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <StatusPill status={c.status} />
                <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
              </View>
            </AppCard>
          ))}
        </>
      )}

      {area === 'tournaments' && (
        <>
          {showCreateTournament ? (
            <AppCard>
              <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary, marginBottom: 12 }}>
                Crear nuevo torneo
              </Text>
              <OptionChips
                label="Modalidad"
                options={TOURNAMENT_MODALITY_OPTIONS.map((o) => o.label)}
                selected={TOURNAMENT_MODALITY_OPTIONS.find((o) => o.value === tournamentModality)?.label}
                onSelect={(label) => {
                  const next =
                    TOURNAMENT_MODALITY_OPTIONS.find((o) => o.label === label)?.value ?? 'INTERNAL';
                  setTournamentModality(next);
                  if (next === 'INTERNAL') {
                    setTournamentClubId(null);
                    setTournamentScheduleType('SINGLE_DAY');
                  }
                }}
              />
              <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textSecondary, marginBottom: 6 }}>
                Sedes
              </Text>
              <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 8 }}>
                {tournamentModality === 'EXTERNAL'
                  ? 'Podés sumar varias. La primera es la sede principal (valida el torneo).'
                  : 'Opcional. Podés marcar una o más sedes donde se juega.'}
              </Text>
              {tournamentVenueClubIds.map((clubId, index) => {
                const club = clubOptions.find((c) => c.value === clubId);
                return (
                  <View
                    key={clubId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 8,
                      padding: 12,
                      borderRadius: ui.radius.md,
                      borderWidth: 1,
                      borderColor: index === 0 ? ui.colors.primary : ui.colors.border,
                      backgroundColor: ui.colors.surface1,
                    }}
                  >
                    <Ionicons
                      name={index === 0 ? 'business' : 'location-outline'}
                      size={18}
                      color={index === 0 ? ui.colors.primary : ui.colors.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                        {club?.label || 'Club'}
                      </Text>
                      <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>
                        {index === 0
                          ? tournamentModality === 'EXTERNAL'
                            ? 'Sede principal · validación'
                            : 'Sede principal'
                          : `Sede ${index + 1}`}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setTournamentVenueClubIds((prev) => {
                          const next = prev.filter((id) => id !== clubId);
                          setTournamentClubId(next[0] ?? null);
                          return next;
                        });
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={22} color={ui.colors.textMuted} />
                    </Pressable>
                  </View>
                );
              })}
              <SearchableSelect
                label={tournamentVenueClubIds.length ? 'Agregar otra sede' : 'Elegir sede'}
                placeholder="Buscá un club registrado"
                value={null}
                options={clubOptions.filter((c) => !tournamentVenueClubIds.includes(c.value))}
                onChange={(clubId) => {
                  if (!clubId) return;
                  setTournamentVenueClubIds((prev) => {
                    if (prev.includes(clubId)) return prev;
                    const next = [...prev, clubId];
                    setTournamentClubId(next[0] ?? null);
                    return next;
                  });
                }}
                emptyMessage={
                  tournamentVenueClubIds.length
                    ? 'No hay más clubs para agregar'
                    : 'No hay clubs registrados'
                }
              />
              <InputField label="Nombre" value={tournamentName} onChangeText={setTournamentName} />
              {!isInternalDraft ? (
                <InputField
                  label="Descripción"
                  value={tournamentDescription}
                  onChangeText={setTournamentDescription}
                  placeholder="Contá de qué se trata el torneo"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={{ minHeight: 88, paddingTop: 12 }}
                />
              ) : null}
              {!isInternalDraft ? (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textSecondary, marginBottom: 6 }}>
                    Premios
                  </Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 8 }}>
                    Hasta 3 premios (1°, 2° y 3°). Opcional.
                  </Text>
                  {tournamentPrizes.map((prize, index) => (
                    <View key={`prize-${index}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <InputField
                          label={`${index + 1}° puesto`}
                          value={prize}
                          onChangeText={(text) => {
                            setTournamentPrizes((prev) => {
                              const next = [...prev];
                              next[index] = text;
                              return next;
                            });
                          }}
                          placeholder={
                            index === 0
                              ? 'Ej. Trofeo + $50.000'
                              : index === 1
                                ? 'Ej. Medallas + $25.000'
                                : 'Ej. Gift card del club'
                          }
                        />
                      </View>
                      {tournamentPrizes.length > 1 ? (
                        <Pressable
                          onPress={() => {
                            setTournamentPrizes((prev) => prev.filter((_, i) => i !== index));
                          }}
                          hitSlop={8}
                          style={{
                            marginTop: 30,
                            width: 40,
                            height: 48,
                            borderRadius: ui.radius.md,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: ui.colors.dangerSoft,
                          }}
                        >
                          <Ionicons name="trash-outline" size={18} color={ui.colors.danger} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                  {tournamentPrizes.length < 3 ? (
                    <PrimaryButton
                      label={`Agregar premio (${tournamentPrizes.length}/3)`}
                      variant="ghost"
                      size="sm"
                      fullWidth
                      onPress={() => setTournamentPrizes((prev) => [...prev, ''])}
                      style={{ marginBottom: 12 }}
                    />
                  ) : null}
                  <OptionChips
                    label="Modo de categoría"
                    options={CATEGORY_MODE_OPTIONS.map((o) => o.label)}
                    selected={CATEGORY_MODE_OPTIONS.find((o) => o.value === categoryMode)?.label}
                    onSelect={(label) => {
                      const next = CATEGORY_MODE_OPTIONS.find((o) => o.label === label)?.value ?? 'FIXED';
                      setCategoryMode(next);
                      setTournamentCategory('');
                      setSumCap(null);
                    }}
                  />
                  {categoryMode === 'FIXED' ? (
                    <OptionChips
                      label="Categoría"
                      options={FIXED_CATEGORY_OPTIONS}
                      selected={tournamentCategory}
                      onSelect={setTournamentCategory}
                      horizontal
                    />
                  ) : (
                    <OptionChips
                      label="Tope de suma"
                      options={SUM_CATEGORY_OPTIONS}
                      selected={sumCap != null ? formatSumCategory(sumCap) : ''}
                      onSelect={(value) => {
                        const cap = parseInt(value.replace(/^Suma\s+/i, ''), 10);
                        if (isSumCategoryCap(cap)) setSumCap(cap);
                      }}
                    />
                  )}
                  <OptionChips
                    label="Tipo"
                    options={TOURNAMENT_TYPE_OPTIONS}
                    selected={tournamentType}
                    onSelect={setTournamentType}
                  />
                </>
              ) : null}
              {!isInternalDraft ? (
                <OptionChips
                  label="Calendario"
                  options={TOURNAMENT_SCHEDULE_OPTIONS.map((o) => o.label)}
                  selected={
                    TOURNAMENT_SCHEDULE_OPTIONS.find((o) => o.value === tournamentScheduleType)?.label
                  }
                  onSelect={(label) => {
                    const next =
                      TOURNAMENT_SCHEDULE_OPTIONS.find((o) => o.label === label)?.value ??
                      'SINGLE_DAY';
                    setTournamentScheduleType(next);
                  }}
                />
              ) : null}

              {!isInternalDraft ? (
                <>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>Formato</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {TOURNAMENT_FORMATS.map((fmt) => (
                      <PrimaryButton
                        key={fmt.value}
                        label={fmt.label}
                        size="sm"
                        variant={tournamentFormat === fmt.value ? 'primary' : 'ghost'}
                        onPress={() => setTournamentFormat(fmt.value)}
                      />
                    ))}
                  </View>
                </>
              ) : null}
              {tournamentScheduleType === 'SINGLE_DAY' ? (
                <>
                  <DateTimeField
                    label="Día del torneo *"
                    mode="date"
                    value={tournamentStartDate}
                    onChange={setTournamentStartDate}
                    minimumDate={new Date()}
                  />
                  <DateTimeField
                    label="Hora de inicio *"
                    mode="time"
                    value={tournamentStartTime}
                    onChange={setTournamentStartTime}
                  />
                </>
              ) : (
                <>
                  <DateTimeField
                    label="Primera fecha (opcional)"
                    mode="date"
                    value={tournamentStartDate}
                    onChange={setTournamentStartDate}
                    minimumDate={new Date()}
                  />
                  {tournamentStartDate ? (
                    <DateTimeField
                      label="Hora (opcional)"
                      mode="time"
                      value={tournamentStartTime}
                      onChange={setTournamentStartTime}
                    />
                  ) : null}
                </>
              )}
              {!isInternalDraft ? (
                <>
                  <InputField label="Máx. equipos" value={tournamentMaxTeams} onChangeText={setTournamentMaxTeams} keyboardType="number-pad" />
                  <MoneyInputField
                    label="Valor de inscripción"
                    value={tournamentPrice}
                    onChangeText={setTournamentPrice}
                    placeholder="0"
                    hint="Monto por jugador. 0 si es gratuito."
                  />
                  {parseMoneyInput(tournamentPrice) > 0 ? (
                    <>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: ui.colors.textSecondary,
                          marginBottom: 6,
                        }}
                      >
                        Medios de pago
                      </Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 8 }}>
                        Elegí uno o ambos. Transferencia pide CBU/CVU o alias.
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        <PrimaryButton
                          label="Transferencia"
                          size="sm"
                          variant={acceptTransfer ? 'primary' : 'ghost'}
                          onPress={() => setAcceptTransfer((v) => !v)}
                        />
                        <PrimaryButton
                          label="Mercado Pago"
                          size="sm"
                          variant={acceptMercadopago ? 'primary' : 'ghost'}
                          onPress={() => setAcceptMercadopago((v) => !v)}
                        />
                      </View>
                      {acceptTransfer ? (
                        <>
                          <InputField
                            label="CBU / CVU"
                            value={transferCbu}
                            onChangeText={setTransferCbu}
                            placeholder="0000003100010000000001"
                            keyboardType="number-pad"
                            autoCapitalize="none"
                          />
                          <InputField
                            label="Alias"
                            value={transferAlias}
                            onChangeText={setTransferAlias}
                            placeholder="mi.alias.mp"
                            autoCapitalize="none"
                          />
                          <InputField
                            label="Titular (opcional)"
                            value={transferHolderName}
                            onChangeText={setTransferHolderName}
                            placeholder="Nombre del titular de la cuenta"
                          />
                        </>
                      ) : null}
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: ui.colors.textSecondary,
                          marginBottom: 6,
                        }}
                      >
                        Devolución si se bajan
                      </Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 8 }}>
                        Si la pareja se baja hasta {WITHDRAW_REFUND_NOTICE_HOURS} h antes, se le devuelve la
                        inscripción. Mercado Pago se reembolsa solo; las transferencias las devolvés vos.
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        <PrimaryButton
                          label="Devolver"
                          size="sm"
                          variant={refundOnWithdraw ? 'primary' : 'ghost'}
                          onPress={() => setRefundOnWithdraw(true)}
                        />
                        <PrimaryButton
                          label="No devolver"
                          size="sm"
                          variant={!refundOnWithdraw ? 'primary' : 'ghost'}
                          onPress={() => setRefundOnWithdraw(false)}
                        />
                      </View>
                    </>
                  ) : null}
                </>
              ) : null}
              <InputField label="Canchas disponibles" value={tournamentCourts} onChangeText={setTournamentCourts} keyboardType="number-pad" />
              {!isInternalDraft ? (
                <TournamentFlyerField
                  previewUri={tournamentFlyer?.uri}
                  onPress={() =>
                    showFlyerPickerOptions({
                      hasFlyer: !!tournamentFlyer,
                      onPick: async (source) => {
                        const picked = await pickTournamentFlyer(source);
                        if (picked) setTournamentFlyer(picked);
                      },
                      onRemove: () => setTournamentFlyer(null),
                    })
                  }
                  onClear={() => setTournamentFlyer(null)}
                />
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton label="Cancelar" variant="ghost" fullWidth onPress={() => {
                    setShowCreateTournament(false);
                    setTournamentFlyer(null);
                    setTournamentDescription('');
                    setTournamentPrizes(['']);
                    setTournamentVenueClubIds([]);
                    setTournamentClubId(null);
                    setAcceptTransfer(false);
                    setAcceptMercadopago(true);
                    setTransferCbu('');
                    setTransferAlias('');
                    setTransferHolderName('');
                  }} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={tournamentModality === 'EXTERNAL' ? 'Enviar a validación' : 'Crear y armar parejas'}
                    fullWidth
                    loading={createTournamentMutation.isPending}
                    onPress={() => {
                      if (!tournamentName.trim()) {
                        Alert.alert('Falta el nombre', 'Ingresá un nombre para el torneo.');
                        return;
                      }
                      if (tournamentModality === 'EXTERNAL' && tournamentVenueClubIds.length === 0) {
                        Alert.alert('Falta la sede', 'Elegí al menos un club sede para el torneo externo.');
                        return;
                      }
                      if (!isInternalDraft && categoryMode === 'FIXED' && !tournamentCategory) {
                        Alert.alert('Falta la categoría', 'Elegí la categoría del torneo.');
                        return;
                      }
                      if (!isInternalDraft && categoryMode === 'SUM' && sumCap == null) {
                        Alert.alert('Falta el tope', 'Elegí un tope de suma (3 a 15).');
                        return;
                      }
                      if (!isInternalDraft && !tournamentType) {
                        Alert.alert('Falta el tipo', 'Elegí Masculino, Femenino o Mixto.');
                        return;
                      }
                      if (tournamentScheduleType === 'SINGLE_DAY' && !tournamentStartDate) {
                        Alert.alert('Falta el día', 'Un torneo de un día necesita fecha.');
                        return;
                      }
                      if (tournamentScheduleType === 'SINGLE_DAY' && !tournamentStartTime) {
                        Alert.alert('Falta la hora', 'Un torneo de un día necesita hora de inicio.');
                        return;
                      }
                      const priceNum = isInternalDraft ? 0 : parseMoneyInput(tournamentPrice);
                      if (priceNum > 0 && !acceptTransfer && !acceptMercadopago) {
                        Alert.alert(
                          'Medio de pago',
                          'Con inscripción paga elegí transferencia, Mercado Pago o ambos.',
                        );
                        return;
                      }
                      if (acceptTransfer && priceNum > 0 && !transferCbu.trim() && !transferAlias.trim()) {
                        Alert.alert(
                          'Datos de transferencia',
                          'Cargá al menos CBU/CVU o alias para cobrar por transferencia.',
                        );
                        return;
                      }
                      createTournamentMutation.mutate();
                    }}
                  />
                </View>
              </View>
            </AppCard>
          ) : (
            <PrimaryButton label="Crear nuevo torneo" variant="outline" fullWidth onPress={() => setShowCreateTournament(true)} style={{ marginBottom: 16 }} />
          )}
          <SectionHeader title="Mis torneos" subtitle={`${tournamentList.length} torneos`} dark />
          <View style={{ gap: 12 }}>
            {tournamentList.map((t) => {
              const closed = isTournamentClosed(t);
              return (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  ctaLabel={closed ? 'Ver resultados' : 'Gestionar'}
                  onPress={() =>
                    router.push((closed ? `/tournament/${t.id}` : `/tournament/${t.id}/manage`) as any)
                  }
                />
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}
