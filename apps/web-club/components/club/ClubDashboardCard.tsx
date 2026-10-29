'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Metric } from '@/components/club/OutreachStatsCard';

type ClubDashboard = {
  openSlots: number;
  slotsThisWeek: number;
  bonusPointsOffered: number;
  uniquePlayers30d: number;
  matchesFinished30d: number;
  activeMatches: number;
  rotationIndex: number;
  monthKey: string;
  leaderboard: Array<{
    user_id: string;
    name: string;
    nickname?: string | null;
    points: number;
    matches_at_club: number;
    rank: number | string;
  }>;
  autoFillGapsEnabled: boolean;
};

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

export function ClubDashboardCard({ clubId, enabled }: { clubId: string; enabled: boolean }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['club-dashboard', clubId],
    queryFn: async () => (await api.get(`/clubs/${clubId}/dashboard`)).data as ClubDashboard,
    enabled: !!clubId && enabled,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resumen del club</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : isError || !data ? (
          <p className="text-sm text-muted-foreground">No se pudo cargar el resumen.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Horarios libres publicados" value={data.openSlots} />
              <Metric label="Horarios esta semana" value={data.slotsThisWeek} />
              <Metric label="Partidos por jugarse" value={data.activeMatches} />
              <Metric label="Partidos jugados (30 días)" value={data.matchesFinished30d} />
              <Metric label="Jugadores distintos (30 días)" value={data.uniquePlayers30d} />
              <Metric
                label="Rotación de jugadores"
                value={data.matchesFinished30d > 0 ? `${data.rotationIndex}%` : '–'}
                hint="Cuánto se renueva la gente que juega en el club"
              />
            </div>
            {data.bonusPointsOffered > 0 ? (
              <p className="text-sm text-muted-foreground">
                Hay {data.bonusPointsOffered} puntos promo ofrecidos en horarios abiertos.
              </p>
            ) : null}

            <div>
              <p className="mb-2 text-sm font-medium">Top del mes · {monthLabel(data.monthKey)}</p>
              {data.leaderboard.length ? (
                <ol className="space-y-1.5">
                  {data.leaderboard.map((entry) => (
                    <li
                      key={entry.user_id}
                      className="flex items-center justify-between rounded-xl bg-surface-0 px-3 py-2 text-sm"
                    >
                      <span className="truncate">
                        <span className="mr-2 tabular-nums text-muted-foreground">{entry.rank}.</span>
                        {entry.nickname || entry.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {entry.points} pts · {entry.matches_at_club} PJ
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Todavía nadie sumó puntos este mes en el club.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
