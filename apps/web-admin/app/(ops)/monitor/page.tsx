'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, RefreshCw, Swords, Trophy, Users } from 'lucide-react';
import { TrendChart } from '@/components/charts/TrendChart';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  formatCompact,
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatRelative,
  formatWeekLabel,
} from '@/lib/format';
import { ActionCenter } from './_components/ActionCenter';
import { BillingBreakdown } from './_components/BillingBreakdown';
import { KpiTile } from './_components/KpiTile';
import { NetworkHealth } from './_components/NetworkHealth';
import { RecentList } from './_components/RecentList';
import type { MonitorData, TrendSeries, TrendsData } from './_components/types';

const SERIES: { key: TrendSeries; label: string }[] = [
  { key: 'users', label: 'Usuarios' },
  { key: 'clubs', label: 'Clubes' },
  { key: 'matches', label: 'Partidos' },
  { key: 'tournaments', label: 'Torneos' },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buen día';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function MonitorSkeleton() {
  return (
    <div className="bento" aria-busy="true" aria-label="Cargando monitoreo">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="bento-tile kpi-tile skeleton" />
      ))}
      <div className="bento-tile span-8 skeleton skeleton--chart" />
      <div className="bento-tile span-4 skeleton skeleton--chart" />
    </div>
  );
}

export default function MonitorPage() {
  const { user } = useAuth();
  const [series, setSeries] = useState<TrendSeries>('users');

  const monitor = useQuery({
    queryKey: ['platform-monitor'],
    queryFn: async () => (await api.get<MonitorData>('/platform/monitor')).data,
    refetchInterval: 120_000,
  });
  const trends = useQuery({
    queryKey: ['platform-monitor-trends', 12],
    queryFn: async () =>
      (await api.get<TrendsData>('/platform/monitor/trends', { params: { weeks: 12 } })).data,
    refetchInterval: 300_000,
  });

  const weeks = useMemo(() => trends.data?.weeks ?? [], [trends.data]);
  const seriesOf = (key: TrendSeries) => (weeks.length ? weeks.map((week) => week[key]) : undefined);
  const activityData = weeks.map((week) => ({ label: formatWeekLabel(week.weekStart), value: week[series] }));
  const revenueData = weeks.map((week) => ({ label: formatWeekLabel(week.weekStart), value: week.revenue }));
  const periodTotal = weeks.reduce((sum, week) => sum + week[series], 0);
  const revenueTotal = weeks.reduce((sum, week) => sum + week.revenue, 0);
  const activeSeriesLabel = SERIES.find((entry) => entry.key === series)?.label ?? '';

  const refreshing = monitor.isFetching || trends.isFetching;
  const refresh = () => {
    void monitor.refetch();
    void trends.refetch();
  };

  const data = monitor.data;
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="monitor">
      <header className="ops-page-header">
        <div>
          <p className="ops-page-kicker">
            <span className="live-dot" aria-hidden />
            Operación en vivo
          </p>
          <h1 className="ops-page-title">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="ops-page-subtitle">
            {data
              ? `Snapshot de la plataforma · actualizado ${formatRelative(data.generatedAt)}`
              : 'Snapshot de la plataforma'}
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={16} aria-hidden className={refreshing ? 'spin' : undefined} />
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      {monitor.isLoading ? (
        <MonitorSkeleton />
      ) : monitor.isError || !data ? (
        <div className="bento-tile error-tile" role="alert">
          <p>No se pudo cargar el monitoreo.</p>
          <button type="button" className="btn btn-outline" onClick={refresh}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <ActionCenter totals={data.totals} />

          <div className="bento">
            <KpiTile index={0} href="/users" label="Usuarios" value={data.totals.users} icon={Users} series={seriesOf('users')} />
            <KpiTile index={1} href="/clubs" label="Clubes" value={data.totals.clubs} icon={Building2} series={seriesOf('clubs')} />
            <KpiTile index={2} href="/matches" label="Partidos" value={data.totals.matches} icon={Swords} series={seriesOf('matches')} />
            <KpiTile index={3} href="/tournaments" label="Torneos" value={data.totals.tournaments} icon={Trophy} series={seriesOf('tournaments')} />

            <section className="bento-tile span-8 reveal" style={{ '--reveal-index': 4 } as React.CSSProperties} aria-labelledby="activity-title">
              <header className="tile-header">
                <div>
                  <h2 id="activity-title" className="tile-title">
                    Actividad semanal
                  </h2>
                  <p className="tile-subtitle">
                    <span className="num">{formatNumber(periodTotal)}</span> {activeSeriesLabel.toLowerCase()} nuevos en 12 semanas
                  </p>
                </div>
                <div className="segmented" role="group" aria-label="Serie del gráfico">
                  {SERIES.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      className={`segmented-btn${series === entry.key ? ' segmented-btn--active' : ''}`}
                      aria-pressed={series === entry.key}
                      onClick={() => setSeries(entry.key)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </header>
              {trends.isError ? (
                <p className="chart-empty" role="alert">No se pudieron cargar las tendencias.</p>
              ) : trends.isLoading ? (
                <div className="skeleton skeleton--plot" aria-busy="true" />
              ) : (
                <TrendChart data={activityData} seriesLabel={`${activeSeriesLabel} nuevos`} formatValue={formatCompact} />
              )}
            </section>

            <div className="span-4 reveal" style={{ '--reveal-index': 5 } as React.CSSProperties}>
              <NetworkHealth totals={data.totals} />
            </div>

            <section className="bento-tile span-7 reveal" style={{ '--reveal-index': 6 } as React.CSSProperties} aria-labelledby="revenue-title">
              <header className="tile-header">
                <div>
                  <h2 id="revenue-title" className="tile-title">
                    Turnos cobrados
                  </h2>
                  <p className="tile-subtitle">Depósitos aprobados por semana</p>
                </div>
                <p className="tile-figure num">{formatCurrency(revenueTotal)}</p>
              </header>
              {trends.isError ? (
                <p className="chart-empty" role="alert">No se pudieron cargar las tendencias.</p>
              ) : trends.isLoading ? (
                <div className="skeleton skeleton--plot" aria-busy="true" />
              ) : (
                <TrendChart
                  data={revenueData}
                  variant="bar"
                  seriesLabel="Turnos cobrados"
                  formatValue={formatCurrency}
                  formatAxis={formatCurrencyCompact}
                  height={200}
                />
              )}
            </section>

            <div className="span-5 reveal" style={{ '--reveal-index': 7 } as React.CSSProperties}>
              <BillingBreakdown rows={data.billingBreakdown} />
            </div>

            <div className="span-6 reveal" style={{ '--reveal-index': 8 } as React.CSSProperties}>
              <RecentList
                title="Clubes recientes"
                seeAllHref="/clubs"
                category="billingStatus"
                items={data.recentClubs.map((club) => ({
                  id: club.id,
                  href: `/clubs/${club.id}`,
                  name: club.name,
                  secondary: club.city,
                  status: club.billingStatus,
                  createdAt: club.createdAt,
                }))}
              />
            </div>
            <div className="span-6 reveal" style={{ '--reveal-index': 9 } as React.CSSProperties}>
              <RecentList
                title="Usuarios recientes"
                seeAllHref="/users"
                category="userRole"
                items={data.recentUsers.map((recent) => ({
                  id: recent.id,
                  href: `/users/${recent.id}`,
                  name: recent.name,
                  secondary: recent.email,
                  status: recent.role,
                  createdAt: recent.createdAt,
                }))}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
