import { useMemo, useRef, useState } from 'react';
import { Text, View, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import type { BriefingAction, ManagerReport } from '@/lib/club/club-manager';
import { runManagerAction } from '@/lib/manager/manager-actions';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  AppHeader,
  AppCard,
  SectionHeader,
  EmptyState,
  PrimaryButton,
  Avatar,
  FadeInUp,
  SkeletonCard,
  PressableScale,
  TabScrollView,
} from '@/components/x4match';
import {
  ClubPicker,
  resolveActiveClubId,
  useMineClubs,
} from '@/components/club/ClubPicker';
import { ManagerHeroKpi } from '@/components/club/ManagerHeroKpi';
import { ManagerKpiGrid } from '@/components/club/ManagerKpiGrid';
import { InsightCard } from '@/components/club/InsightCard';
import { ComparisonStrip } from '@/components/club/ComparisonStrip';
import { UpcomingSlotsCard } from '@/components/club/UpcomingSlotsCard';
import { DeadHoursCard } from '@/components/club/DeadHoursCard';
import { AlertBadge } from '@/components/club/AlertBadge';
import { CurrencyAmount } from '@/components/club/CurrencyAmount';
import {
  clubPaymentStatusLabel,
  type ClubPaymentConfigStatus,
} from '@/lib/club/club-payments';
import { trialStatusLabel, type ClubTrialStatus } from '@/lib/club/club-trial';
import { TourTarget, useScreenTour, type TourStep } from '@/components/tour/ScreenTour';

const GERENTE_TOUR_STEPS: TourStep[] = [
  {
    target: 'gerente.alerts',
    fixed: true,
    title: 'Alertas',
    description: 'Avisos que requieren tu atención: pagos pendientes, cancelaciones, clientes en riesgo y más.',
  },
  {
    target: 'gerente.clubPicker',
    title: 'Sede',
    description: 'Si tenés más de una sede, elegí cuál querés ver. Todo el panel se actualiza con sus datos.',
  },
  {
    target: 'gerente.hero',
    title: 'Facturación del día',
    description: 'Lo que lleva facturado tu club hoy y cómo viene comparado con el período anterior.',
  },
  {
    target: 'gerente.kpis',
    title: 'Indicadores de hoy',
    description: 'Reservas, ocupación, cobros pendientes y otros números clave del día.',
  },
  {
    target: 'gerente.comparisons',
    title: 'Comparativas',
    description: 'Cómo te fue en comparación con períodos anteriores.',
  },
  {
    target: 'gerente.insights',
    title: 'Recomendaciones',
    description:
      'Sugerencias automáticas para mejorar la ocupación y los ingresos. Cada una trae un botón para actuar en el momento.',
  },
  {
    target: 'gerente.upcoming',
    title: 'Próximos turnos',
    description: 'Los turnos que vienen en tu agenda. Desde acá entrás a la agenda completa.',
  },
  {
    target: 'gerente.byCourt',
    title: 'Ingresos por cancha',
    description: 'Cuánto generó cada cancha, para ver cuáles rinden más.',
  },
  {
    target: 'gerente.deadHours',
    title: 'Horas muertas',
    description: 'Franjas con poca ocupación. Podés crear una promoción para llenarlas.',
  },
  {
    target: 'gerente.atRisk',
    title: 'Clientes en riesgo',
    description: 'Jugadores que dejaron de venir. Contactalos antes de perderlos.',
  },
  {
    target: 'gerente.cancellations',
    title: 'Cancelaciones',
    description: 'Turnos cancelados en el período y su impacto.',
  },
  {
    target: 'gerente.clients',
    title: 'Clientes',
    description: 'La lista completa de jugadores que reservaron en tu club, con su historial.',
  },
  {
    target: 'gerente.finance',
    title: 'Finanzas del club',
    description: 'La caja del día y las deudas pendientes de cobro.',
  },
];

