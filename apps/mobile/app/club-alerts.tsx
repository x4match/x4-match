import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import type { AlertPriority, BriefingAction, ManagerAlert, ManagerReport } from '@/lib/club-manager';
import { runManagerAction } from '@/lib/manager-actions';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  EmptyState,
  PressableScale,
  FadeInUp,
  SkeletonCard,
  SectionHeader,
} from '@/components/padely';
import {
  ClubPicker,
  resolveActiveClubId,
  useMineClubs,
} from '@/components/club/ClubPicker';

function priorityMeta(priority: AlertPriority) {
  switch (priority) {
    case 'critical':
      return { color: ui.colors.danger, soft: ui.colors.dangerSoft, label: 'Urgente', icon: 'alert-circle' as const };
    case 'warn':
      return { color: ui.colors.warning, soft: ui.colors.warningSoft, label: 'Atención', icon: 'warning' as const };
    case 'success':
      return { color: ui.colors.success, soft: ui.colors.successSoft, label: 'OK', icon: 'checkmark-circle' as const };
    default:
      return { color: '#3B82F6', soft: 'rgba(59,130,246,0.14)', label: 'Info', icon: 'information-circle' as const };
  }
}

function AlertRow({
  alert,
  onAction,
}: {
  alert: ManagerAlert;
  onAction: (action?: BriefingAction) => void;
}) {
  const meta = priorityMeta(alert.priority);
  return (
    <AppCard padding="sm" style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: meta.soft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 8,
                backgroundColor: meta.soft,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: meta.color }}>{meta.label}</Text>
            </View>
          </View>
          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, fontSize: 15 }}>
            {alert.title}
          </Text>
          <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
            {alert.body}
          </Text>
          {alert.action && alert.actionLabel ? (
            <PressableScale
              onPress={() => onAction(alert.action)}
              style={{ marginTop: 12, alignSelf: 'flex-start' }}
            >
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: ui.radius.md,
                  backgroundColor: ui.colors.primarySoft,
                }}
              >
                <Text style={{ color: ui.colors.primary, fontWeight: '700', fontSize: 13 }}>
                  {alert.actionLabel}
                </Text>
              </View>
            </PressableScale>
          ) : null}
        </View>
      </View>
    </AppCard>
  );
}

export default function ClubAlertsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canManage = isClub(user?.role);
  const params = useLocalSearchParams<{ clubId?: string; clubName?: string }>();
  const [selectedClubId, setSelectedClubId] = useState<string | null>(params.clubId || null);

  const { data: clubs } = useMineClubs(canManage);
  const activeClubId = useMemo(
    () => resolveActiveClubId(selectedClubId || params.clubId || null, clubs),
    [selectedClubId, params.clubId, clubs],
  );

  const { data: report, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['club-manager-report', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/manager-report`, { params: { days: 30 } });
      return res.data as ManagerReport;
    },
    enabled: canManage && !!activeClubId,
  });

  const runAction = (action?: BriefingAction) => {
    runManagerAction(action, {
      router,
      clubId: activeClubId,
      clubName: report?.clubName || params.clubName,
    });
  };

  if (!canManage) {
    return (
      <Screen>
        <StackHeader title="Alertas" />
        <EmptyState
          icon={<Ionicons name="lock-closed-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
        />
      </Screen>
    );
  }

  const alerts = report?.alerts.rows ?? [];

  return (
    <Screen>
      <StackHeader title="Alertas" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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

        {isLoading || !report ? (
          <View style={{ gap: 12 }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            <FadeInUp index={0}>
              <SectionHeader title={report.alerts.title} subtitle={report.alerts.subtitle} />
            </FadeInUp>
            {alerts.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="checkmark-circle-outline" size={40} color={ui.colors.success} />}
                title="Sin alertas"
                description={report.alerts.emptyText}
              />
            ) : (
              alerts.map((alert, index) => (
                <FadeInUp key={alert.id} index={index + 1}>
                  <AlertRow alert={alert} onAction={runAction} />
                </FadeInUp>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
