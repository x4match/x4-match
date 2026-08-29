'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { ManagerReport } from '@/lib/club-manager';
import { briefingActionHref } from '@/lib/manager-actions';
import { type ClubTrialStatus } from '@/lib/club-trial';
import { useClub } from '@/contexts/ClubContext';
import { PageHeader } from '@/components/layout/AppSidebar';
import { TrialStatusBanner } from '@/components/club/TrialStatusBanner';
import {
  AtRiskList,
  ByCourtList,
  ClientsSummaryCard,
  ComparisonStrip,
  DashboardSkeleton,
  DeadHoursCard,
  EmptyState,
  InsightCardList,
  ManagerHeroKpi,
  ManagerKpiGrid,
  UpcomingSlotsCard,
} from '@/components/club/DashboardCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function GerentePage() {
  const { activeClubId, activeClub, clubsLoading } = useClub();
  const queryClient = useQueryClient();

  const reportQuery = useQuery({
    queryKey: ['club-manager-report', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/manager-report`, {
        params: { days: 30 },
      });
      return res.data as ManagerReport;
    },
    enabled: !!activeClubId,
  });

  const trialQuery = useQuery({
    queryKey: ['club-trial-status', activeClubId],
    queryFn: async () => {
      const res = await api.get<ClubTrialStatus>(`/clubs/${activeClubId}/trial`);
      return res.data;
    },
    enabled: !!activeClubId,
  });

  const autoFillMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await api.patch(`/clubs/${activeClubId}/auto-fill-gaps`, { enabled });
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-manager-report', activeClubId] });
      toast.success('Auto-fill actualizado');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo actualizar');
    },
  });

  if (clubsLoading || (!activeClubId && clubsLoading)) {
    return <DashboardSkeleton />;
  }

  if (!activeClubId) {
    return (
      <EmptyState
        title="Sin clubes"
        description="No tenés clubs asignados. Creá uno desde Perfil o pedí acceso a un administrador."
      />
    );
  }

  if (reportQuery.isLoading) return <DashboardSkeleton />;

  if (reportQuery.isError || !reportQuery.data) {
    return (
      <EmptyState
        title="No se pudo cargar el reporte"
        description="Reintentá en unos segundos."
      />
    );
  }

  const report = reportQuery.data;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <TrialStatusBanner trial={trialQuery.data} />

      <PageHeader
        title={report.clubName || activeClub?.name || 'Gerente'}
        subtitle={report.intro}
        actions={
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2">
            <Switch
              id="autofill"
              checked={report.autoFillGapsEnabled}
              onCheckedChange={(v) => autoFillMutation.mutate(v)}
              disabled={autoFillMutation.isPending}
            />
            <Label htmlFor="autofill" className="text-sm">
              Auto-fill gaps
            </Label>
          </div>
        }
      />

      <ManagerHeroKpi
        title={report.hero.title}
        amountLabel={report.hero.amountLabel}
        deltaPct={report.hero.deltaPct}
        deltaLabel={report.hero.deltaLabel}
        hint={report.hero.hint}
        tone={report.hero.tone}
      />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          {report.today.title}
        </h3>
        <ManagerKpiGrid tiles={report.today.tiles} />
      </div>

      <ComparisonStrip title={report.comparisons.title} metrics={report.comparisons.metrics} />

      <div className="grid gap-4 lg:grid-cols-2">
        <InsightCardList
          title={report.briefing.title}
          subtitle={report.briefing.subtitle}
          emptyText={report.briefing.emptyText}
          cards={report.briefing.cards}
        />
        <InsightCardList
          title={report.insights.title}
          subtitle={report.insights.subtitle}
          emptyText={report.insights.emptyText}
          cards={report.insights.cards}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingSlotsCard
          title={report.upcomingSlots.title}
          subtitle={report.upcomingSlots.subtitle}
          emptyText={report.upcomingSlots.emptyText}
          rows={report.upcomingSlots.rows}
          actionHref={briefingActionHref(report.upcomingSlots.action?.action)}
          actionLabel={report.upcomingSlots.action?.label}
        />
        <DeadHoursCard
          title={report.deadHours.title}
          subtitle={report.deadHours.subtitle}
          emptyText={report.deadHours.emptyText}
          rows={report.deadHours.rows}
          actionHref={briefingActionHref(report.deadHours.action?.action)}
          actionLabel={report.deadHours.action?.label}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ByCourtList
          title={report.byCourt.title}
          subtitle={report.byCourt.subtitle}
          emptyText={report.byCourt.emptyText}
          rows={report.byCourt.rows}
        />
        <AtRiskList
          title={report.atRisk.title}
          subtitle={report.atRisk.subtitle}
          emptyText={report.atRisk.emptyText}
          rows={report.atRisk.rows}
          actionHref={briefingActionHref(report.atRisk.action?.action)}
          actionLabel={report.atRisk.action?.label}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-base">{report.cancellations.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{report.cancellations.subtitle}</p>
          </div>
          {report.cancellations.action ? (
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <a href={briefingActionHref(report.cancellations.action.action) || '#'}>
                {report.cancellations.action.label}
              </a>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-0/70 p-4">
            <p className="text-xs text-muted-foreground">{report.cancellations.refundedLabel}</p>
            <p className="mt-1 text-xl font-bold">{report.cancellations.refundedAmount}</p>
            <p className="text-xs text-muted-foreground">{report.cancellations.refundedDetail}</p>
          </div>
          <div className="rounded-xl bg-surface-0/70 p-4">
            <p className="text-xs text-muted-foreground">{report.cancellations.retainedLabel}</p>
            <p className="mt-1 text-xl font-bold">{report.cancellations.retainedAmount}</p>
            <p className="text-xs text-muted-foreground">{report.cancellations.retainedDetail}</p>
          </div>
          <p className="sm:col-span-2 text-sm text-muted-foreground">{report.cancellations.summary}</p>
        </CardContent>
      </Card>

      <ClientsSummaryCard
        title={report.clientsSummary.title}
        subtitle={report.clientsSummary.subtitle}
        counts={report.clientsSummary.counts}
        actionHref={briefingActionHref(report.clientsSummary.action?.action)}
        actionLabel={report.clientsSummary.action?.label}
      />

      <InsightCardList
        title={report.alerts.title}
        subtitle={report.alerts.subtitle}
        emptyText={report.alerts.emptyText}
        cards={report.alerts.rows}
      />
    </div>
  );
}
