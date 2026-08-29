'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useClub } from '@/contexts/ClubContext';
import { PageHeader } from '@/components/layout/AppSidebar';
import { DashboardSkeleton, EmptyState } from '@/components/club/DashboardCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

type RankingPeriod = 'weekly' | 'monthly' | 'annual';

type RankingRow = {
  user_id?: string;
  userId?: string;
  name?: string;
  nickname?: string;
  photo_url?: string | null;
  points?: number;
  matches_at_club?: number;
  matchesPlayed?: number;
  rank?: number;
  position?: number;
};

type TournamentValidation = {
  id: string;
  name?: string;
  title?: string;
  status?: string;
  club_validation_status?: string;
  organizer_name?: string;
  start_date?: string;
  startDate?: string;
};

export default function RankingPage() {
  const { activeClubId, activeClub } = useClub();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<RankingPeriod>('monthly');

  const rankingsQuery = useQuery({
    queryKey: ['club-rankings', activeClubId, period],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/rankings`, {
        params: { period, limit: 50 },
      });
      return (Array.isArray(res.data) ? res.data : res.data?.rows || []) as RankingRow[];
    },
    enabled: !!activeClubId,
  });

  const validationsQuery = useQuery({
    queryKey: ['club-tournament-validations', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/tournament-validations`);
      return (res.data || []) as TournamentValidation[];
    },
    enabled: !!activeClubId,
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      await api.post(`/tournaments/${tournamentId}/club-validation/approve`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['club-tournament-validations', activeClubId],
      });
      toast.success('Torneo validado');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo validar');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      await api.post(`/tournaments/${tournamentId}/club-validation/reject`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['club-tournament-validations', activeClubId],
      });
      toast.success('Torneo rechazado');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo rechazar');
    },
  });

  if (!activeClubId) return <EmptyState title="Seleccioná un club" />;
  if (rankingsQuery.isLoading) return <DashboardSkeleton />;

  const rows = rankingsQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Ranking" subtitle={activeClub?.name} />

      <Tabs defaultValue="ranking">
        <TabsList className="rounded-xl bg-surface-0">
          <TabsTrigger value="ranking" className="rounded-lg">
            Ranking
          </TabsTrigger>
          <TabsTrigger value="validations" className="rounded-lg">
            Validaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4 space-y-4">
          <div className="flex gap-2">
            {(
              [
                ['weekly', 'Semanal'],
                ['monthly', 'Mensual'],
                ['annual', 'Anual'],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                size="sm"
                variant={period === id ? 'default' : 'outline'}
                className="rounded-xl"
                onClick={() => setPeriod(id)}
              >
                {label}
              </Button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabla del club</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.map((row, i) => {
                const matches = row.matches_at_club ?? row.matchesPlayed;
                return (
                  <div
                    key={row.user_id || row.userId || i}
                    className="flex items-center justify-between rounded-xl bg-surface-0/70 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center font-bold text-primary tabular-nums">
                        {row.rank ?? row.position ?? i + 1}
                      </span>
                      <div>
                        <p className="font-medium">{row.nickname || row.name || 'Jugador'}</p>
                        {matches != null ? (
                          <p className="text-xs text-muted-foreground">{matches} partidos</p>
                        ) : null}
                      </div>
                    </div>
                    <p className="font-bold tabular-nums">{row.points ?? 0}</p>
                  </div>
                );
              })}
              {!rows.length ? <EmptyState title="Sin ranking aún" /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validations" className="mt-4 space-y-2">
          {(validationsQuery.data || []).map((v) => (
            <Card key={v.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{v.name || v.title || 'Torneo'}</p>
                  <p className="text-sm text-muted-foreground">
                    {v.organizer_name || 'Organizador'} ·{' '}
                    {v.club_validation_status || v.status || 'PENDING'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    {v.club_validation_status || v.status || 'PENDING'}
                  </Badge>
                  <Button
                    size="sm"
                    className="rounded-xl"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(v.id)}
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-xl"
                    disabled={rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate(v.id)}
                  >
                    Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!validationsQuery.data?.length ? (
            <EmptyState title="Sin validaciones pendientes" />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
