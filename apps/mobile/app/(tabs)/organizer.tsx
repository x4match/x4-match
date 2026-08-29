import { useEffect, useState, useCallback } from 'react';
import { ScrollView, Text, View, Alert, Keyboard } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { canOrganizeEvents } from '@/lib/roles';
import { mapTournament, extractCircuitId, isCircuitOwner, safeMapCircuit } from '@/lib/mappers';
import type { Circuit, Tournament } from '@/lib/types';
import { createTournament, fetchMyTournaments } from '@/lib/tournament/api';
import {
  TOURNAMENT_FORMATS,
  TOURNAMENT_TYPE_OPTIONS,
  TOURNAMENT_MODALITY_OPTIONS,
  FIXED_CATEGORY_OPTIONS,
  SUM_CATEGORY_OPTIONS,
  CATEGORY_MODE_OPTIONS,
  formatSumCategory,
  isSumCategoryCap,
  modalityLabel,
  clubValidationLabel,
  type TournamentCategoryMode,
  type TournamentModality,
  type SumCategoryCap,
} from '@/lib/tournament/types';
import {
  pickTournamentFlyer,
  showFlyerPickerOptions,
  uploadTournamentFlyer,
  type PickedFlyer,
} from '@/lib/tournament-flyer';
import { toLocalDateString } from '@/lib/format';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  AppHeader,
  AppCard,
  SectionHeader,
  PrimaryButton,
  InputField,
  OptionChips,
  DateTimeField,
  EmptyState,
  StatusPill,
  SearchableSelect,
  TournamentFlyerField,
} from '@/components/padely';

