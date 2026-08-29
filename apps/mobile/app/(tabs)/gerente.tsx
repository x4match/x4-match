import { useMemo, useState } from 'react';
import { ScrollView, Text, View, RefreshControl, TouchableOpacity } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import type { BriefingAction, ManagerReport } from '@/lib/club-manager';
import { runManagerAction } from '@/lib/manager-actions';
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
} from '@/components/padely';
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
import {
  clubPaymentStatusLabel,
  type ClubPaymentConfigStatus,
} from '@/lib/club-payments';
import { trialStatusLabel, type ClubTrialStatus } from '@/lib/club-trial';

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
          <AlertBadge
            count={report?.alertCount ?? 0}
            onPress={() =>
              router.push({
                pathname: '/club-alerts',
                params: { clubId: activeClubId || '', clubName: report?.clubName || '' },
              } as any)
            }
          />
        }
      />
      <ScrollView
        contentContainerStyle={{ ...tabScreenPadding, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={ui.colors.primary}
          />
        }
      >
        <ClubPicker
          selectedClubId={activeClubId}
          onSelect={setSelectedClubId}
          enabled={canManage}
        />

        {!activeClubId ? (
          <EmptyState
            icon={<Ionicons name="business-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin club"
            description="Creá tu club para ver el panel del gerente, canchas y facturación."
            action={
              <PrimaryButton
                label="Crear club"
                onPress={() => router.push('/(tabs)/profile' as any)}
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
              <Text style={{ fontSize: 14, color: ui.colors.textMuted, marginBottom: ui.spacing.md }}>
                {report.intro}
              </Text>
            </FadeInUp>

            {trialStatus && !trialStatus.isAccessAllowed ? (
              <FadeInUp index={0}>
                <AppCard
                  style={{
                    marginBottom: ui.spacing.md,
                    borderColor: 'rgba(239,68,68,0.35)',
                    backgroundColor: 'rgba(239,68,68,0.06)',
                  }}
                >
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    Trial no activo
                  </Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                    Estado: {trialStatusLabel(trialStatus.status)}. Completá el checklist con x4 match
                    para activar los 90 días de prueba.
                  </Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 6 }}>
                    Checklist: {trialStatus.checklist.requiredDone}/{trialStatus.checklist.requiredTotal}{' '}
                    requeridos
                  </Text>
                </AppCard>
              </FadeInUp>
            ) : null}

            {trialStatus?.isTrialActive && trialStatus.daysRemaining != null ? (
              <FadeInUp index={0}>
                <AppCard
                  style={{
                    marginBottom: ui.spacing.md,
                    borderColor: 'rgba(34,197,94,0.25)',
                    backgroundColor: 'rgba(34,197,94,0.06)',
                  }}
                >
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    Trial activo · {trialStatus.daysRemaining} días restantes
                  </Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
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
                      borderColor: 'rgba(245,197,24,0.35)',
                      backgroundColor: 'rgba(245,197,24,0.06)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Ionicons name="wallet-outline" size={22} color={ui.colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                          Conectá Mercado Pago
                        </Text>
                        <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                          Estado: {clubPaymentStatusLabel(paymentStatus.status)}. Los cobros online
                          van directo a tu club.
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                    </View>
                  </AppCard>
                </PressableScale>
              </FadeInUp>
            ) : null}

            <FadeInUp index={1}>
              <ManagerHeroKpi
                title={report.hero?.title ?? 'Facturación del día'}
                amount={Number(report.hero?.amount) || 0}
                amountLabel={report.hero?.amountLabel}
                deltaPct={report.hero?.deltaPct ?? 0}
                deltaLabel={report.hero?.deltaLabel ?? ''}
                hint={report.hero?.hint}
                tone={report.hero?.tone ?? 'default'}
              />
            </FadeInUp>

            <FadeInUp index={2}>
              <SectionHeader title={report.today.title} subtitle={report.today.subtitle} />
              <ManagerKpiGrid tiles={report.today.tiles} />
            </FadeInUp>

            <FadeInUp index={3}>
              <SectionHeader title={report.comparisons.title} subtitle="vs ayer · semana · mes" />
              <ComparisonStrip metrics={report.comparisons.metrics} />
            </FadeInUp>

            <FadeInUp index={4}>
              <SectionHeader
                title={report.insights.title}
                subtitle={report.insights.subtitle}
                action={
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
                  >
                    <Text style={{ color: ui.colors.primary, fontWeight: '700', fontSize: 13 }}>
                      Alertas
                    </Text>
                  </TouchableOpacity>
                }
              />
              {report.insights.cards.length === 0 ? (
                <AppCard style={{ marginBottom: 20 }}>
                  <Text style={{ color: ui.colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                    {report.insights.emptyText}
                  </Text>
                </AppCard>
              ) : (
                <View style={{ marginBottom: 12 }}>
                  {report.insights.cards.map((card) => (
                    <InsightCard
                      key={card.id}
                      card={card}
                      onAction={() => runAction(card.action)}
                    />
                  ))}
                </View>
              )}
            </FadeInUp>

            <FadeInUp index={5}>
              <SectionHeader
                title={report.upcomingSlots.title}
                subtitle={report.upcomingSlots.subtitle}
              />
              <UpcomingSlotsCard
                rows={report.upcomingSlots.rows}
                emptyText={report.upcomingSlots.emptyText}
                onViewAgenda={() => runAction(report.upcomingSlots.action?.action)}
              />
            </FadeInUp>

            <FadeInUp index={6}>
              <SectionHeader title={report.byCourt.title} subtitle={report.byCourt.subtitle} />
              {report.byCourt.rows.length === 0 ? (
                <AppCard style={{ marginBottom: 20 }}>
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>
                    {report.byCourt.emptyText}
                  </Text>
                </AppCard>
              ) : (
                <View style={{ marginBottom: 20 }}>
                  {report.byCourt.rows.map((court) => (
                    <AppCard
                      key={`${court.courtId ?? court.courtLabel}`}
                      padding="sm"
                      style={{ marginBottom: 10 }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
                            {court.courtLabel}
                          </Text>
                          <Text
                            style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}
                          >
                            {court.detail}
                          </Text>
                        </View>
                        <Text
                          style={{ fontWeight: '800', color: ui.colors.primary, fontSize: 16 }}
                        >
                          {court.revenueLabel}
                        </Text>
                      </View>
                    </AppCard>
                  ))}
                </View>
              )}
            </FadeInUp>

            <FadeInUp index={7}>
              <SectionHeader title={report.deadHours.title} subtitle={report.deadHours.subtitle} />
              <DeadHoursCard
                rows={report.deadHours.rows}
                emptyText={report.deadHours.emptyText}
                sectionActionLabel={report.deadHours.action?.label}
                onSectionAction={
                  report.deadHours.action
                    ? () => runAction(report.deadHours.action?.action)
                    : undefined
                }
                onCreatePromo={(row) =>
                  runAction(
                    row.action?.action || {
                      type: 'court_slots',
                      tab: 'promotions',
                      dayOfWeek: row.dayOfWeek,
                      hourBucket: row.hourBucket,
                    },
                  )
                }
              />
            </FadeInUp>

            <FadeInUp index={8}>
              <SectionHeader title={report.atRisk.title} subtitle={report.atRisk.subtitle} />
              {report.atRisk.rows.length === 0 ? (
                <AppCard style={{ marginBottom: 20 }}>
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>
                    {report.atRisk.emptyText}
                  </Text>
                </AppCard>
              ) : (
                <View style={{ marginBottom: 20 }}>
                  {report.atRisk.rows.map((player) => (
                    <PressableScale
                      key={player.userId}
                      onPress={() =>
                        router.push({ pathname: '/player/[id]', params: { id: player.userId } })
                      }
                    >
                      <AppCard padding="sm" style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={ui.colors.textMuted}
                          />
                        </View>
                      </AppCard>
                    </PressableScale>
                  ))}
                  {report.atRisk.moreLabel ? (
                    <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 8 }}>
                      {report.atRisk.moreLabel}
                    </Text>
                  ) : null}
                  <PrimaryButton
                    label={report.atRisk.action?.label || 'Ver clientes'}
                    size="sm"
                    fullWidth
                    onPress={() =>
                      runAction(report.atRisk.action?.action || { type: 'clients' })
                    }
                    style={{ marginTop: 4 }}
                  />
                </View>
              )}
            </FadeInUp>

            <FadeInUp index={9}>
              <SectionHeader
                title={report.cancellations.title}
                subtitle={report.cancellations.subtitle}
              />
              <AppCard style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <View style={{ width: '47%' }}>
                    <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>
                      {report.cancellations.refundedLabel}
                    </Text>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '800',
                        color: ui.colors.textPrimary,
                        marginTop: 4,
                      }}
                    >
                      {report.cancellations.refundedAmount}
                    </Text>
                    <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>
                      {report.cancellations.refundedDetail}
                    </Text>
                  </View>
                  <View style={{ width: '47%' }}>
                    <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>
                      {report.cancellations.retainedLabel}
                    </Text>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '800',
                        color: ui.colors.accent,
                        marginTop: 4,
                      }}
                    >
                      {report.cancellations.retainedAmount}
                    </Text>
                    <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>
                      {report.cancellations.retainedDetail}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 12 }}>
                  {report.cancellations.summary}
                </Text>
                {report.cancellations.action ? (
                  <TouchableOpacity
                    onPress={() => runAction(report.cancellations.action?.action)}
                    style={{ marginTop: 10 }}
                  >
                    <Text style={{ color: ui.colors.primary, fontWeight: '700', fontSize: 13 }}>
                      {report.cancellations.action.label}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </AppCard>
            </FadeInUp>

            <FadeInUp index={10}>
              <PrimaryButton
                label="Ver todas las alertas"
                variant="outline"
                fullWidth
                icon={<Ionicons name="notifications-outline" size={16} color={ui.colors.primary} />}
                onPress={() =>
                  router.push({
                    pathname: '/club-alerts',
                    params: { clubId: activeClubId || '', clubName: report.clubName },
                  } as any)
                }
                style={{ marginBottom: 8 }}
              />
              <PrimaryButton
                label="Finanzas del club"
                variant="ghost"
                fullWidth
                onPress={() => runAction({ type: 'billing' })}
              />
              <PrimaryButton
                label="Pagos / Mercado Pago"
                variant="ghost"
                fullWidth
                onPress={() => runAction({ type: 'payments' })}
              />
            </FadeInUp>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
