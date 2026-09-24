'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import {
  clubCoverUrl,
  clubDepositPercent,
  clubHourlyPrice,
  clubLogoUrl,
  type ClubDetail,
  type ClubPhoto,
  type MineClub,
} from '@/lib/types';
import {
  type ClubLocationValue,
  clubLocationFromParts,
  emptyClubLocation,
  enrichClubLocation,
} from '@/lib/geocode';
import { useClub } from '@/contexts/ClubContext';
import { type ClubTrialStatus } from '@/lib/club-trial';
import { PageHeader } from '@/components/layout/AppSidebar';
import { TrialChecklistCard } from '@/components/club/TrialStatusBanner';
import { DashboardSkeleton } from '@/components/club/DashboardCards';
import { LocationPicker } from '@/components/club/LocationPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PerfilPage() {
  const { activeClubId, activeClub, clubs, clubsLoading, setSelectedClubId, refetchClubs } =
    useClub();
  const queryClient = useQueryClient();

  const clubQuery = useQuery({
    queryKey: ['club-detail', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}`);
      return res.data as ClubDetail;
    },
    enabled: !!activeClubId,
  });

  const revenueQuery = useQuery({
    queryKey: ['club-profile-revenue', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/revenue`, { params: { days: 30 } });
      return res.data as { summary?: { totalCollected?: number; totalPending?: number } };
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

  const photosQuery = useQuery({
    queryKey: ['club-photos', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/photos`);
      return (Array.isArray(res.data) ? res.data : []) as ClubPhoto[];
    },
    enabled: !!activeClubId,
  });

  const [name, setName] = useState('');
  const [location, setLocation] = useState<ClubLocationValue>(emptyClubLocation);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [courtPricePerHour, setCourtPricePerHour] = useState('');
  const [depositPercent, setDepositPercent] = useState('');
  const [plan, setPlan] = useState('BASIC');
  const [newClubName, setNewClubName] = useState('');
  const [newClubLocation, setNewClubLocation] = useState<ClubLocationValue>(emptyClubLocation);

  useEffect(() => {
    const c = clubQuery.data;
    if (!c) return;
    setName(c.name || '');
    setLocation(
      clubLocationFromParts({
        city: c.city,
        address: c.address,
        latitude: c.latitude,
        longitude: c.longitude,
      }),
    );
    setPhone(c.phone || '');
    setEmail(c.email || '');
    setDescription(c.description || '');
    const hourly = clubHourlyPrice(c);
    const deposit = clubDepositPercent(c);
    setCourtPricePerHour(hourly ? String(hourly) : '');
    setDepositPercent(deposit ? String(deposit) : '');
    setPlan(c.subscriptionPlan || c.subscription_plan || 'BASIC');
  }, [clubQuery.data]);

  const saveClub = useMutation({
    mutationFn: async () => {
      const loc = enrichClubLocation(location);
      await api.patch(`/clubs/${activeClubId}`, {
        name: name.trim(),
        city: loc.city.trim() || undefined,
        address: loc.address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        description: description.trim() || undefined,
        latitude: loc.latitude ?? undefined,
        longitude: loc.longitude ?? undefined,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['club-detail', activeClubId] }),
        queryClient.invalidateQueries({ queryKey: ['clubs-mine'] }),
      ]);
      refetchClubs();
      toast.success('Club actualizado');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Error al guardar');
    },
  });

  const savePricing = useMutation({
    mutationFn: async () => {
      const price = Number(String(courtPricePerHour).replace(',', '.'));
      const deposit = Number(String(depositPercent).replace(',', '.') || '0');
      if (!Number.isFinite(price) || price < 0) throw new Error('Tarifa inválida');
      if (!Number.isFinite(deposit) || deposit < 0 || deposit > 100) {
        throw new Error('Seña % debe estar entre 0 y 100');
      }
      await api.patch(`/clubs/${activeClubId}`, {
        courtPricePerHour: price,
        depositPercent: deposit,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-detail', activeClubId] });
      toast.success('Tarifa actualizada');
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      toast.error(err.response?.data?.message || err.message || 'Error al guardar tarifa');
    },
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      await api.patch(`/clubs/${activeClubId}`, { subscriptionPlan: plan });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-detail', activeClubId] });
      toast.success('Plan actualizado');
    },
  });

  const createClub = useMutation({
    mutationFn: async () => {
      const loc = enrichClubLocation(newClubLocation);
      if (!loc.city.trim() && !loc.latitude) {
        throw new Error('Elegí la ubicación del club (búsqueda o GPS)');
      }
      const res = await api.post('/clubs', {
        name: newClubName.trim(),
        city: loc.city.trim() || undefined,
        address: loc.address.trim() || undefined,
        latitude: loc.latitude ?? undefined,
        longitude: loc.longitude ?? undefined,
      });
      return res.data as MineClub;
    },
    onSuccess: async (club) => {
      setNewClubName('');
      setNewClubLocation(emptyClubLocation());
      refetchClubs();
      if (club?.id) setSelectedClubId(club.id);
      toast.success('Sede creada');
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      toast.error(err.response?.data?.message || err.message || 'No se pudo crear');
    },
  });

  const uploadAsset = useMutation({
    mutationFn: async ({ kind, file }: { kind: 'logo' | 'cover'; file: File }) => {
      const form = new FormData();
      form.append(kind, file);
      await api.post(`/clubs/${activeClubId}/${kind}`, form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-detail', activeClubId] });
      refetchClubs();
      toast.success('Imagen actualizada');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Error al subir');
    },
  });

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('photo', file);
      await api.post(`/clubs/${activeClubId}/photos`, form);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['club-photos', activeClubId] }),
        queryClient.invalidateQueries({ queryKey: ['club-detail', activeClubId] }),
      ]);
      toast.success('Foto agregada para las cards');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Error al subir foto');
    },
  });

  const setPrimaryPhoto = useMutation({
    mutationFn: async (photoId: string) => {
      await api.post(`/clubs/${activeClubId}/photos/${photoId}/primary`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['club-photos', activeClubId] }),
        queryClient.invalidateQueries({ queryKey: ['club-detail', activeClubId] }),
      ]);
      toast.success('Foto principal actualizada');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo marcar como principal');
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async (photoId: string) => {
      await api.delete(`/clubs/${activeClubId}/photos/${photoId}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['club-photos', activeClubId] }),
        queryClient.invalidateQueries({ queryKey: ['club-detail', activeClubId] }),
      ]);
      toast.success('Foto eliminada');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo eliminar');
    },
  });

  const canCreateClub =
    !!newClubName.trim() &&
    (!!newClubLocation.city.trim() || newClubLocation.latitude != null) &&
    !createClub.isPending;

  const createClubForm = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {clubs.length ? 'Sedes / multi-club' : 'Creá tu club'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {clubs.length ? (
          <div className="flex flex-wrap gap-2">
            {clubs.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={c.id === activeClubId ? 'default' : 'outline'}
                className="rounded-xl"
                onClick={() => setSelectedClubId(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no tenés una sede. Creá la primera e integrá la ubicación para empezar a
            publicar turnos y cobrar.
          </p>
        )}
        <div className="space-y-1">
          <Label>Nombre de la sede</Label>
          <Input
            placeholder="Ej: Palermo Pádel Club"
            value={newClubName}
            onChange={(e) => setNewClubName(e.target.value)}
            className="rounded-xl"
          />
        </div>
        <LocationPicker
          value={newClubLocation}
          onChange={setNewClubLocation}
          compact
          requiredHint
        />
        <Button
          className="rounded-xl"
          disabled={!canCreateClub}
          onClick={() => createClub.mutate()}
        >
          {clubs.length ? 'Crear sede' : 'Crear club'}
        </Button>
      </CardContent>
    </Card>
  );

  if (clubsLoading) return <DashboardSkeleton />;

  if (!activeClubId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Perfil del club"
          subtitle="Creá tu primera sede para activar el panel"
        />
        {createClubForm}
      </div>
    );
  }

  if (clubQuery.isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Perfil del club" subtitle={activeClub?.name} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <LocationPicker value={location} onChange={setLocation} />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Descripción</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <Button
              className="rounded-xl sm:col-span-2"
              onClick={() => saveClub.mutate()}
              disabled={saveClub.isPending}
            >
              Guardar datos
            </Button>
            <div className="space-y-1">
              <Label>Tarifa base / hora</Label>
              <Input
                value={courtPricePerHour}
                onChange={(e) => setCourtPricePerHour(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Seña (%)</Label>
              <Input
                value={depositPercent}
                onChange={(e) => setDepositPercent(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <Button
              className="rounded-xl sm:col-span-2"
              variant="secondary"
              onClick={() => savePricing.mutate()}
              disabled={savePricing.isPending}
            >
              Guardar tarifa
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <TrialChecklistCard trial={trialQuery.data} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Imágenes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clubLogoUrl(clubQuery.data) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clubLogoUrl(clubQuery.data)!}
                  alt="Logo"
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : null}
              <div className="space-y-1">
                <Label className="text-sm">Logo</Label>
                <Input
                  type="file"
                  accept="image/*"
                  className="rounded-xl"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAsset.mutate({ kind: 'logo', file });
                    e.target.value = '';
                  }}
                />
              </div>
              {clubCoverUrl(clubQuery.data) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clubCoverUrl(clubQuery.data)!}
                  alt="Cover"
                  className="h-28 w-full rounded-xl object-cover"
                />
              ) : null}
              <div className="space-y-1">
                <Label className="text-sm">Cover del perfil</Label>
                <Input
                  type="file"
                  accept="image/*"
                  className="rounded-xl"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAsset.mutate({ kind: 'cover', file });
                    e.target.value = '';
                  }}
                />
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div>
                  <Label className="text-sm">Fotos para cards de partidos</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Se muestran en los partidos abiertos. Marcá una como principal.
                  </p>
                </div>
                {(photosQuery.data || []).length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(photosQuery.data || []).map((photo) => (
                      <div
                        key={photo.id}
                        className="overflow-hidden rounded-xl border border-border bg-surface-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.photoUrl}
                          alt="Foto del club"
                          className="h-24 w-full object-cover"
                        />
                        <div className="flex flex-col gap-1 p-2">
                          {photo.isPrimary ? (
                            <span className="text-[11px] font-semibold text-primary">Principal</span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-lg text-[11px]"
                              disabled={setPrimaryPhoto.isPending}
                              onClick={() => setPrimaryPhoto.mutate(photo.id)}
                            >
                              Usar en cards
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-lg text-[11px] text-destructive"
                            disabled={deletePhoto.isPending}
                            onClick={() => deletePhoto.mutate(photo.id)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Todavía no hay fotos. Subí una de la cancha para las cards.
                  </p>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  className="rounded-xl"
                  disabled={uploadPhoto.isPending || (photosQuery.data?.length ?? 0) >= 8}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPhoto.mutate(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan operativo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASIC">BASIC</SelectItem>
                  <SelectItem value="GROWTH">GROWTH</SelectItem>
                  <SelectItem value="PRO">PRO</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full rounded-xl" variant="outline" onClick={() => savePlan.mutate()}>
                Actualizar plan
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen 30d</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Cobrado:{' '}
                <span className="font-semibold">
                  {formatCurrency(revenueQuery.data?.summary?.totalCollected || 0)}
                </span>
              </p>
              <p>
                Pendiente:{' '}
                <span className="font-semibold text-warning">
                  {formatCurrency(revenueQuery.data?.summary?.totalPending || 0)}
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {createClubForm}
    </div>
  );
}
