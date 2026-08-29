import { useState } from 'react';
import { View, Text, ScrollView, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { canOrganizeEvents } from '@/lib/roles';
import {
  fetchTournamentDetail,
  fetchRegistrations,
  fetchMatches,
  fetchStandings,
  generateFixture,
  formatScore,
} from '@/lib/tournament/api';
import {
  formatTournamentCategory,
  formatLabel,
  FIXED_CATEGORY_OPTIONS,
} from '@/lib/tournament/types';
import { formatShortDate } from '@/lib/format';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  SectionHeader,
  PrimaryButton,
  EmptyState,
  StatusPill,
  OptionChips,
} from '@/components/padely';

type HubTab = 'overview' | 'teams' | 'fixture' | 'promote';

export default function HistoryTournamentHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = canOrganizeEvents(user?.role);
  const [tab, setTab] = useState<HubTab>('overview');
  const [promoteRegId, setPromoteRegId] = useState<string | null>(null);
  const [promoteTarget, setPromoteTarget] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tournament-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-registrations', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-matches', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-standings', id] });
    queryClient.invalidateQueries({ queryKey: ['organizer-tournaments-mine'] });
  };

  const { data: tournament, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['tournament-detail', id],
    queryFn: () => fetchTournamentDetail(id!),
    enabled: !!id && canManage,
  });
  const isOwnerOrganizer = !!user?.id && tournament?.organizer_user_id === user.id;

  const { data: registrations } = useQuery({
    queryKey: ['tournament-registrations', id],
    queryFn: () => fetchRegistrations(id!),
    enabled: !!id && canManage,
  });

  const { data: matches } = useQuery({
    queryKey: ['tournament-matches', id],
    queryFn: () => fetchMatches(id!),
    enabled: !!id && canManage,
  });

  const { data: standings } = useQuery({
    queryKey: ['tournament-standings', id],
    queryFn: () => fetchStandings(id!),
    enabled: !!id && canManage,
  });

  const fixtureMutation = useMutation({
    mutationFn: (mode: 'ROUND_ROBIN' | 'SINGLE_ELIMINATION') =>
      generateFixture(id!, { mode, reset: true }),
    onSuccess: () => {
      Alert.alert('Fixture generado', 'Se crearon los partidos. El torneo quedó en juego si estaba abierto.');
      invalidate();
      setTab('fixture');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo generar el fixture'),
  });

  if (!canManage) {
    return (
      <Screen>
        <StackHeader title="Torneo" />
        <EmptyState
          icon={<Ionicons name="lock-closed-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
          description="Solo organizadores pueden ver este historial."
        />
      </Screen>
    );
  }

  const approved = (registrations || []).filter((r) => r.status === 'APPROVED');
  const pending = (registrations || []).filter((r) => r.status === 'PENDING');
  const matchList = matches || [];

  return (
    <Screen>
      <StackHeader title={tournament?.name || 'Torneo'} />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching || isLoading} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >
        {tournament ? (
          <AppCard style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontWeight: '800', fontSize: 18, color: ui.colors.textPrimary, flex: 1, marginRight: 8 }}>
                {tournament.name}
              </Text>
              <StatusPill status={tournament.status} />
            </View>
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>
              {formatTournamentCategory(tournament.category, tournament.gender)} · {formatLabel(tournament.format)}
            </Text>
            <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 6 }}>
              {tournament.start_date ? formatShortDate(tournament.start_date) : 'Sin fecha'}
              {' · '}
              {approved.length} parejas aprobadas
              {pending.length ? ` · ${pending.length} pendientes` : ''}
              {' · '}
              {matchList.length} partidos
            </Text>
          </AppCard>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {(
            [
              { key: 'overview' as const, label: 'Resumen' },
              { key: 'teams' as const, label: `Inscripciones${pending.length ? ` (${pending.length})` : ''}` },
              { key: 'fixture' as const, label: 'Fixture' },
              { key: 'promote' as const, label: 'Ascensos' },
            ] as const
          ).map(({ key, label }) => (
            <PrimaryButton
              key={key}
              label={label}
              size="sm"
              variant={tab === key ? 'primary' : 'ghost'}
              onPress={() => setTab(key)}
              style={tab !== key ? { backgroundColor: ui.colors.surface } : undefined}
            />
          ))}
        </View>

        {tab === 'overview' && (
          <>
            <SectionHeader title="Acciones rápidas" dark />
            <View style={{ gap: 10, marginBottom: 16 }}>
              <PrimaryButton
                label="Gestionar torneo completo"
                fullWidth
                variant="outline"
                onPress={() => router.push(`/tournament/${id}/manage` as any)}
                icon={<Ionicons name="settings-outline" size={18} color={ui.colors.primary} />}
              />
              <PrimaryButton
                label="Ver ficha pública"
                fullWidth
                variant="ghost"
                onPress={() => router.push(`/tournament/${id}` as any)}
              />
            </View>

            <SectionHeader
              title="Inscripciones"
              subtitle={`${approved.length} aprobadas · ${pending.length} pendientes`}
              dark
            />
            {(registrations || []).length === 0 ? (
              <EmptyState
                icon={<Ionicons name="people-outline" size={28} color={ui.colors.textMuted} />}
                title="Sin inscripciones"
                description="Cuando alguien se anote, vas a verlo acá."
              />
            ) : (
              (registrations || []).slice(0, 6).map((r) => (
                <AppCard key={r.id} padding="sm" style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                        {r.player1_name} / {r.player2_name}
                      </Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                        {r.status === 'APPROVED'
                          ? 'Aprobada'
                          : r.status === 'PENDING'
                            ? 'Pendiente'
                            : r.status}
                        {isOwnerOrganizer && r.payment_required
                          ? r.payment_status === 'APPROVED'
                            ? ' · Pago acreditado'
                            : ' · Pago pendiente'
                          : ''}
                      </Text>
                    </View>
                    <StatusPill status={r.status} size="sm" />
                  </View>
                </AppCard>
              ))
            )}
            {(registrations || []).length > 6 ? (
              <PrimaryButton
                label="Ver todas las inscripciones"
                size="sm"
                variant="ghost"
                onPress={() => setTab('teams')}
                style={{ marginBottom: 16 }}
              />
            ) : (
              <View style={{ height: 8 }} />
            )}

            <SectionHeader title="Tabla" subtitle={standings?.length ? `${standings.length} equipos` : 'Sin partidos finalizados'} dark />
            {!standings?.length ? (
              <EmptyState
                icon={<Ionicons name="podium-outline" size={28} color={ui.colors.textMuted} />}
                title="Sin posiciones todavía"
                description="Cuando haya partidos finalizados, vas a ver la tabla acá."
              />
            ) : (
              standings.slice(0, 8).map((row) => (
                <AppCard key={row.registrationId} padding="sm" style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontWeight: '800', color: ui.colors.primary, width: 28 }}>#{row.position}</Text>
                    <Text style={{ flex: 1, fontWeight: '700', color: ui.colors.textPrimary }} numberOfLines={1}>
                      {row.teamName}
                    </Text>
                    <Text style={{ fontWeight: '700', color: ui.colors.textSecondary }}>{row.points} pts</Text>
                  </View>
                </AppCard>
              ))
            )}
          </>
        )}

        {tab === 'teams' && (
          <>
            <SectionHeader title="Pendientes" subtitle={`${pending.length}`} dark />
            {pending.length === 0 ? (
              <AppCard style={{ marginBottom: 16 }}>
                <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>No hay inscripciones pendientes.</Text>
              </AppCard>
            ) : (
              pending.map((r) => (
                <AppCard key={r.id} style={{ marginBottom: 8 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    {r.player1_name} / {r.player2_name}
                  </Text>
                  {r.category ? (
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                      Cat. {r.category}
                    </Text>
                  ) : null}
                  {isOwnerOrganizer && r.payment_required ? (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        marginTop: 4,
                        color:
                          r.payment_status === 'APPROVED' ? ui.colors.success : ui.colors.warning,
                      }}
                    >
                      {r.payment_status === 'APPROVED' ? 'Pago acreditado' : 'Pago pendiente'}
                    </Text>
                  ) : null}
                  <PrimaryButton
                    label="Gestionar inscripción"
                    size="sm"
                    variant="outline"
                    style={{ marginTop: 10 }}
                    onPress={() => router.push(`/tournament/${id}/manage?tab=teams` as any)}
                  />
                </AppCard>
              ))
            )}

            <SectionHeader title="Aprobadas" subtitle={`${approved.length}`} dark />
            {approved.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="people-outline" size={28} color={ui.colors.textMuted} />}
                title="Sin equipos aprobados"
                description="Aprobá inscripciones desde la gestión del torneo."
                action={
                  <PrimaryButton
                    label="Ir a inscriptos"
                    size="sm"
                    onPress={() => router.push(`/tournament/${id}/manage?tab=teams` as any)}
                  />
                }
              />
            ) : (
              approved.map((r) => (
                <AppCard key={r.id} style={{ marginBottom: 8 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    {r.player1_name} / {r.player2_name}
                  </Text>
                  {r.category ? (
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                      Cat. {r.category}
                    </Text>
                  ) : null}
                  {isOwnerOrganizer && r.payment_required ? (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        marginTop: 4,
                        color:
                          r.payment_status === 'APPROVED' ? ui.colors.success : ui.colors.warning,
                      }}
                    >
                      {r.payment_status === 'APPROVED' ? 'Pago acreditado' : 'Pago pendiente'}
                    </Text>
                  ) : isOwnerOrganizer ? (
                    <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>
                      Sin cargo de inscripción
                    </Text>
                  ) : null}
                </AppCard>
              ))
            )}
          </>
        )}

        {tab === 'fixture' && (
          <>
            <SectionHeader title="Armar fixture" subtitle="Se regenera y reemplaza partidos existentes" dark />
            <AppCard style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 12, lineHeight: 18 }}>
                Necesitás al menos 2 parejas aprobadas. Podés generar todos contra todos o la primera ronda de
                eliminación directa.
              </Text>
              <View style={{ gap: 8 }}>
                <PrimaryButton
                  label="Todos contra todos"
                  fullWidth
                  loading={fixtureMutation.isPending}
                  disabled={approved.length < 2}
                  onPress={() => {
                    Alert.alert(
                      'Generar fixture',
                      'Esto borra los partidos actuales del torneo y crea uno nuevo. ¿Continuar?',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Generar', onPress: () => fixtureMutation.mutate('ROUND_ROBIN') },
                      ],
                    );
                  }}
                />
                <PrimaryButton
                  label="Eliminación directa (1ª ronda)"
                  fullWidth
                  variant="outline"
                  loading={fixtureMutation.isPending}
                  disabled={approved.length < 2}
                  onPress={() => {
                    Alert.alert(
                      'Generar fixture',
                      'Esto borra los partidos actuales y arma la primera ronda. ¿Continuar?',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Generar', onPress: () => fixtureMutation.mutate('SINGLE_ELIMINATION') },
                      ],
                    );
                  }}
                />
              </View>
            </AppCard>

            <SectionHeader title="Partidos" subtitle={`${matchList.length}`} dark />
            {matchList.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="calendar-outline" size={28} color={ui.colors.textMuted} />}
                title="Sin fixture"
                description="Generá el fixture con uno de los botones de arriba."
              />
            ) : (
              matchList.map((m) => (
                <AppCard key={m.id} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>{m.round_label || `Ronda ${m.round}`}</Text>
                    <StatusPill status={m.status} />
                  </View>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    {m.team_a_name || 'TBD'} vs {m.team_b_name || 'TBD'}
                  </Text>
                  <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 4 }}>
                    {formatScore(m)}
                  </Text>
                  {m.status !== 'FINISHED' ? (
                    <PrimaryButton
                      label="Cargar resultado en Gestión"
                      size="sm"
                      variant="outline"
                      style={{ marginTop: 10 }}
                      onPress={() => router.push(`/tournament/${id}/manage?tab=matches` as any)}
                    />
                  ) : null}
                </AppCard>
              ))
            )}
          </>
        )}

        {tab === 'promote' && (
          <>
            <SectionHeader title="Ascensos internos" subtitle="Solo dentro de tus torneos" dark />
            <AppCard style={{ marginBottom: 16, backgroundColor: ui.colors.surfaceAlt }}>
              <Text style={{ fontSize: 13, color: ui.colors.textSecondary, lineHeight: 19 }}>
                El ascenso del organizador no cambia la categoría global del jugador en x4 match. Solo afecta cómo lo
                ubicás en tus próximos torneos (por ejemplo, pasar de 6ta a 5ta en tu circuito).
              </Text>
            </AppCard>

            <SectionHeader title="Elegí una pareja" dark />
            {approved.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="arrow-up-circle-outline" size={28} color={ui.colors.textMuted} />}
                title="Sin equipos para ascender"
                description="Cuando tengas parejas aprobadas vas a poder marcarles un nivel interno."
              />
            ) : (
              approved.map((r) => (
                <AppCard
                  key={r.id}
                  onPress={() => {
                    setPromoteRegId(r.id);
                    setPromoteTarget('');
                  }}
                  style={{
                    marginBottom: 8,
                    borderColor: promoteRegId === r.id ? ui.colors.primary : ui.colors.border,
                    borderWidth: 1,
                  }}
                >
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    {r.player1_name} / {r.player2_name}
                  </Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                    Actual: {r.category || tournament?.category || 'Sin categoría'}
                  </Text>
                </AppCard>
              ))
            )}

            {promoteRegId ? (
              <AppCard style={{ marginTop: 8 }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 8 }}>
                  Nueva categoría interna
                </Text>
                <OptionChips
                  label="Destino"
                  options={FIXED_CATEGORY_OPTIONS}
                  selected={promoteTarget}
                  onSelect={setPromoteTarget}
                  horizontal
                />
                <PrimaryButton
                  label="Registrar ascenso (próximamente)"
                  fullWidth
                  disabled={!promoteTarget}
                  onPress={() =>
                    Alert.alert(
                      'Próximamente',
                      'Ya está el flujo listo en la UI. En el próximo paso guardamos el nivel interno del organizador sin tocar la categoría de la app.',
                    )
                  }
                />
              </AppCard>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
