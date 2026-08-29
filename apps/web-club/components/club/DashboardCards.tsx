'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type {
  BriefingCard,
  ManagerAlert,
  ManagerAtRiskPlayer,
  ManagerClientRow,
  ManagerComparisonMetric,
  ManagerCourtRow,
  ManagerKpiTile,
  ManagerUpcomingSlot,
  ManagerValleyRow,
} from '@/lib/club-manager';
import { briefingActionHref } from '@/lib/manager-actions';
import { formatCurrency } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function ManagerHeroKpi({
  title,
  amountLabel,
  deltaPct,
  deltaLabel,
  hint,
  tone,
}: {
  title: string;
  amountLabel: string;
  deltaPct: number;
  deltaLabel: string;
  hint?: string;
  tone: 'success' | 'danger' | 'default';
}) {
  return (
    <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-surface-1 via-surface-1 to-surface-2">
      <CardContent className="p-6 sm:p-8">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-2 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
          {amountLabel}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              'rounded-lg',
              tone === 'success' && 'bg-success/15 text-success',
              tone === 'danger' && 'bg-destructive/15 text-destructive',
            )}
          >
            {deltaPct >= 0 ? '+' : ''}
            {deltaPct.toFixed(0)}% · {deltaLabel}
          </Badge>
          {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function ManagerKpiGrid({ tiles }: { tiles: ManagerKpiTile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.id} className="bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tile.label}
            </p>
            <p
              className={cn(
                'mt-2 text-2xl font-bold tabular-nums',
                tile.tone === 'primary' && 'text-primary',
                tile.tone === 'accent' && 'text-accent-foreground dark:text-accent',
              )}
            >
              {tile.value}
            </p>
            {tile.hint ? (
              <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ComparisonStrip({
  title,
  metrics,
}: {
  title: string;
  metrics: ManagerComparisonMetric[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.id} className="rounded-xl bg-surface-0/80 p-3">
            <p className="text-sm font-medium">{m.label}</p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>vs ayer: {fmtPct(m.vsYesterdayPct)}</p>
              <p>vs semana: {fmtPct(m.vsWeekPct)}</p>
              <p>vs mes: {fmtPct(m.vsMonthPct)}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function fmtPct(n: number) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(0)}%`;
}

export function InsightCardList({
  title,
  subtitle,
  emptyText,
  cards,
}: {
  title: string;
  subtitle?: string;
  emptyText: string;
  cards: BriefingCard[] | ManagerAlert[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          cards.map((card) => {
            const href = briefingActionHref(card.action);
            return (
              <div
                key={card.id}
                className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface-0/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <SeverityDot
                      severity={
                        'priority' in card
                          ? String(card.priority)
                          : String((card as BriefingCard).severity)
                      }
                    />
                    <p className="font-semibold">{card.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{card.body}</p>
                </div>
                {href && card.actionLabel ? (
                  <Button asChild size="sm" className="shrink-0 rounded-xl">
                    <Link href={href}>{card.actionLabel}</Link>
                  </Button>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        'inline-block size-2 rounded-full',
        severity === 'critical' || severity === 'danger'
          ? 'bg-destructive'
          : severity === 'warn' || severity === 'warning'
            ? 'bg-warning'
            : severity === 'success'
              ? 'bg-success'
              : severity === 'opportunity' || severity === 'action'
                ? 'bg-primary'
                : 'bg-muted-foreground',
      )}
    />
  );
}

export function UpcomingSlotsCard({
  title,
  subtitle,
  emptyText,
  rows,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  emptyText: string;
  rows: ManagerUpcomingSlot[];
  actionHref?: string | null;
  actionLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actionHref && actionLabel ? (
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-xl bg-surface-0/60 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {row.timeLabel} · {row.courtLabel}
                </p>
                <p className="text-muted-foreground">{row.playerLabel}</p>
              </div>
              <Badge variant={row.status === 'BOOKED' ? 'default' : 'secondary'}>
                {row.status}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function DeadHoursCard({
  title,
  subtitle,
  emptyText,
  rows,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  emptyText: string;
  rows: ManagerValleyRow[];
  actionHref?: string | null;
  actionLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actionHref && actionLabel ? (
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-border/50 p-3">
              <p className="font-medium">{row.title}</p>
              <p className="text-sm text-muted-foreground">{row.detail}</p>
              {row.lostRevenueLabel ? (
                <p className="mt-1 text-xs text-warning">{row.lostRevenueLabel}</p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function ByCourtList({
  title,
  subtitle,
  emptyText,
  rows,
}: {
  title: string;
  subtitle?: string;
  emptyText: string;
  rows: ManagerCourtRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          rows.map((row, i) => (
            <div
              key={row.courtId || i}
              className="flex items-center justify-between rounded-xl bg-surface-0/60 px-3 py-2"
            >
              <div>
                <p className="font-medium">{row.courtLabel}</p>
                <p className="text-sm text-muted-foreground">{row.detail}</p>
              </div>
              <p className="font-semibold tabular-nums text-primary">{row.revenueLabel}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function AtRiskList({
  title,
  subtitle,
  emptyText,
  rows,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  emptyText: string;
  rows: ManagerAtRiskPlayer[];
  actionHref?: string | null;
  actionLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actionHref && actionLabel ? (
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          rows.map((row) => (
            <div key={row.userId} className="rounded-xl bg-surface-0/60 px-3 py-2">
              <p className="font-medium">{row.nickname || row.name}</p>
              <p className="text-sm text-muted-foreground">{row.detail}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function ClientsSummaryCard({
  title,
  subtitle,
  counts,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  counts: { new: number; frequent: number; inactive: number; top: number };
  actionHref?: string | null;
  actionLabel?: string;
}) {
  const items = [
    { label: 'Nuevos', value: counts.new },
    { label: 'Frecuentes', value: counts.frequent },
    { label: 'Inactivos', value: counts.inactive },
    { label: 'Top', value: counts.top },
  ];
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actionHref && actionLabel ? (
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl bg-surface-0/70 p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ClientTable({ rows }: { rows: ManagerClientRow[] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">Sin jugadores en este segmento.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-surface-0 text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Jugador</th>
            <th className="px-3 py-2 font-medium">Partidos</th>
            <th className="px-3 py-2 font-medium">Último</th>
            <th className="px-3 py-2 font-medium">Gastado</th>
            <th className="px-3 py-2 font-medium">Deuda</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} className="border-t border-border/50">
              <td className="px-3 py-2 font-medium">{row.nickname || row.name}</td>
              <td className="px-3 py-2 tabular-nums">{row.matchesAtClub}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {row.daysSince != null ? `hace ${row.daysSince}d` : '—'}
              </td>
              <td className="px-3 py-2 tabular-nums">{formatCurrency(row.spent)}</td>
              <td className="px-3 py-2 tabular-nums text-warning">
                {formatCurrency(row.debt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-0/40 px-6 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