export default function GerenteScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = isClub(user?.role);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);

  const { data: clubs } = useMineClubs(canManage);
  const activeClubId = useMemo(
    () => resolveActiveClubId(selectedClubId, clubs),
    [selectedClubId, clubs],
  );

  const {
    data: report,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['club-manager-report', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/manager-report`, {
        params: { days: 30 },
      });
      return res.data as ManagerReport;
    },
    enabled: canManage && !!activeClubId,
  });

  const scrollRef = useRef<ScrollView>(null);
  useScreenTour('gerente', GERENTE_TOUR_STEPS, { enabled: canManage && !!report, scrollRef });

  const { data: paymentStatus } = useQuery({
    queryKey: ['club-mp-status', activeClubId],
    queryFn: async () => {
      const res = await api.get<ClubPaymentConfigStatus>(`/clubs/${activeClubId}/payments/status`);
      return res.data;
    },
    enabled: canManage && !!activeClubId,
  });

  const { data: trialStatus } = useQuery({
    queryKey: ['club-trial-status', activeClubId],
    queryFn: async () => {
      const res = await api.get<ClubTrialStatus>(`/clubs/${activeClubId}/trial`);
      return res.data;
    },
    enabled: canManage && !!activeClubId,
  });

  const enableAutoFill = useMutation({
    mutationFn: async () => {
      if (!activeClubId) throw new Error('Sin club');
      await api.patch(`/clubs/${activeClubId}/auto-fill-gaps`, { enabled: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-manager-report', activeClubId] });
      queryClient.invalidateQueries({ queryKey: ['club-dashboard', activeClubId] });
    },
  });

  const runAction = (action?: BriefingAction) => {
    runManagerAction(action, {
      router,
      clubId: activeClubId,
      clubName: report?.clubName,
      enableAutoFill: () => enableAutoFill.mutate(),
    });
  };

  const pendingTile = report?.today.tiles.find((t) => t.id === 'pending');
  const pendingAmount = (() => {
    if (!pendingTile) return 0;
    const numeric = pendingTile.value.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
    const n = Number(numeric);
    return Number.isFinite(n) ? n : 0;
  })();

  if (!canManage) {
    return (
      <Screen>
        <AppHeader title="Gerente" />
        <EmptyState
          icon={<Ionicons name="analytics-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
          description="Esta sección es solo para cuentas de club."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Gerente"
        rightAction={
          <TourTarget id="gerente.alerts">
            <AlertBadge
              count={report?.alertCount ?? 0}
              onPress={() =>
                router.push({
                  pathname: '/club-alerts',
                  params: { clubId: activeClubId || '', clubName: report?.clubName || '' },
                } as any)
              }
            />
          </TourTarget>
        }
      />
      <TabScrollView
        ref={scrollRef}
        contentContainerStyle={{ ...tabScreenPadding, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={ui.colors.primary}
          />
        }
      >
        <TourTarget id="gerente.clubPicker">
          <ClubPicker
            selectedClubId={activeClubId}
            onSelect={setSelectedClubId}
            enabled={canManage}
          />
        </TourTarget>

        {!activeClubId ? (
          <EmptyState
            icon={<Ionicons name="business-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin club"
            description="Creá tu club para ver el panel del gerente, canchas y facturación."
            action={
              <PrimaryButton
                label="Crear club"
                onPress={() => router.push('/(tabs)/home' as any)}
              />
            }
          />
        ) : isLoading || !report ? (
          <View style={{ gap: 12 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            <FadeInUp index={0}>
              <Text
                style={{
                  fontSize: 13,
                  color: ui.colors.textSecondary,
                  marginBottom: ui.spacing.md,
                  lineHeight: 18,
                }}
              >
                {report.intro}
              </Text>
            </FadeInUp>

            {trialStatus && !trialStatus.isAccessAllowed ? (
              <FadeInUp index={0}>
                <PressableScale
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/home',
                    } as any)
                  }
                >
                  <AppCard
                    style={{
                      marginBottom: ui.spacing.md,
                      backgroundColor: ui.colors.surface1,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: ui.colors.textMuted,
                            }}
                          />
                          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                            Trial no activo
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 12,
                            color: ui.colors.textSecondary,
                            marginTop: 8,
                            lineHeight: 17,
                          }}
                        >
                          Estado: {trialStatusLabel(trialStatus.status)}. Completá el checklist una
                          vez que el trial de {trialStatus.trialDays || 90} días se active.
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                    </View>
                  </AppCard>
                </PressableScale>
              </FadeInUp>
            ) : null}

            {trialStatus?.isTrialActive && trialStatus.daysRemaining != null ? (
              <FadeInUp index={0}>
                <AppCard
                  style={{
                    marginBottom: ui.spacing.md,
                    borderColor: 'rgba(215,255,0,0.25)',
                    backgroundColor: 'rgba(215,255,0,0.06)',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: ui.colors.primary,
                      }}
                    />
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                      Trial activo · {trialStatus.daysRemaining} días restantes
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 6 }}>
                    Modo {trialStatus.trialMode === 'MANUAL' ? 'manual' : 'por tiempo'}.
                    {trialStatus.trialEndsAt
                      ? ` Vence ${new Date(trialStatus.trialEndsAt).toLocaleDateString('es-AR')}.`
                      : ' Sin fecha de vencimiento automática.'}
                  </Text>
                </AppCard>
              </FadeInUp>
            ) : null}

            {paymentStatus && paymentStatus.status !== 'CONNECTED' ? (
              <FadeInUp index={0}>
                <PressableScale onPress={() => runAction({ type: 'payments' })}>
                  <AppCard
                    style={{
                      marginBottom: ui.spacing.md,
                      borderColor: 'rgba(34,197,94,0.35)',
                      backgroundColor: 'rgba(20,83,45,0.45)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: 'rgba(215,255,0,0.12)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="wallet-outline" size={22} color={ui.colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: ui.colors.primary, fontSize: 15 }}>
                          Conectá Mercado Pago
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: 'rgba(187,247,208,0.9)',
                            marginTop: 4,
                            lineHeight: 17,
                          }}
                        >
                          Conectá tu cuenta para cobrar online tus reservas ahora ›
                        </Text>
                        <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 4 }}>
                          Estado: {clubPaymentStatusLabel(paymentStatus.status)}
                        </Text>
                      </View>
                    </View>
                  </AppCard>
                </PressableScale>
              </FadeInUp>
            ) : null}

            <FadeInUp index={1}>
              <TourTarget id="gerente.hero" style={{ marginBottom: 24 }}>
              <AppCard padding="md" style={{ marginBottom: 0 }}>
                <ManagerHeroKpi
                  title={report.hero?.title ?? 'Facturación del día'}
                  amount={Number(report.hero?.amount) || 0}
                  amountLabel={report.hero?.amountLabel}
                  deltaPct={report.hero?.deltaPct ?? 0}
                  deltaLabel={report.hero?.deltaLabel ?? ''}
                  hint={report.hero?.hint}
                  tone={report.hero?.tone ?? 'default'}
                />
              </AppCard>
              </TourTarget>
            </FadeInUp>

            <FadeInUp index={2}>
              <TourTarget id="gerente.kpis">
              <SectionHeader title={report.today.title} />
              <ManagerKpiGrid tiles={report.today.tiles} />
              </TourTarget>
            </FadeInUp>

            <FadeInUp index={3}>
              <TourTarget id="gerente.comparisons">
              <ComparisonStrip metrics={report.comparisons.metrics} />
              </TourTarget>
            </FadeInUp>

            <FadeInUp index={4}>
              <TourTarget id="gerente.insights" style={{ marginBottom: 24 }}>
              <AppCard padding="md" style={{ marginBottom: 0 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: ui.colors.textPrimary }}>
                    {report.insights.title}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/club-alerts',
                        params: {
                          clubId: activeClubId || '',
                          clubName: report.clubName,
                        },
                      } as any)
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: ui.radius.pill,
                      borderWidth: 1,
                      borderColor: ui.colors.primary,
                    }}
                  >
                    <Text style={{ color: ui.colors.primary, fontWeight: '700', fontSize: 12 }}>
                      Alertas
                    </Text>
                  </TouchableOpacity>
                </View>

                {report.insights.cards.length === 0 ? (
                  <Text
                    style={{
                      color: ui.colors.textSecondary,
                      fontSize: 13,
                      lineHeight: 18,
                      marginTop: 14,
                    }}
                  >
                    {report.insights.emptyText}
                  </Text>
                ) : (
                  report.insights.cards.map((card) => (
                    <InsightCard
                      key={card.id}
                      card={card}
                      onAction={() => runAction(card.action)}
                    />
                  ))
                )}

                <TouchableOpacity
                  onPress={() => runAction({ type: 'court_slots', tab: 'stats' })}
                  style={{ marginTop: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: ui.colors.primary, fontWeight: '700', fontSize: 13 }}>
                    Ver estadísticas →
                  </Text>
                </TouchableOpacity>
              </AppCard>
              </TourTarget>
            </FadeInUp>

            <FadeInUp index={5}>
              <TourTarget id="gerente.upcoming">
              <UpcomingSlotsCard
                title={report.upcomingSlots.title}
                subtitle={report.upcomingSlots.subtitle}
                rows={report.upcomingSlots.rows}
                emptyText={report.upcomingSlots.emptyText}
                onViewAgenda={() => runAction(report.upcomingSlots.action?.action)}
              />
              </TourTarget>
            </FadeInUp>

            <FadeInUp index={6}>
              <TourTarget id="gerente.byCourt" style={{ marginBottom: 24 }}>
              <AppCard padding="md" style={{ marginBottom: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: ui.colors.textPrimary }}>
                  {report.byCourt.title}
                </Text>
                {report.byCourt.subtitle ? (
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>
                    {report.byCourt.subtitle}
                  </Text>
                ) : null}

                {report.byCourt.rows.length === 0 ? (
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13, marginTop: 14 }}>
                    {report.byCourt.emptyText}
                  </Text>
                ) : (
                  <View style={{ marginTop: 8 }}>
                    {report.byCourt.rows.map((court, index) => (
                      <View
                        key={`${court.courtId ?? court.courtLabel}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          paddingVertical: 10,
                          borderTopWidth: index === 0 ? 0 : 1,
                          borderTopColor: ui.colors.border,
                        }}
                      >
                        <Ionicons name="tennisball-outline" size={18} color={ui.colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
                            {court.courtLabel}
                          </Text>
                          <Text
                            style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}
                            numberOfLines={2}
                          >
                            {court.detail}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontWeight: '800',
                            color: ui.colors.textPrimary,
                            fontSize: 15,
                          }}
                        >
                          {court.revenueLabel}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </AppCard>
              </TourTarget>
            </FadeInUp>

            <FadeInUp index={7}>
              <TourTarget id="gerente.deadHours">
              <DeadHoursCard
                title={report.deadHours.title}
                subtitle={report.deadHours.subtitle}
                rows={report.deadHours.rows}
                emptyText={report.deadHours.emptyText}
                sectionActionLabel={report.deadHours.action?.label}
                onSectionAction={
                  report.deadHours.action
                    ? () => runAction(report.deadHours.action?.action)
                    : undefined
                }
              />
              </TourTarget>
            </FadeInUp>

            <FadeInUp index={8}>
              <TourTarget id="gerente.atRisk" style={{ marginBottom: 24 }}>
              <AppCard padding="md" style={{ marginBottom: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: ui.colors.textPrimary }}>
                  {report.atRisk.title}
                </Text>
                {report.atRisk.subtitle ? (
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>
                    {report.atRisk.subtitle}
                  </Text>
                ) : null}

                {report.atRisk.rows.length === 0 ? (
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13, marginTop: 14 }}>
                    {report.atRisk.emptyText}
                  </Text>
                ) : (
                  <View style={{ marginTop: 8 }}>
                    {report.atRisk.rows.map((player, index) => (
                      <PressableScale
                        key={player.userId}
                        onPress={() =>
                          router.push({
                            pathname: '/player/[id]',
                            params: { id: player.userId },
                          })
                        }
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            paddingVertical: 12,
                            borderTopWidth: index === 0 ? 0 : 1,
                            borderTopColor: ui.colors.border,
                          }}
                        >
                          <Avatar
                            name={player.name}
                            photo={player.photoUrl || undefined}
                            size="md"
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
                              {player.nickname || player.name}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: ui.colors.textSecondary,
                                marginTop: 2,
                              }}
                            >
                              {player.detail}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={ui.colors.textMuted} />
                        </View>
                      </PressableScale>
                    ))}
                    {report.atRisk.moreLabel ? (
                      <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 8 }}>
                        {report.atRisk.moreLabel}
                      </Text>
                    ) : null}
                  </View>
                )}
              </AppCard>
              </TourTarget>
            </FadeInUp>

            <FadeInUp index={9}>
              <TourTarget id="gerente.cancellations" style={{ marginBottom: 24 }}>
              <AppCard padding="md" style={{ marginBottom: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: ui.colors.textPrimary }}>
                  {report.cancellations.title}
                </Text>
                {report.cancellations.subtitle ? (
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>
                    {report.cancellations.subtitle}
                  </Text>
                ) : null}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: ui.colors.surface2,
                      borderRadius: ui.radius.md,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: ui.colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>
                      {report.cancellations.refundedLabel}
                    </Text>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '800',
                        color: ui.colors.textPrimary,
                        marginTop: 6,
                      }}
                    >
                      {report.cancellations.refundedAmount}
                    </Text>
                    <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 4 }}>
                      {report.cancellations.refundedDetail}
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: ui.colors.surface2,
                      borderRadius: ui.radius.md,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: ui.colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>
                      {report.cancellations.retainedLabel}
                    </Text>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '800',
                        color: ui.colors.textPrimary,
                        marginTop: 6,
                      }}
                    >
                      {report.cancellations.retainedAmount}
                    </Text>
                    <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 4 }}>
                      {report.cancellations.retainedDetail}
                    </Text>
                  </View>
                </View>

                <Text
                  style={{
                    fontSize: 12,
                    color: ui.colors.textSecondary,
                    marginTop: 12,
                  }}
                >
                  {report.cancellations.summary}
                </Text>
                {report.cancellations.action ? (
                  <TouchableOpacity
                    onPress={() => runAction(report.cancellations.action?.action)}
                    style={{ marginTop: 10 }}
                  >
                    <Text style={{ color: ui.colors.primary, fontWeight: '700', fontSize: 13 }}>
                      {report.cancellations.action.label} →
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </AppCard>
              </TourTarget>
            </FadeInUp>

            <FadeInUp index={10}>
              <TourTarget id="gerente.clients">
              <PrimaryButton
                label="Ver todos los clientes"
                variant="outline"
                fullWidth
                icon={<Ionicons name="people-outline" size={16} color={ui.colors.textPrimary} />}
                onPress={() =>
                  runAction(report.clientsSummary.action?.action || { type: 'clients' })
                }
                style={{ marginBottom: 24 }}
              />
              </TourTarget>
            </FadeInUp>

            <FadeInUp index={11}>
              <TourTarget id="gerente.finance" style={{ marginBottom: 12 }}>
              <AppCard padding="md" style={{ marginBottom: 0 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: ui.colors.textPrimary,
                    marginBottom: 8,
                  }}
                >
                  Finanzas del club
                </Text>
                <PressableScale onPress={() => runAction({ type: 'billing' })}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
                        Caja del día
                      </Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
                        {report.hero.amount > 0
                          ? report.hero.hint || 'Movimientos de hoy'
                          : 'Sin movimientos hoy'}
                      </Text>
                    </View>
                    <CurrencyAmount amount={Number(report.hero.amount) || 0} size="sm" />
                  </View>
                </PressableScale>
                <View
                  style={{
                    height: 1,
                    backgroundColor: ui.colors.border,
                    marginVertical: 4,
                  }}
                />
                <PressableScale onPress={() => runAction({ type: 'billing' })}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
                        Deudas pendientes
                      </Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
                        {pendingAmount > 0
                          ? pendingTile?.hint || 'Cobros pendientes'
                          : 'Sin deudas activas'}
                      </Text>
                    </View>
                    <CurrencyAmount amount={pendingAmount} size="sm" />
                  </View>
                </PressableScale>
              </AppCard>
              </TourTarget>
            </FadeInUp>
          </>
        )}
      </TabScrollView>
    </Screen>
  );
}
