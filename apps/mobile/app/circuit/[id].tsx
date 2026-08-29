import {
  ScrollView,
  Text,
  View,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { safeMapCircuit, isCircuitOwner } from '@/lib/mappers';
import { formatDateRange } from '@/lib/format';
import { canOrganizeEvents } from '@/lib/roles';
import { FIXED_CATEGORY_OPTIONS, CIRCUIT_CATEGORY_GENDER_OPTIONS, formatCircuitCategory, type CircuitCategoryGender } from '@/lib/tournament/types';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, SectionHeader, StatusPill, EmptyState, InputField, PrimaryButton } from '@/components/padely';

const iconBoxPrimary = {
  width: 56,
  height: 56,
  borderRadius: 14,
  backgroundColor: 'rgba(20,184,166,0.12)',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const iconBoxSm = {
  width: 48,
  height: 48,
  borderRadius: 12,
  backgroundColor: 'rgba(20,184,166,0.12)',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

function circuitCategoryKey(label: string, gender?: string | null) {
  return `${label.trim().toLowerCase()}|${(gender ?? '').trim().toLowerCase()}`;
}

export default function CircuitDetailScreen() {
  const { id: rawId, categoryId } = useLocalSearchParams<{ id: string; categoryId?: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const circuitId = id && id !== 'undefined' && id !== 'null' ? id : null;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(categoryId ?? null);
  const [selectedPresetCategories, setSelectedPresetCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState('');
  const [categoryModality, setCategoryModality] = useState<CircuitCategoryGender | ''>('');
  const [stageClubId, setStageClubId] = useState('');
  const [stageStart, setStageStart] = useState('');
  const [stageCategoryId, setStageCategoryId] = useState('');

  useEffect(() => {
    if (categoryId) {
      setSelectedCategoryId(categoryId);
    }
  }, [categoryId]);

  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['circuit', circuitId],
    queryFn: async () => {
      const res = await api.get(`/circuits/${circuitId}`);
      return res.data;
    },
    enabled: !!circuitId,
  });

  const circuit = useMemo(() => safeMapCircuit(data), [data]);
  const existingCategoryKeys = useMemo(() => {
    const keys = new Set<string>();
    circuit?.categories?.forEach((cat) => keys.add(circuitCategoryKey(cat.label, cat.gender)));
    return keys;
  }, [circuit?.categories]);
  const isOrganizer =
    !!user?.id &&
    canOrganizeEvents(user.role) &&
    ((data && isCircuitOwner(data as Record<string, unknown>, user.id)) || user.role === 'SUPER_ADMIN');

  const { data: clubs = [] } = useQuery({
    queryKey: ['clubs-for-circuit'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: isOrganizer,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['circuit', circuitId] });
    queryClient.invalidateQueries({ queryKey: ['circuits-tab'] });
    queryClient.invalidateQueries({ queryKey: ['organizer-circuits-mine'] });
  };

  const addCategories = useMutation({
    mutationFn: async (items: { label: string; gender: CircuitCategoryGender }[]) => {
      for (const item of items) {
        await api.post(`/circuits/${circuitId}/categories`, item);
      }
    },
    onSuccess: () => {
      setSelectedPresetCategories([]);
      setCustomCategory('');
      invalidate();
      refetch();
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo agregar la categoría'),
  });

  const togglePresetCategory = useCallback((option: string) => {
    setSelectedPresetCategories((prev) =>
      prev.includes(option) ? prev.filter((value) => value !== option) : [...prev, option],
    );
  }, []);

  const handleAddCategories = useCallback(() => {
    if (!categoryModality) {
      Alert.alert('Falta la modalidad', 'Elegí Caballeros o Damas.');
      return;
    }

    const custom = customCategory.trim();
    const labels = [...selectedPresetCategories, ...(custom ? [custom] : [])]
      .map((label) => label.trim())
      .filter(Boolean)
      .filter((label, index, arr) => arr.findIndex((item) => item.toLowerCase() === label.toLowerCase()) === index)
      .filter((label) => !existingCategoryKeys.has(circuitCategoryKey(label, categoryModality)));

    if (labels.length === 0) {
      Alert.alert(
        'Sin categorías nuevas',
        'Elegí al menos una categoría que no exista ya para esta modalidad.',
      );
      return;
    }

    addCategories.mutate(labels.map((label) => ({ label, gender: categoryModality })));
  }, [addCategories, categoryModality, customCategory, existingCategoryKeys, selectedPresetCategories]);

  const addVenue = useMutation({
    mutationFn: async (clubId: string) => api.post(`/circuits/${circuitId}/venues`, { clubId }),
    onSuccess: () => {
      invalidate();
      refetch();
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo agregar la sede'),
  });

  const addStage = useMutation({
    mutationFn: async () => {
      const parsed = new Date(stageStart);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('Fecha inválida');
      }
      return api.post(`/circuits/${circuitId}/stages`, {
        clubId: stageClubId,
        categoryId: stageCategoryId || undefined,
        startDate: parsed.toISOString(),
      });
    },
    onSuccess: () => {
      setStageStart('');
      setStageCategoryId('');
      invalidate();
      refetch();
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo agregar la fecha'),
  });

  const publishCircuit = useMutation({
    mutationFn: async () => api.post(`/circuits/${circuitId}/publish`),
    onSuccess: () => {
      Alert.alert('Listo', 'Circuito publicado');
      invalidate();
      refetch();
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo publicar'),
  });

  const onRefresh = useCallback(() => refetch(), [refetch]);

  const upcomingStages = useMemo(() => {
    if (!circuit?.stages) return [];
    const now = Date.now();
    return circuit.stages
      .filter((s) => new Date(s.startDate).getTime() >= now - 86400000)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [circuit?.stages]);

  const rankings = useMemo(() => {
    if (!circuit?.rankings?.length) return [];
    if (!selectedCategoryId) return circuit.rankings;
    return circuit.rankings.filter((r) => r.categoryId === selectedCategoryId);
  }, [circuit?.rankings, selectedCategoryId]);

  if (!circuitId) {
    return (
      <Screen>
        <StackHeader title="Circuito" />
        <View style={{ padding: ui.spacing.lg }}>
          <EmptyState
            icon={<Ionicons name="git-network-outline" size={32} color={ui.colors.textMuted} />}
            title="Circuito no encontrado"
          />
        </View>
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <StackHeader title="Circuito" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: ui.colors.textMuted }}>Cargando...</Text>
        </View>
      </Screen>
    );
  }

  if (!circuit || isError) {
    return (
      <Screen>
        <StackHeader title="Circuito" />
        <View style={{ padding: ui.spacing.lg }}>
          <EmptyState
            icon={<Ionicons name="git-network-outline" size={32} color={ui.colors.textMuted} />}
            title="Circuito no encontrado"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StackHeader title="Detalle del circuito" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          padding: ui.spacing.lg,
          paddingBottom: 120,
        }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={ui.colors.primary} />}
      >
        <AppCard>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
              <View style={iconBoxPrimary}>
                <Ionicons name="git-network" size={28} color={ui.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.textPrimary }}>{circuit.name}</Text>
                {circuit.season ? (
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>{circuit.season}</Text>
                ) : null}
              </View>
            </View>
            <StatusPill status={circuit.status} size="md" />
          </View>
          {circuit.description ? (
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary, lineHeight: 20 }}>{circuit.description}</Text>
          ) : null}
          {circuit.categories && circuit.categories.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {circuit.categories.map((cat) => (
                <View
                  key={cat.id}
                  style={{
                    backgroundColor: ui.colors.surfaceAlt,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: ui.colors.textInverse }}>
                    {formatCircuitCategory(cat.label, cat.gender)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </AppCard>

        <SectionHeader
          title="Sedes del circuito"
          subtitle={circuit.venues?.length ? `${circuit.venues.length} club${circuit.venues.length !== 1 ? 's' : ''}` : undefined}
        />
        {circuit.venues && circuit.venues.length > 0 ? (
          <AppCard style={{ padding: 0, overflow: 'hidden' }}>
            <View
              style={{
                height: 96,
                backgroundColor: ui.colors.cardMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="map-outline" size={32} color={ui.colors.primary} />
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 6 }}>
                {circuit.venues.length} sede{circuit.venues.length !== 1 ? 's' : ''} en el circuito
              </Text>
            </View>
            <View style={{ padding: ui.spacing.md }}>
              {circuit.venues.map((venue, index) => (
                <TouchableOpacity
                  key={venue.clubId}
                  onPress={() => router.push(`/club/${venue.clubId}` as any)}
                  style={{
                    flexDirection: 'row',
                    gap: 10,
                    marginBottom: index < circuit.venues!.length - 1 ? 14 : 0,
                  }}
                >
                  <Ionicons name="location-outline" size={20} color={ui.colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>{venue.clubName}</Text>
                    <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 2 }}>
                      {[venue.city, venue.zone].filter(Boolean).join(', ') || venue.address || 'Sin ubicación'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, alignSelf: 'center' }}>
                    {venue.stageCount} fecha{venue.stageCount !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </AppCard>
        ) : (
          <AppCard>
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>Sin sedes asignadas todavía.</Text>
          </AppCard>
        )}

        <SectionHeader title="Próximas fechas" />
        {upcomingStages.length === 0 ? (
          <AppCard>
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>No hay fechas programadas por ahora.</Text>
          </AppCard>
        ) : (
          upcomingStages.map((stage) => (
            <AppCard
              key={stage.id}
              onPress={stage.tournamentId ? () => router.push(`/tournament/${stage.tournamentId}` as any) : undefined}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={iconBoxSm}>
                  <Ionicons name="calendar" size={24} color={ui.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{stage.clubName}</Text>
                  {stage.categoryLabel ? (
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: ui.colors.surfaceAlt,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        marginTop: 6,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '600', color: ui.colors.textInverse }}>
                        Cat. {stage.categoryLabel}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 6 }}>
                    {formatDateRange(stage.startDate, stage.endDate)}
                  </Text>
                </View>
                {stage.tournamentId ? (
                  <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                ) : null}
              </View>
            </AppCard>
          ))
        )}

        {circuit.rankings && circuit.rankings.length > 0 && (
          <>
            <SectionHeader title="Ranking del circuito" />
            <AppCard>
              {circuit.categories && circuit.categories.length > 1 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {[{ id: '', label: 'Todas' }, ...circuit.categories].map((cat) => {
                    const active = (selectedCategoryId || '') === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id || 'all'}
                        onPress={() => setSelectedCategoryId(cat.id || null)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: ui.radius.pill,
                          backgroundColor: active ? ui.colors.primary : ui.colors.cardMuted,
                          borderWidth: 1,
                          borderColor: active ? ui.colors.primary : ui.colors.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: active ? '#fff' : ui.colors.textPrimary,
                          }}
                        >
                          {cat.id ? formatCircuitCategory(cat.label, cat.gender) : cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {rankings.slice(0, 20).map((entry, index) => (
                <View
                  key={entry.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: index < Math.min(rankings.length, 20) - 1 ? 1 : 0,
                    borderBottomColor: ui.colors.border,
                    gap: 12,
                  }}
                >
                  <Text style={{ width: 28, fontWeight: '800', fontSize: 15, color: ui.colors.primary }}>
                    {entry.position ?? index + 1}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>{entry.playerName}</Text>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>{entry.categoryLabel}</Text>
                  </View>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{entry.points} pts</Text>
                </View>
              ))}
            </AppCard>
          </>
        )}

        {isOrganizer && (
          <AppCard style={{ backgroundColor: ui.colors.surfaceAlt, marginTop: ui.spacing.md }}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textInverse, marginBottom: 6 }}>
              Panel de gestión
            </Text>
            <Text style={{ fontSize: 13, color: ui.colors.textMuted, marginBottom: 16 }}>
              Configurá categorías, sedes y fechas del circuito.
            </Text>
            {circuit.status === 'DRAFT' && (
              <PrimaryButton
                label="Publicar circuito"
                fullWidth
                loading={publishCircuit.isPending}
                onPress={() => publishCircuit.mutate()}
                style={{ marginBottom: 16 }}
              />
            )}
            <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textInverse, marginBottom: 8 }}>
              Agregar categorías
            </Text>
            <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 10 }}>
              Elegí modalidad, una o varias categorías, o escribí una personalizada.
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textInverse, marginBottom: 8 }}>
              Modalidad *
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {CIRCUIT_CATEGORY_GENDER_OPTIONS.map((option) => {
                const selected = categoryModality === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setCategoryModality(option)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: ui.radius.pill,
                      backgroundColor: selected ? ui.colors.primary : ui.colors.cardMuted,
                      borderWidth: 1,
                      borderColor: selected ? ui.colors.primary : ui.colors.border,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: selected ? '#fff' : ui.colors.textInverse,
                      }}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textInverse, marginBottom: 8 }}>
              Categoría
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {FIXED_CATEGORY_OPTIONS.map((option) => {
                const added = categoryModality
                  ? existingCategoryKeys.has(circuitCategoryKey(option, categoryModality))
                  : false;
                const selected = selectedPresetCategories.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    disabled={added || addCategories.isPending}
                    onPress={() => togglePresetCategory(option)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: ui.radius.pill,
                      backgroundColor: added
                        ? ui.colors.surface
                        : selected
                          ? ui.colors.primary
                          : ui.colors.cardMuted,
                      borderWidth: 1,
                      borderColor: added
                        ? ui.colors.border
                        : selected
                          ? ui.colors.primary
                          : ui.colors.border,
                      opacity: added ? 0.45 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: added
                          ? ui.colors.textMuted
                          : selected
                            ? '#fff'
                            : ui.colors.textInverse,
                      }}
                    >
                      {added ? `${option} · agregada` : option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <InputField
              label="Otra categoría"
              value={customCategory}
              onChangeText={setCustomCategory}
              placeholder="Ej: Suma 8, Mixto, +45..."
            />
            <PrimaryButton
              label={
                selectedPresetCategories.length + (customCategory.trim() ? 1 : 0) > 1
                  ? 'Agregar categorías'
                  : 'Agregar categoría'
              }
              variant="outline"
              fullWidth
              loading={addCategories.isPending}
              onPress={handleAddCategories}
              style={{ marginBottom: 16 }}
            />
            <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textInverse, marginBottom: 8 }}>
              Agregar sede
            </Text>
            {clubs.map((club: any) => {
              const added = circuit.venues?.some((v) => v.clubId === club.id);
              return (
                <TouchableOpacity
                  key={club.id}
                  disabled={added || addVenue.isPending}
                  onPress={() => addVenue.mutate(club.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: ui.colors.surface,
                    opacity: added ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: ui.colors.textInverse, fontWeight: '500' }}>{club.name}</Text>
                  <Text style={{ fontSize: 12, color: added ? ui.colors.textMuted : ui.colors.primary }}>
                    {added ? 'Agregado' : 'Agregar'}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <InputField
              label="Fecha de la etapa"
              value={stageStart}
              onChangeText={setStageStart}
              placeholder="2025-02-15"
              style={{ marginTop: 12 }}
            />
            {circuit.categories && circuit.categories.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>
                {circuit.categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setStageCategoryId(stageCategoryId === cat.id ? '' : cat.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: ui.radius.pill,
                      backgroundColor: stageCategoryId === cat.id ? ui.colors.primary : ui.colors.surface,
                      borderWidth: 1,
                      borderColor: stageCategoryId === cat.id ? ui.colors.primary : ui.colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: stageCategoryId === cat.id ? '#fff' : ui.colors.textInverse,
                      }}
                    >
                      {formatCircuitCategory(cat.label, cat.gender)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textInverse, marginBottom: 8 }}>
              Sede de la fecha
            </Text>
            {(circuit.venues || []).map((v) => (
              <TouchableOpacity
                key={v.clubId}
                onPress={() => setStageClubId(stageClubId === v.clubId ? '' : v.clubId)}
                style={{ paddingVertical: 8 }}
              >
                <Text
                  style={{
                    color: stageClubId === v.clubId ? ui.colors.primary : ui.colors.textInverse,
                    fontWeight: '600',
                  }}
                >
                  {v.clubName}
                </Text>
              </TouchableOpacity>
            ))}
            <PrimaryButton
              label="Agregar fecha al calendario"
              fullWidth
              loading={addStage.isPending}
              onPress={() => {
                if (!stageStart.trim()) {
                  Alert.alert('Falta la fecha', 'Ingresá una fecha (AAAA-MM-DD).');
                  return;
                }
                const parsed = new Date(stageStart);
                if (Number.isNaN(parsed.getTime())) {
                  Alert.alert('Fecha inválida', 'Usá el formato AAAA-MM-DD.');
                  return;
                }
                if (!stageClubId) {
                  Alert.alert('Falta la sede', 'Elegí una sede para la fecha.');
                  return;
                }
                addStage.mutate();
              }}
              style={{ marginTop: 12 }}
            />
          </AppCard>
        )}
      </ScrollView>
    </Screen>
  );
}
