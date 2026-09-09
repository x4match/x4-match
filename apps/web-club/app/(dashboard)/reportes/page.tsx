'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { useClub } from '@/contexts/ClubContext';
import { PageHeader } from '@/components/layout/AppSidebar';
import { DashboardSkeleton, EmptyState } from '@/components/club/DashboardCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/currency';

type OccupancyReport = {
  clubName: string;
  periodDays: number;
  courtPricePerHour: number;
  occupancy: {
    overallPct: number;
    totalSlots: number;
    bookedSlots: number;
    bookedHours: number;
    byDay: Array<{
      day: string;
      totalSlots: number;
      bookedSlots: number;
      bookedHours: number;
      occupancyPct: number;
    }>;
    peaks: Array<{ hour: number; occupancyPct: number; totalSlots: number }>;
    valleys: Array<{ hour: number; occupancyPct: number; totalSlots: number }>;
  };
  byCourt: Array<{
    courtLabel: string;
    occupancyPct: number;
    bookedHours: number;
    estimatedRevenue: number;
    totalSlots: number;
    bookedSlots: number;
  }>;
  profitability: {
    estimatedCourtRevenue: number;
    collectedDeposits: number;
    shopRevenue: number;
    estimatedTotal: number;
    collectedTotal: number;
    note: string;
  };
};

export default function ReportesPage() {
  const { activeClubId, activeClub } = useClub();
  const [days, setDays] = useState('30');

  const reportQuery = useQuery({
    queryKey: ['occupancy-report', activeClubId, days],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/occupancy-report`, {
        params: { days },
      });
      return res.data as OccupancyReport;
    },
    enabled: !!activeClubId,
  });

  if (!activeClubId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reportes" subtitle="Ocupación y rentabilidad" />
        <EmptyState title="Elegí un club" description="Seleccioná un club activo en el menú." />
      </div>
    );
  }

  const report = reportQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        subtitle={`${activeClub?.name || 'Club'} · ocupación, horas pico y rentabilidad estimada`}
        actions={
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="14">14 días</SelectItem>
              <SelectItem value="30">30 días</SelectItem>
              <SelectItem value="60">60 días</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {reportQuery.isLoading ? <DashboardSkeleton /> : null}

      {report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Ocupación</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-extrabold">{report.occupancy.overallPct}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {report.occupancy.bookedSlots}/{report.occupancy.totalSlots} turnos
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Horas reservadas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-extrabold">{report.occupancy.bookedHours}h</p>
                <p className="text-xs text-muted-foreground mt-1">Últimos {report.periodDays} días</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Ingreso estimado canchas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-extrabold">
                  {formatCurrency(report.profitability.estimatedCourtRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tarifa {formatCurrency(report.courtPricePerHour)}/h
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Cobrado real</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-extrabold">
                  {formatCurrency(report.profitability.collectedTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Señas {formatCurrency(report.profitability.collectedDeposits)} · tienda{' '}
                  {formatCurrency(report.profitability.shopRevenue)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="size-4" /> Horas pico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.occupancy.peaks.map((p) => (
                  <div key={`peak-${p.hour}`} className="flex items-center justify-between rounded-xl border px-3 py-2">
                    <span className="font-medium">{String(p.hour).padStart(2, '0')}:00</span>
                    <Badge>{p.occupancyPct}%</Badge>
                  </div>
                ))}
                {!report.occupancy.peaks.length ? (
                  <p className="text-sm text-muted-foreground">Sin datos suficientes.</p>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Horas valle</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.occupancy.valleys.map((p) => (
                  <div key={`valley-${p.hour}`} className="flex items-center justify-between rounded-xl border px-3 py-2">
                    <span className="font-medium">{String(p.hour).padStart(2, '0')}:00</span>
                    <Badge variant="secondary">{p.occupancyPct}%</Badge>
                  </div>
                ))}
                {!report.occupancy.valleys.length ? (
                  <p className="text-sm text-muted-foreground">Sin datos suficientes.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Por cancha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.byCourt.map((c) => (
                <div
                  key={c.courtLabel}
                  className="flex flex-col gap-1 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{c.courtLabel}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.bookedHours}h reservadas · {c.bookedSlots}/{c.totalSlots} turnos
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{c.occupancyPct}% ocup.</Badge>
                    <Badge>{formatCurrency(c.estimatedRevenue)}</Badge>
                  </div>
                </div>
              ))}
              {!report.byCourt.length ? (
                <EmptyState title="Sin canchas" description="Todavía no hay turnos en el período." />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rentabilidad estimada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-surface-0 p-3">
                  <p className="text-xs text-muted-foreground">Estimado canchas</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(report.profitability.estimatedCourtRevenue)}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-0 p-3">
                  <p className="text-xs text-muted-foreground">Tienda confirmada</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(report.profitability.shopRevenue)}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-0 p-3">
                  <p className="text-xs text-muted-foreground">Total estimado</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(report.profitability.estimatedTotal)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{report.profitability.note}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ocupación por día</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: 120 }}>
                {report.occupancy.byDay.map((d) => (
                  <div key={d.day} className="flex w-8 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-primary/80"
                      style={{ height: `${Math.max(4, d.occupancyPct)}px` }}
                      title={`${d.day}: ${d.occupancyPct}%`}
                    />
                    <span className="text-[9px] text-muted-foreground">{d.day.slice(8)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
