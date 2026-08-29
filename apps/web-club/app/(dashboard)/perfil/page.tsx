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
  type MineClub,
} from '@/lib/types';
import { useClub } from '@/contexts/ClubContext';
import { PageHeader } from '@/components/layout/AppSidebar';
import { DashboardSkeleton } from '@/components/club/DashboardCards';
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

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [zone, setZone] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [courtPricePerHour, setCourtPricePerHour] = useState('');
  const [depositPercent, setDepositPercent] = useState('');
  const [plan, setPlan] = useState('BASIC');
  const [newClubName, setNewClubName] = useState('');
  const [newClubCity, setNewClubCity] = useState('');
  const [newClubZone, setNewClubZone] = useState('');

  useEffect(() => {
    const c = clubQuery.data;
    if (!c) return;
    setName(c.name || '');
    setCity(c.city || '');
    setZone(c.zone || '');
    setAddress(c.address || '');
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
      await api.patch(`/clubs/${activeClubId}`, {
        name: name.trim(),
        city: city.trim() || undefined,
        zone: zone.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        description: description.trim() || undefined,
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
      const res = await api.post('/clubs', {
        name: newClubName.trim(),
        city: newClubCity.trim() || undefined,
        zone: newClubZone.trim() || undefined,
      });
      return res.data as MineClub;
    },
    onSuccess: async (club) => {
      setNewClubName('');
      setNewClubCity('');
      setNewClubZone('');
      refetchClubs();
      if (club?.id) setSelectedClubId(club.id);
      toast.success('Sede creada');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo crear');
    },
  });

  const uploadAsset = useMutation({
    mutationFn: async ({ kind, file }: { kind: 'logo' | 'cover'; file: File }) => {
      const form = new FormData();
      form.append('file', file);
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
            Todavía no tenés una sede. Creá la primera para empezar a publicar turnos y cobrar.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-4">
          <Input
            placeholder="Nombre nueva sede"
            value={newClubName}
            onChange={(e) => setNewClubName(e.target.value)}
            className="rounded-xl"
          />
          <Input
            placeholder="Ciudad"
            value={newClubCity}
            onChange={(e) => setNewClubCity(e.target.value)}
            className="rounded-xl"
          />
          <Input
            placeholder="Zona"
            value={newClubZone}
            onChange={(e) => setNewClubZone(e.target.value)}
            className="rounded-xl"
          />
          <Button
            className="rounded-xl"
            disabled={!newClubName.trim() || createClub.isPending}
            onClick={() => createClub.mutate()}
          >
            {clubs.length ? 'Crear sede' : 'Crear club'}
          </Button>
        </div>
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
            <div className="space-y-1">
              <Label>Ciudad</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Zona</Label>
              <Input value={zone} onChange={(e) => setZone(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Dirección</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} className="rounded-xl" />
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Imágenes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {clubLogoUrl(clubQuery.data) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clubLogoUrl(clubQuery.data)!}
                  alt="Logo"
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : null}
              <Label className="text-sm">Logo</Label>
              <Input
                type="file"
                accept="image/*"
                className="rounded-xl"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAsset.mutate({ kind: 'logo', file });
                }}
              />
              {clubCoverUrl(clubQuery.data) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clubCoverUrl(clubQuery.data)!}
                  alt="Cover"
                  className="mt-2 h-28 w-full rounded-xl object-cover"
                />
              ) : null}
              <Label className="text-sm">Cover</Label>
              <Input
                type="file"
                accept="image/*"
                className="rounded-xl"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAsset.mutate({ kind: 'cover', file });
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan</CardTitle>
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
