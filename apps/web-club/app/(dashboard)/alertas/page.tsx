'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ManagerReport } from '@/lib/club-manager';
import { briefingActionHref } from '@/lib/manager-actions';
import { useClub } from '@/contexts/ClubContext';
import { PageHeader } from '@/components/layout/AppSidebar';
import { DashboardSkeleton, EmptyState } from '@/components/club/DashboardCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AlertasPage() {
  const { activeClubId, activeClub } = useClub();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['club-manager-report', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/manager-report`, {
        params: { days: 30 },
      });
      return res.data as ManagerReport;
    },
    enabled: !!activeClubId,
  });

  if (!activeClubId) return <EmptyState title="Seleccioná un club" />;
  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) return <EmptyState title="No se pudieron cargar las alertas" />;

  const rows = data.alerts.rows;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas"
        subtitle={`${data.alertCount} activas · ${activeClub?.name || ''}`}
      />

      <div className="space-y-3">
        {rows.map((alert) => {
          const href = briefingActionHref(alert.action);
          return (
            <Card key={alert.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        alert.priority === 'critical' && 'bg-destructive/15 text-destructive',
                        alert.priority === 'warn' && 'bg-warning/15 text-warning',
                        alert.priority === 'success' && 'bg-success/15 text-success',
                      )}
                    >
                      {alert.priority}
                    </Badge>
                    <p className="font-semibold">{alert.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.body}</p>
                </div>
                {href && alert.actionLabel ? (
                  <Button asChild size="sm" className="rounded-xl shrink-0">
                    <Link href={href}>{alert.actionLabel}</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {!rows.length ? (
          <EmptyState title={data.alerts.emptyText || 'Sin alertas'} />
        ) : null}
      </div>
    </div>
  );
}
