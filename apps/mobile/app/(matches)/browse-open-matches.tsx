import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { formatDistanceKm, requestPlayerCoordinates } from '@/lib/geolocation';
import { mapMatch } from '@/lib/mappers';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  EmptyState,
  SegmentedControl,
  OpenMatchCard,
} from '@/components/x4match';

const RADIUS_OPTIONS = [
  { value: '5', label: '5 km' },
  { value: '15', label: '15 km' },
  { value: '30', label: '30 km' },
  { value: '50', label: '50 km' },
] as const;

export default function BrowseOpenMatchesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [radiusKm, setRadiusKm] = useState('30');
  const [locationFilter, setLocationFilter] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await requestPlayerCoordinates();
      if (!cancelled && current) {
        setCoords({ lat: current.latitude, lng: current.longitude });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['matches-open', radiusKm, locationFilter.trim(), coords?.lat, coords?.lng],
    queryFn: async () => {
      const res = await api.get('/matches/open', {
        params: {
          radiusKm: Number(radiusKm),
          location: locationFilter.trim() || undefined,
          lat: coords?.lat,
          lng: coords?.lng,
        },
      });
      return {
        category: String(res.data?.category || user?.levelCategory || ''),
        radiusKm: res.data?.radiusKm ?? null,
        matches: ((res.data?.matches || []) as unknown[]).map(mapMatch),
      };
    },
  });

  const matches = data?.matches ?? [];
  const category = data?.category || user?.levelCategory || '—';

  const listHeader = useMemo(
    () => (
      <View style={{ gap: 12, marginBottom: 12 }}>
        <AppCard padding="sm">
          <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>
            Categoría: <Text style={{ color: ui.colors.primary, fontWeight: '700' }}>{category}</Text>
            {coords ? ' · ordenados por cercanía' : ' · activá ubicación para ordenar por distancia'}
          </Text>
        </AppCard>

        <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textSecondary }}>Distancia</Text>
        <SegmentedControl
          options={[...RADIUS_OPTIONS]}
          value={radiusKm}
          onChange={setRadiusKm}
        />

        <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textSecondary }}>Ubicación</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: ui.colors.surface2,
            borderRadius: ui.radius.md,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="search" size={16} color={ui.colors.textMuted} />
          <TextInput
            value={locationFilter}
            onChangeText={setLocationFilter}
            placeholder="Filtrar por ubicación o club"
            placeholderTextColor={ui.colors.textMuted}
            style={{ flex: 1, color: ui.colors.textPrimary, fontSize: 14, padding: 0 }}
          />
        </View>
      </View>
    ),
    [category, coords, radiusKm, locationFilter],
  );

  return (
    <Screen>
      <StackHeader title="Partidos abiertos" />
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: ui.spacing.md, paddingBottom: 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          isLoading ? (
            <Text style={{ color: ui.colors.textMuted, textAlign: 'center', marginTop: 24 }}>
              Buscando partidos…
            </Text>
          ) : (
            <EmptyState
              icon={<Ionicons name="tennisball-outline" size={28} color={ui.colors.textMuted} />}
              title="No hay partidos abiertos"
              description={
                coords
                  ? `No encontramos partidos de ${category} en ${radiusKm} km. Probá ampliar el radio u otra ubicación.`
                  : `No hay partidos abiertos de ${category} por ahora.`
              }
            />
          )
        }
        renderItem={({ item }) => {
          const distance = formatDistanceKm(item.distanceKm);
          return (
            <OpenMatchCard
              match={item}
              width="100%"
              viewerUserId={user?.id}
              style={{ marginBottom: 12 }}
              onPress={() => router.push(`/match/${item.id}` as any)}
              ctaLabel={distance ? `Unirse · ${distance}` : 'Unirse a Partido'}
            />
          );
        }}
      />
    </Screen>
  );
}
