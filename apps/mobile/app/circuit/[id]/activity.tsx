import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiErrorMessage } from '@/lib/circuits/staff';
import { auditIcon, fetchCircuitActivity, type AuditEntry } from '@/lib/circuits/organizer';
import { ui } from '@/theme/tokens';
import { EmptyState, Screen, StackHeader, withCircuitsEnabled } from '@/components/x4match';

const PAGE = 40;

function formatWhen(value: string) {
  const d = new Date(value);
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function Row({ entry }: { entry: AuditEntry }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: ui.colors.border,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: ui.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={auditIcon(entry.action)} size={17} color={ui.colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: ui.colors.textPrimary, fontSize: 14, lineHeight: 19 }}>{entry.summary}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {entry.actor_name ? (
            <>
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>{entry.actor_name}</Text>
              <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>·</Text>
            </>
          ) : null}
          <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>{formatWhen(entry.created_at)}</Text>
        </View>
      </View>
    </View>
  );
}

export default withCircuitsEnabled(CircuitActivityScreen);

function CircuitActivityScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const circuitId = Array.isArray(rawId) ? rawId[0] : rawId;

  const { data, isLoading, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['circuit-activity', circuitId],
      queryFn: ({ pageParam }) => fetchCircuitActivity(circuitId!, { before: pageParam, limit: PAGE }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => (last.length < PAGE ? undefined : last[last.length - 1]?.created_at),
      enabled: !!circuitId,
    });
  const entries = data?.pages.flat() ?? [];

  return (
    <Screen>
      <StackHeader title="Historial de acciones" />
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <Row entry={item} />}
        contentContainerStyle={{ paddingHorizontal: ui.spacing.lg, paddingBottom: 120 }}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
        ListHeaderComponent={
          <Text style={{ fontSize: 13, color: ui.colors.textSecondary, paddingVertical: 12 }}>
            Quién hizo qué en el circuito: inscripciones, zonas, resultados, horarios, padrón y staff.
          </Text>
        }
        ListEmptyComponent={
          isLoading ? (
            <Text style={{ color: ui.colors.textMuted }}>Cargando...</Text>
          ) : (
            <EmptyState
              icon={<Ionicons name="time-outline" size={32} color={ui.colors.textMuted} />}
              title={error ? 'No disponible' : 'Sin actividad todavía'}
              description={error ? apiErrorMessage(error, 'No tenés acceso al historial') : undefined}
            />
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <Text style={{ color: ui.colors.textMuted, textAlign: 'center', paddingVertical: 12 }}>Cargando más...</Text>
          ) : null
        }
      />
    </Screen>
  );
}