export default function OrganizerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<'tournaments' | 'circuits'>('tournaments');
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentModality, setTournamentModality] = useState<TournamentModality>('INTERNAL');
  const [tournamentClubId, setTournamentClubId] = useState<string | null>(null);
  const [categoryMode, setCategoryMode] = useState<TournamentCategoryMode>('FIXED');
  const [tournamentCategory, setTournamentCategory] = useState('');
  const [sumCap, setSumCap] = useState<SumCategoryCap | null>(null);
  const [tournamentType, setTournamentType] = useState('');
  const [tournamentMaxTeams, setTournamentMaxTeams] = useState('16');
  const [tournamentFormat, setTournamentFormat] = useState<string>('GROUPS_THEN_ELIMINATION');
  const [tournamentPrice, setTournamentPrice] = useState('0');
  const [tournamentCourts, setTournamentCourts] = useState('4');
  const [tournamentStartDate, setTournamentStartDate] = useState<Date | null>(null);
  const [tournamentFlyer, setTournamentFlyer] = useState<PickedFlyer | null>(null);
  const [showCreateCircuit, setShowCreateCircuit] = useState(false);
  const [circuitName, setCircuitName] = useState('');
  const [circuitSeason, setCircuitSeason] = useState('');
  const [circuitDescription, setCircuitDescription] = useState('');

  const [creatingCircuit, setCreatingCircuit] = useState(false);

  useEffect(() => {
    if (params.create === 'tournament') {
      setTab('tournaments');
      setShowCreateTournament(true);
    }
  }, [params.create]);

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
      return res.data as { id: string; name: string; city?: string; zone?: string }[];
    },
    enabled: canManageEvents && showCreateTournament && tournamentModality === 'EXTERNAL',
  });

  const { data: circuits } = useQuery({
    queryKey: ['organizer-circuits-mine', user?.id],
    queryFn: async () => {
      const res = await api.get('/circuits');
      const rows = Array.isArray(res.data) ? res.data : [];
      return rows.filter((c) => isCircuitOwner(c as Record<string, unknown>, user?.id));
    },
    enabled: canManageEvents && !!user?.id,
  });

  const handleCreateCircuit = useCallback(async () => {
    const savedName = circuitName.trim();
    const savedSeason = circuitSeason.trim();
    const savedDescription = circuitDescription.trim();

    if (!savedName) {
      Alert.alert('Falta el nombre', 'Ingresá un nombre para el circuito.');
      return;
    }

    Keyboard.dismiss();
    setCreatingCircuit(true);

    try {
      const payload: { name: string; season?: string; description?: string } = { name: savedName };
      if (savedSeason) payload.season = savedSeason;
      if (savedDescription) payload.description = savedDescription;

      const res = await api.post('/circuits', payload);
      const circuitId = extractCircuitId(res.data);

      setCreatingCircuit(false);
      setCircuitName('');
      setCircuitSeason('');
      setCircuitDescription('');
      setShowCreateCircuit(false);

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['organizer-circuits-mine'] });
        queryClient.invalidateQueries({ queryKey: ['circuits-tab'] });
      }, 0);

      if (!circuitId) {
        Alert.alert('Listo', 'Circuito creado. Configuralo desde la lista.');
        return;
      }

      Alert.alert('Circuito creado', `“${savedName}” quedó guardado como borrador.`, [
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
  }, [circuitName, circuitSeason, circuitDescription, queryClient, router]);

  const resolvedTournamentCategory =
    categoryMode === 'SUM' && sumCap != null ? formatSumCategory(sumCap) : tournamentCategory;

  const createTournamentMutation = useMutation({
    mutationFn: async () => {
      const created = await createTournament({
        name: tournamentName,
        modality: tournamentModality,
        clubId: tournamentModality === 'EXTERNAL' ? tournamentClubId || undefined : undefined,
        category: resolvedTournamentCategory || undefined,
        gender: tournamentType || undefined,
        maxTeams: Number(tournamentMaxTeams) || 16,
        format: tournamentFormat,
        price: Number(tournamentPrice) || 0,
        courtsAvailable: Number(tournamentCourts) || 4,
        startDate: tournamentStartDate
          ? new Date(`${toLocalDateString(tournamentStartDate)}T00:00:00`).toISOString()
          : undefined,
      });
      if (tournamentFlyer) {
        try {
          await uploadTournamentFlyer(created.id, tournamentFlyer.dataUrl);
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
      setTournamentModality('INTERNAL');
      setTournamentClubId(null);
      setCategoryMode('FIXED');
      setTournamentCategory('');
      setSumCap(null);
      setTournamentType('');
      setTournamentStartDate(null);
      setTournamentFlyer(null);
      setShowCreateTournament(false);
      queryClient.invalidateQueries({ queryKey: ['organizer-tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['organizer-tournaments-mine'] });
      router.push(`/tournament/${created.id}/manage` as any);
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo crear el torneo'),
  });

  if (!canManageEvents) {
    return (
      <Screen>
        <AppHeader title="Gestión" />
        <EmptyState
          icon={<Ionicons name="shield-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
          description="Iniciá sesión como jugador para crear torneos y circuitos."
          action={<PrimaryButton label="Volver al inicio" onPress={() => router.replace('/(tabs)/home')} />}
        />
      </Screen>
    );
  }

  const tournamentList: Tournament[] = (tournaments || []).map(mapTournament);
  const circuitList: Circuit[] = (circuits || [])
    .map((row) => safeMapCircuit(row))
    .filter((circuit): circuit is Circuit => circuit != null && Boolean(circuit.id));
  const clubOptions = (clubs || []).map((c) => ({
    value: c.id,
    label: c.name,
    subtitle: [c.city, c.zone].filter(Boolean).join(' · ') || undefined,
  }));

  return (
    <Screen>
      <AppHeader title="Panel de organización" />
      <ScrollView
        contentContainerStyle={{ ...tabScreenPadding }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {(
            [
              { key: 'tournaments' as const, label: 'Torneos' },
              { key: 'circuits' as const, label: 'Circuitos' },
            ] as const
          ).map(({ key, label }) => (
            <View key={key} style={{ flex: 1 }}>
              <PrimaryButton
                label={label}
                onPress={() => setTab(key)}
                variant={tab === key ? 'primary' : 'ghost'}
                fullWidth
                size="sm"
                style={tab !== key ? { backgroundColor: ui.colors.surface } : undefined}
              />
            </View>
          ))}
        </View>

        {tab === 'circuits' && (
          <>
            {showCreateCircuit ? (
              <AppCard>
                <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary, marginBottom: 12 }}>
                  Crear circuito
                </Text>
                <InputField label="Nombre *" value={circuitName} onChangeText={setCircuitName} placeholder="Circuito Verano 2025" />
                <InputField label="Temporada" value={circuitSeason} onChangeText={setCircuitSeason} placeholder="Verano 2025" />
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
                      backgroundColor: 'rgba(20,184,166,0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="git-network" size={24} color={ui.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{c.name}</Text>
                    {c.season ? (
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>{c.season}</Text>
                    ) : null}
                  </View>
                  <StatusPill status={c.status} />
                  <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                </View>
              </AppCard>
            ))}
          </>
        )}

        {tab === 'tournaments' && (
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
                    if (next === 'INTERNAL') setTournamentClubId(null);
                  }}
                />
                {tournamentModality === 'EXTERNAL' ? (
                  <SearchableSelect
                    label="Club sede"
                    placeholder="Elegí un club registrado"
                    value={tournamentClubId}
                    options={clubOptions}
                    onChange={setTournamentClubId}
                    emptyMessage="No hay clubs registrados"
                  />
                ) : (
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 12 }}>
                    Solo vos y tus invitados van a poder verlo. Después podés invitar jugadores o compartir el link.
                  </Text>
                )}
                <InputField label="Nombre" value={tournamentName} onChangeText={setTournamentName} />
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
                <DateTimeField
                  label="Fecha de inicio"
                  mode="date"
                  value={tournamentStartDate}
                  onChange={setTournamentStartDate}
                  minimumDate={new Date()}
                />
                <InputField label="Máx. equipos" value={tournamentMaxTeams} onChangeText={setTournamentMaxTeams} keyboardType="number-pad" />
                <InputField label="Costo inscripción ($, 0 = gratis)" value={tournamentPrice} onChangeText={setTournamentPrice} keyboardType="number-pad" />
                <InputField label="Canchas disponibles" value={tournamentCourts} onChangeText={setTournamentCourts} keyboardType="number-pad" />
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
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton label="Cancelar" variant="ghost" fullWidth onPress={() => {
                      setShowCreateTournament(false);
                      setTournamentFlyer(null);
                    }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      label={tournamentModality === 'EXTERNAL' ? 'Enviar a validación' : 'Crear e invitar'}
                      fullWidth
                      loading={createTournamentMutation.isPending}
                      onPress={() => {
                        if (!tournamentName.trim()) {
                          Alert.alert('Falta el nombre', 'Ingresá un nombre para el torneo.');
                          return;
                        }
                        if (tournamentModality === 'EXTERNAL' && !tournamentClubId) {
                          Alert.alert('Falta el club', 'Elegí el club que va a validar el torneo.');
                          return;
                        }
                        if (categoryMode === 'FIXED' && !tournamentCategory) {
                          Alert.alert('Falta la categoría', 'Elegí la categoría del torneo.');
                          return;
                        }
                        if (categoryMode === 'SUM' && sumCap == null) {
                          Alert.alert('Falta el tope', 'Elegí un tope de suma (3 a 15).');
                          return;
                        }
                        if (!tournamentType) {
                          Alert.alert('Falta el tipo', 'Elegí Masculino, Femenino o Mixto.');
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
            {tournamentList.map((t) => (
              <AppCard key={t.id} onPress={() => router.push(`/tournament/${t.id}` as any)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
                    <Ionicons name="trophy" size={24} color={ui.colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{t.name}</Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                        {[modalityLabel(t.modality), clubValidationLabel(t.clubValidationStatus)]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  </View>
                  <StatusPill status={t.status} />
                </View>
              </AppCard>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
