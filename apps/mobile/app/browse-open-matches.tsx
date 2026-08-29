import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { formatMatchSchedule } from '@/lib/format';
import { formatDistanceKm, requestPlayerCoordinates } from '@/lib/geolocation';
import { mapMatch } from '@/lib/mappers';
import { formatSkillRange } from '@/lib/skill';
import type { Match } from '@/lib/types';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  EmptyState,
  StatusPill,
  SegmentedControl,
} from '@/components/padely';

const RADIUS_OPTIONS = [
  { value: '5', label: '5 km' },
  { value: '15', label: '15 km' },
  { value: '30', label: '30 km' },
  { value: '50', label: '50 km' },
] as const;

function courtBookingLabel(match: Match): string {
  if (match.courtBooking === 'in_app') return 'Cancha en app';
  if (match.courtBooking === 'external') return 'Reserva externa';
  return 'Sin cancha';
}

export default function BrowseOpenMatchesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [radiusKm, setRadiusKm] = useState('30');
  const [zoneFilter, setZoneFilter] = useState('');
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
    queryKey: ['matches-open', radiusKm, zoneFilter.trim(), coords?.lat, coords?.lng],
    queryFn: async () => {
      const res = await api.get('/matches/open', {
        params: {
          radiusKm: Number(radiusKm),
          zone: zoneFilter.trim() || undefined,
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

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: ui.colors.surface1,
            borderRadius: ui.radius.md,
            borderWidth: 1,
            borderColor: ui.colors.border,
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="location-outline" size={18} color={ui.colors.textMuted} />
          <TextInput
            value={zoneFilter}
            onChangeText={setZoneFilter}
            placeholder="Filtrar por zona o ubicación"
            placeholderTextColor={ui.colors.textMuted}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 10,
              fontSize: 15,
              color: ui.colors.textPrimary,
            }}
          />
          {zoneFilter ? (
            <TouchableOpacity onPress={() => setZoneFilter('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={ui.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    ),
    [category, coords, radiusKm, zoneFilter],
  );

  return (
    <Screen swipeBack>
      <StackHeader title="Buscar partidos" />
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 120, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor={ui.colors.primary}
          />
        }
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
                  ? `No encontramos partidos de ${category} en ${radiusKm} km. Probá ampliar el radio o otra zona.`
                  : `No hay partidos abiertos de ${category} por ahora.`
              }
            />
          )
        }
        renderItem={({ item }) => {
          const distance = formatDistanceKm(item.distanceKm);
          const spots = Math.max(0, item.neededPlayers - item.joinedCount);
          return (
            <TouchableOpacity
              onPress={() => router.push(`/match/${item.id}` as any)}
              style={{ marginBottom: 12 }}
            >
              <AppCard>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 16,
                      fontWeight: '700',
                      color: ui.colors.textPrimary,
                    }}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <StatusPill status={item.status} size="sm" />
                </View>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 8 }}>
                  {formatMatchSchedule(item.date, item.endsAt)}
                </Text>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 4 }}>
                  {[item.club?.name, item.zone || item.venueNote].filter(Boolean).join(' · ') ||
                    courtBookingLabel(item)}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12, color: ui.colors.primary, fontWeight: '600' }}>
                    {spots === 1 ? '1 lugar' : `${spots} lugares`}
                  </Text>
                  {item.levelMin != null && item.levelMax != null ? (
                    <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>
                      {formatSkillRange(item.levelMin, item.levelMax)}
                    </Text>
                  ) : null}
                  {distance ? (
                    <Text style={{ fontSize: 12, color: ui.colors.accent, fontWeight: '700' }}>
                      {distance}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>
                    {courtBookingLabel(item)}
                  </Text>
                </View>
              </AppCard>
            </TouchableOpacity>
          );
        }}
      />
    </Screen>
  );
}
