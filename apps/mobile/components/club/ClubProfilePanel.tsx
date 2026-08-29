import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Alert, RefreshControl, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { themePreferenceLabel, useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@/lib/currency';
import { shareRevenueCsv, type ClubRevenueResponse, type RevenueMovement } from '@/lib/club-revenue';
import { confirmShopPurchase, markDepositPaid } from '@/lib/shop-api';
import { pickAndUploadClubLogo, showClubLogoOptions } from '@/lib/club-logo';
import { pickAndUploadClubCover, showClubCoverOptions } from '@/lib/club-cover';
import { getTabScreenPaddingBottom } from '@/lib/layout';
import { ui } from '@/theme/tokens';
import {
  AppCard,
  PrimaryButton,
  InputField,
  EmptyState,
  SectionHeader,
  SelectionChip,
  Avatar,
  ProfilePhotoViewer,
} from '@/components/padely';
import { RevenueMovementRow } from '@/components/club/RevenueMovementRow';

async function geocodeClubAddress(parts: Array<string | undefined | null>) {
  const query = parts.map((p) => p?.trim()).filter(Boolean).join(', ');
  if (!query) return null;
  try {
    const results = await Location.geocodeAsync(query);
    const first = results?.[0];
    if (!first || !Number.isFinite(first.latitude) || !Number.isFinite(first.longitude)) {
      return null;
    }
    return { latitude: first.latitude, longitude: first.longitude };
  } catch {
    return null;
  }
}

type ClubTab = 'data' | 'venues' | 'subscription' | 'settings' | 'billing';
type RevenuePeriod = 7 | 30 | 90;

interface ClubRow {
  id: string;
  name: string;
  city?: string;
  zone?: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  logo_url?: string;
  cover_url?: string;
  subscription_plan?: string;
  court_price_per_hour?: number;
  courtPricePerHour?: number;
  deposit_percent?: number;
  depositPercent?: number;
}

interface ClubRevenue {
  summary: ClubRevenueResponse['summary'];
  recent: ClubRevenueResponse['recent'];
}

const CLUB_TABS: { key: ClubTab; label: string }[] = [
  { key: 'data', label: 'Datos' },
  { key: 'venues', label: 'Sedes' },
  { key: 'subscription', label: 'Plan' },
  { key: 'settings', label: 'Config' },
  { key: 'billing', label: 'Factura' },
];

const PLANS = [
  { id: 'BASIC', label: 'Básico', price: 'Gratis', desc: 'Gestión esencial del club', multiplier: 'x1' },
  { id: 'GROWTH', label: 'Growth', price: 'Consultar', desc: 'Multiplicador en horarios promo', multiplier: 'x1.5' },
  { id: 'PRO', label: 'Pro', price: 'Consultar', desc: 'Máximo alcance y promos', multiplier: 'x2' },
] as const;

function planLabel(plan?: string) {
  return PLANS.find((p) => p.id === plan)?.label ?? 'Básico';
}

function ClubTabBar({ active, onChange }: { active: ClubTab; onChange: (t: ClubTab) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {CLUB_TABS.map((tab) => (
          <SelectionChip key={tab.key} label={tab.label} selected={active === tab.key} onPress={() => onChange(tab.key)} />
        ))}
      </View>
    </ScrollView>
  );
}

type ClubProfilePanelProps = {
  onLogout: () => void;
};

export function ClubProfilePanel({ onLogout }: ClubProfilePanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { preference, cyclePreference } = useTheme();
  const insets = useSafeAreaInsets();
  const contentPaddingBottom = getTabScreenPaddingBottom(insets.bottom);

  const [tab, setTab] = useState<ClubTab>('data');
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>(30);

  const [clubName, setClubName] = useState('');
  const [clubCity, setClubCity] = useState('');
  const [clubZone, setClubZone] = useState('');
  const [clubAddress, setClubAddress] = useState('');
  const [clubPhone, setClubPhone] = useState('');
  const [clubEmail, setClubEmail] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [courtPricePerHour, setCourtPricePerHour] = useState('');
  const [depositPercent, setDepositPercent] = useState('');
  const [localLogoUri, setLocalLogoUri] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showLogoViewer, setShowLogoViewer] = useState(false);
  const [localCoverUri, setLocalCoverUri] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [showCreateVenue, setShowCreateVenue] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [venueCity, setVenueCity] = useState('');
  const [venueZone, setVenueZone] = useState('');

  const { data: clubs, refetch: refetchClubs, isLoading: loadingClubs } = useQuery({
    queryKey: ['club-profile-clubs', user?.id],
    queryFn: async () => {
      const res = await api.get('/clubs/mine');
      return res.data as ClubRow[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!clubs?.length && user?.name && !venueName.trim()) {
      setVenueName(user.name);
    }
  }, [clubs?.length, user?.name, venueName]);

  const defaultClubId = useMemo(() => clubs?.[0]?.id || null, [clubs]);

  const activeClubId = useMemo(() => {
    if (selectedClubId && clubs?.some((c) => c.id === selectedClubId)) {
      return selectedClubId;
    }
    return defaultClubId;
  }, [selectedClubId, clubs, defaultClubId]);
  const activeClub = clubs?.find((c) => c.id === activeClubId);

  const { data: clubDetail, refetch: refetchClubDetail } = useQuery({
    queryKey: ['club-profile-detail', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}`);
      return res.data as ClubRow;
    },
    enabled: !!activeClubId,
  });

  const { data: revenue, isLoading: loadingRevenue, isError: revenueError, refetch: refetchRevenue } = useQuery({
    queryKey: ['club-profile-revenue', activeClubId, revenuePeriod],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/revenue`, {
        params: { days: revenuePeriod, movementsLimit: 8 },
      });
      return res.data as ClubRevenue;
    },
    enabled: !!activeClubId && tab === 'billing',
  });

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const markPaidMutation = useMutation({
    mutationFn: async (item: RevenueMovement) => {
      if (!activeClubId) throw new Error('Club inválido');
      setConfirmingId(item.id);
      if (item.kind === 'shop') {
        return confirmShopPurchase(activeClubId, item.id);
      }
      return markDepositPaid(activeClubId, item.id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['club-profile-revenue'] }),
        queryClient.invalidateQueries({ queryKey: ['club-billing-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['club-manager-report'] }),
        queryClient.invalidateQueries({ queryKey: ['club-shop-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['club-shop-sales'] }),
      ]);
      Alert.alert('Listo', 'Cobro registrado en recepción.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo registrar el cobro');
    },
    onSettled: () => setConfirmingId(null),
  });

  const previewMovements = revenue?.recent.slice(0, 5) ?? [];

  const openAllMovements = () => {
    if (!activeClubId) return;
    router.push({
      pathname: '/club-billing',
      params: {
        clubId: activeClubId,
        clubName: activeClub?.name || 'Club',
        days: String(revenuePeriod),
      },
    } as any);
  };

  const exportBillingCsv = async () => {
    if (!activeClubId || !activeClub) return;
    try {
      const res = await api.get<ClubRevenueResponse>(`/clubs/${activeClubId}/revenue`, {
        params: { days: revenuePeriod, movementsLimit: 500 },
      });
      if (!res.data.recent.length) {
        Alert.alert('Sin datos', 'No hay movimientos para exportar en este período.');
        return;
      }
      await shareRevenueCsv({
        clubName: activeClub.name,
        periodDays: revenuePeriod,
        summary: res.data.summary,
        movements: res.data.recent,
      });
    } catch {
      Alert.alert('Error', 'No se pudo exportar el CSV.');
    }
  };

  const syncForm = (club?: ClubRow) => {
    if (!club) return;
    setClubName(club.name || '');
    setClubCity(club.city || '');
    setClubZone(club.zone || '');
    setClubAddress(club.address || '');
    setClubPhone(club.phone || '');
    setClubEmail(club.email || '');
    setClubDescription(club.description || '');
    const hourly = Number(club.courtPricePerHour ?? club.court_price_per_hour ?? 0);
    const deposit = Number(club.depositPercent ?? club.deposit_percent ?? 0);
    setCourtPricePerHour(hourly > 0 ? String(Math.round(hourly)) : '');
    setDepositPercent(deposit > 0 ? String(Math.round(deposit)) : '');
  };

  useEffect(() => {
    setLocalLogoUri(null);
    setLocalCoverUri(null);
  }, [activeClubId]);

  useEffect(() => {
    if (clubDetail) syncForm(clubDetail);
    else if (activeClub) syncForm(activeClub);
  }, [clubDetail, activeClub]);

  const clubLogo =
    localLogoUri || clubDetail?.logo_url || activeClub?.logo_url || null;
  const clubCover =
    localCoverUri || clubDetail?.cover_url || activeClub?.cover_url || null;

  const handleChangeLogo = async (source: 'library' | 'camera') => {
    if (!activeClubId) return;
    setUploadingLogo(true);
    try {
      const logoUrl = await pickAndUploadClubLogo(activeClubId, source);
      if (!logoUrl) return;
      setLocalLogoUri(logoUrl);
      await queryClient.invalidateQueries({ queryKey: ['club-profile-clubs'] });
      await queryClient.invalidateQueries({ queryKey: ['club-profile-detail', activeClubId] });
      await queryClient.invalidateQueries({ queryKey: ['club', activeClubId] });
      await queryClient.invalidateQueries({ queryKey: ['clubs'] });
      await queryClient.invalidateQueries({ queryKey: ['clubs-home-search'] });
      Alert.alert('Listo', 'Logo del club actualizado');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleChangeCover = async (source: 'library' | 'camera') => {
    if (!activeClubId) return;
    setUploadingCover(true);
    try {
      const coverUrl = await pickAndUploadClubCover(activeClubId, source);
      if (!coverUrl) return;
      setLocalCoverUri(coverUrl);
      await queryClient.invalidateQueries({ queryKey: ['club-profile-clubs'] });
      await queryClient.invalidateQueries({ queryKey: ['club-profile-detail', activeClubId] });
      await queryClient.invalidateQueries({ queryKey: ['club', activeClubId] });
      await queryClient.invalidateQueries({ queryKey: ['clubs'] });
      Alert.alert('Listo', 'Portada del club actualizada');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleLogoPress = () => {
    if (!activeClubId) return;
    showClubLogoOptions({
      hasLogo: !!clubLogo,
      onView: clubLogo ? () => setShowLogoViewer(true) : undefined,
      onPick: (source) => {
        void handleChangeLogo(source);
      },
    });
  };

  const handleCoverPress = () => {
    if (!activeClubId) return;
    showClubCoverOptions({
      hasCover: !!clubCover,
      onPick: (source) => {
        void handleChangeCover(source);
      },
    });
  };

  const updateClub = useMutation({
    mutationFn: async (payload: Record<string, string | number>) => {
      if (!activeClubId) return;
      await api.patch(`/clubs/${activeClubId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-profile-clubs'] });
      queryClient.invalidateQueries({ queryKey: ['club-profile-detail', activeClubId] });
      queryClient.invalidateQueries({ queryKey: ['club', activeClubId] });
      queryClient.invalidateQueries({ queryKey: ['club-detail-slots', activeClubId] });
      queryClient.invalidateQueries({ queryKey: ['club-manager-report', activeClubId] });
      Alert.alert('Listo', 'Datos del club actualizados');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo guardar'),
  });

  const updatePlan = useMutation({
    mutationFn: async (subscriptionPlan: string) => {
      if (!activeClubId) return;
      await api.patch(`/clubs/${activeClubId}`, { subscriptionPlan });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-profile-clubs'] });
      queryClient.invalidateQueries({ queryKey: ['club-profile-detail', activeClubId] });
      Alert.alert('Listo', 'Plan de suscripción actualizado');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo cambiar el plan'),
  });

  const createVenue = useMutation({
    mutationFn: async () => {
      if (!venueName.trim()) throw new Error('Indicá el nombre del club');
      const res = await api.post('/clubs', {
        name: venueName.trim(),
        city: venueCity.trim() || undefined,
        zone: venueZone.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      setVenueName('');
      setVenueCity('');
      setVenueZone('');
      setShowCreateVenue(false);
      queryClient.invalidateQueries({ queryKey: ['club-profile-clubs'] });
      queryClient.invalidateQueries({ queryKey: ['clubs-mine'] });
      queryClient.invalidateQueries({ queryKey: ['club-admin-clubs'] });
      Alert.alert('Listo', 'Club creado');
    },
    onError: (err: any) =>
      Alert.alert(
        'Error',
        err?.message || err.response?.data?.message || 'No se pudo crear el club',
      ),
  });

  const onRefresh = () => {
    refetchClubs();
    if (activeClubId) refetchClubDetail();
    if (tab === 'billing') refetchRevenue();
  };

  const isLoading = loadingClubs || (tab === 'billing' && loadingRevenue);
  const currentPlan = clubDetail?.subscription_plan || activeClub?.subscription_plan || 'BASIC';

  const createClubForm = (
    <AppCard style={{ marginBottom: 12 }}>
      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 4, fontSize: 16 }}>
        Crear tu club
      </Text>
      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 12, lineHeight: 17 }}>
        Vas a poder gestionar canchas, horarios, tienda y ranking desde acá.
      </Text>
      <InputField
        label="Nombre del club"
        value={venueName}
        onChangeText={setVenueName}
        placeholder="Pádel Center Palermo"
      />
      <InputField label="Ciudad" value={venueCity} onChangeText={setVenueCity} placeholder="Buenos Aires" />
      <InputField label="Zona" value={venueZone} onChangeText={setVenueZone} placeholder="Palermo" />
      <PrimaryButton
        label="Crear club"
        fullWidth
        loading={createVenue.isPending}
        onPress={() => createVenue.mutate()}
        style={{ marginTop: 4 }}
      />
    </AppCard>
  );

  if (loadingClubs) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
        <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando perfil del club...</Text>
      </View>
    );
  }

  if (!clubs?.length) {
    return (
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: contentPaddingBottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <EmptyState
          icon={<Ionicons name="business-outline" size={32} color={ui.colors.textMuted} />}
          title="Bienvenido a x4 match"
          description="Creá tu club para empezar a gestionar canchas, turnos y clientes."
        />
        <View style={{ marginTop: 8 }}>{createClubForm}</View>
        <TouchableOpacity onPress={onLogout} activeOpacity={0.8} style={{ marginTop: 24 }}>
          <AppCard padding="sm">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="log-out-outline" size={22} color={ui.colors.danger} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: ui.colors.danger }}>Cerrar sesión</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
            </View>
          </AppCard>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={ui.colors.primary} />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ marginBottom: ui.spacing.lg }}>
        <TouchableOpacity
          onPress={handleCoverPress}
          disabled={uploadingCover || !activeClubId}
          activeOpacity={0.9}
        >
          <View
            style={{
              height: 140,
              borderRadius: ui.radius.lg,
              overflow: 'hidden',
              backgroundColor: ui.colors.surface2,
              borderWidth: 1,
              borderColor: ui.colors.border,
              marginBottom: 12,
            }}
          >
            {clubCover ? (
              <Image source={{ uri: clubCover }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Ionicons name="image-outline" size={28} color={ui.colors.textMuted} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textSecondary }}>
                  {uploadingCover ? 'Subiendo portada…' : 'Agregar foto de portada'}
                </Text>
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                right: 10,
                bottom: 10,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: ui.radius.sm,
                backgroundColor: 'rgba(0,0,0,0.55)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {uploadingCover ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={14} color="#fff" />
              )}
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                {clubCover ? 'Cambiar portada' : 'Portada'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity onPress={handleLogoPress} disabled={uploadingLogo || !activeClubId} activeOpacity={0.9}>
            <View style={{ position: 'relative', marginBottom: 12 }}>
              <Avatar
                name={activeClub?.name || user?.name || 'Club'}
                photo={clubLogo}
                size="xl"
                style={{ marginBottom: 0 }}
              />
              <View
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: ui.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: ui.colors.bg,
                }}
              >
                {uploadingLogo ? (
                  <ActivityIndicator size="small" color={ui.colors.onPrimary} />
                ) : (
                  <Ionicons name="camera" size={16} color={ui.colors.onPrimary} />
                )}
              </View>
            </View>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '800', color: ui.colors.textPrimary }}>
            {activeClub?.name || 'Mi club'}
          </Text>
          <Text style={{ fontSize: 13, color: ui.colors.textMuted, marginTop: 4 }}>{user?.email}</Text>
          <Text style={{ fontSize: 12, color: ui.colors.primary, marginTop: 4, fontWeight: '600' }}>
            Plan {planLabel(currentPlan)}
          </Text>
          <TouchableOpacity onPress={handleLogoPress} disabled={uploadingLogo || !activeClubId} style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.primary }}>
              {uploadingLogo ? 'Subiendo…' : clubLogo ? 'Cambiar logo' : 'Agregar logo'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {(clubs?.length ?? 0) > 1 && (tab === 'billing' || tab === 'data') && (
        <>
          <Text style={{ fontSize: 12, fontWeight: '600', color: ui.colors.textMuted, marginBottom: 8 }}>Sede activa</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {clubs!.map((club) => (
                <SelectionChip
                  key={club.id}
                  label={club.name}
                  selected={club.id === activeClubId}
                  onPress={() => setSelectedClubId(club.id)}
                />
              ))}
            </View>
          </ScrollView>
        </>
      )}

      <ClubTabBar active={tab} onChange={setTab} />

      {tab === 'data' && (
        <>
          <SectionHeader title="Datos del club" subtitle="Información pública de tu sede" />
          <AppCard>
            <InputField label="Nombre" value={clubName} onChangeText={setClubName} placeholder="Palermo Pádel Club" />
            <InputField label="Ciudad" value={clubCity} onChangeText={setClubCity} />
            <InputField label="Zona" value={clubZone} onChangeText={setClubZone} />
            <InputField label="Dirección" value={clubAddress} onChangeText={setClubAddress} placeholder="Calle y número" />
            <InputField label="Teléfono" value={clubPhone} onChangeText={setClubPhone} keyboardType="phone-pad" />
            <InputField
              label="Email de contacto"
              value={clubEmail}
              onChangeText={setClubEmail}
              placeholder="club@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <InputField
              label="Descripción"
              value={clubDescription}
              onChangeText={setClubDescription}
              placeholder="Contá un poco sobre el club"
              multiline
            />
            <PrimaryButton
              label="Guardar datos"
              fullWidth
              loading={updateClub.isPending}
              onPress={() => {
                void (async () => {
                  const payload: Record<string, string | number> = {
                    name: clubName.trim(),
                    city: clubCity.trim(),
                    zone: clubZone.trim(),
                    address: clubAddress.trim(),
                    phone: clubPhone.trim(),
                    email: clubEmail.trim(),
                    description: clubDescription.trim(),
                  };
                  const coords = await geocodeClubAddress([
                    clubAddress,
                    clubZone,
                    clubCity,
                  ]);
                  if (coords) {
                    payload.latitude = coords.latitude;
                    payload.longitude = coords.longitude;
                  }
                  updateClub.mutate(payload);
                })();
              }}
            />
          </AppCard>

          <SectionHeader
            title="Tarifa de cancha"
            subtitle="Precio base por hora · se usa al publicar turnos libres"
          />
          <AppCard style={{ marginTop: 4, marginBottom: 12 }}>
            <InputField
              label="Precio por hora"
              value={courtPricePerHour}
              onChangeText={(text) => setCourtPricePerHour(text.replace(/[^\d.,]/g, ''))}
              placeholder="Ej: 12000"
              keyboardType="numeric"
            />
            <InputField
              label="Seña (%)"
              value={depositPercent}
              onChangeText={(text) => setDepositPercent(text.replace(/[^\d]/g, ''))}
              placeholder="Ej: 25"
              keyboardType="numeric"
              hint="Porcentaje de seña sobre el precio del turno (0–100)."
            />
            <PrimaryButton
              label="Guardar tarifa"
              fullWidth
              loading={updateClub.isPending}
              onPress={() => {
                const price = Number(courtPricePerHour.replace(',', '.'));
                const deposit = Number(depositPercent || '0');
                if (!Number.isFinite(price) || price < 0) {
                  Alert.alert('Precio inválido', 'Ingresá un precio por hora válido.');
                  return;
                }
                if (!Number.isFinite(deposit) || deposit < 0 || deposit > 100) {
                  Alert.alert('Seña inválida', 'La seña debe estar entre 0 y 100.');
                  return;
                }
                updateClub.mutate({
                  courtPricePerHour: price,
                  depositPercent: deposit,
                });
              }}
            />
          </AppCard>

          {activeClubId && (
            <PrimaryButton
              label="Ver club público"
              variant="outline"
              fullWidth
              onPress={() => router.push(`/club/${activeClubId}` as any)}
              style={{ marginTop: 12 }}
              icon={<Ionicons name="eye-outline" size={18} color={ui.colors.primary} />}
            />
          )}
        </>
      )}

      {tab === 'venues' && (
        <>
          <SectionHeader title="Sedes" subtitle={`${clubs.length} ubicación${clubs.length !== 1 ? 'es' : ''}`} />
          {showCreateVenue ? (
            <AppCard style={{ marginBottom: 12 }}>
              <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 12 }}>Nueva sede</Text>
              <InputField label="Nombre" value={venueName} onChangeText={setVenueName} placeholder="Sede Norte" />
              <InputField label="Ciudad" value={venueCity} onChangeText={setVenueCity} />
              <InputField label="Zona" value={venueZone} onChangeText={setVenueZone} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <SelectionChip label="Cancelar" selected={false} onPress={() => setShowCreateVenue(false)} flex />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton label="Crear" fullWidth loading={createVenue.isPending} onPress={() => createVenue.mutate()} />
                </View>
              </View>
            </AppCard>
          ) : (
            <PrimaryButton
              label="Agregar sede"
              variant="outline"
              fullWidth
              onPress={() => setShowCreateVenue(true)}
              style={{ marginBottom: 12 }}
              icon={<Ionicons name="add" size={18} color={ui.colors.primary} />}
            />
          )}
          {clubs.map((club) => (
            <AppCard key={club.id} onPress={() => router.push(`/club/${club.id}` as any)} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={club.name} photo={club.logo_url} size="md" style={{ marginBottom: 0 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{club.name}</Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                    {[club.address, club.city, club.zone].filter(Boolean).join(' · ') || 'Sin dirección'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
              </View>
            </AppCard>
          ))}
        </>
      )}

      {tab === 'subscription' && (
        <>
          <SectionHeader title="Suscripción" subtitle={`Plan actual: ${planLabel(currentPlan)}`} />
          {PLANS.map((plan) => {
            const selected = currentPlan === plan.id;
            return (
              <AppCard
                key={plan.id}
                style={{
                  marginBottom: 10,
                  borderWidth: selected ? 2 : 0,
                  borderColor: selected ? ui.colors.primary : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontWeight: '800', fontSize: 17, color: ui.colors.textPrimary }}>{plan.label}</Text>
                  <Text style={{ fontWeight: '700', color: ui.colors.primary }}>{plan.multiplier}</Text>
                </View>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 8 }}>{plan.desc}</Text>
                <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 12 }}>{plan.price}</Text>
                {!selected && (
                  <PrimaryButton
                    label={`Cambiar a ${plan.label}`}
                    size="sm"
                    variant="outline"
                    fullWidth
                    loading={updatePlan.isPending}
                    onPress={() =>
                      Alert.alert('Cambiar plan', `¿Confirmás el plan ${plan.label}?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Confirmar', onPress: () => updatePlan.mutate(plan.id) },
                      ])
                    }
                  />
                )}
                {selected && (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: ui.colors.primary }}>Plan activo</Text>
                )}
              </AppCard>
            );
          })}
        </>
      )}

      {tab === 'settings' && (
        <>
          <SectionHeader title="Configuración" subtitle="Cuenta y preferencias" />
          <TouchableOpacity onPress={cyclePreference} activeOpacity={0.8}>
            <AppCard padding="sm" style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="color-palette-outline" size={22} color={ui.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Apariencia</Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                    {themePreferenceLabel(preference)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
              </View>
            </AppCard>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/club-payments',
                params: {
                  clubId: activeClubId || '',
                  clubName: activeClub?.name || '',
                },
              } as any)
            }
            activeOpacity={0.8}
          >
            <AppCard padding="sm" style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="card-outline" size={22} color={ui.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    Pagos / Mercado Pago
                  </Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                    Conectá tu cuenta para cobrar señas online
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
              </View>
            </AppCard>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/change-password' as any)} activeOpacity={0.8}>
            <AppCard padding="sm" style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="lock-closed-outline" size={22} color={ui.colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Cambiar contraseña</Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>Seguridad de la cuenta</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
              </View>
            </AppCard>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications' as any)} activeOpacity={0.8}>
            <AppCard padding="sm" style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="notifications-outline" size={22} color={ui.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Notificaciones</Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>Alertas del club</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
              </View>
            </AppCard>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/edit-profile' as any)} activeOpacity={0.8}>
            <AppCard padding="sm">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="person-outline" size={22} color={ui.colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Datos de cuenta</Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>Nombre y email del administrador</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
              </View>
            </AppCard>
          </TouchableOpacity>
        </>
      )}

      {tab === 'billing' && (
        <>
          <SectionHeader
            title="Facturación"
            subtitle={activeClub ? `Ingresos de ${activeClub.name}` : 'Ingresos de señas y tienda'}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {([7, 30, 90] as RevenuePeriod[]).map((days) => (
              <SelectionChip
                key={days}
                label={days === 7 ? '7 días' : days === 30 ? '30 días' : '90 días'}
                selected={revenuePeriod === days}
                onPress={() => setRevenuePeriod(days)}
                flex
              />
            ))}
          </View>
          {loadingRevenue ? (
            <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando facturación...</Text>
          ) : revenueError ? (
            <AppCard>
              <Text style={{ color: ui.colors.danger, fontSize: 13, marginBottom: 8 }}>
                No se pudieron cargar los ingresos. Revisá la conexión con la API.
              </Text>
              <PrimaryButton label="Reintentar" size="sm" onPress={() => refetchRevenue()} />
            </AppCard>
          ) : revenue ? (
            <>
              <AppCard style={{ marginBottom: 12, backgroundColor: ui.colors.primary }} padding="lg">
                <Text style={{ color: ui.colors.onPrimary, opacity: 0.75, fontSize: 12, fontWeight: '600' }}>Total cobrado</Text>
                <Text style={{ color: ui.colors.onPrimary, fontSize: 34, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 }}>
                  {formatCurrency(revenue.summary.totalCollected)}
                </Text>
                <View
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: ui.colors.bgElevated === '#FFFFFF' ? 'rgba(255,255,255,0.25)' : 'rgba(10,10,10,0.2)',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: ui.colors.onPrimary, opacity: 0.7, fontSize: 11 }}>Por cobrar</Text>
                    <Text style={{ color: ui.colors.onPrimary, fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                      {formatCurrency(revenue.summary.totalPending)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: ui.colors.onPrimary, opacity: 0.7, fontSize: 11 }}>Operaciones</Text>
                    <Text style={{ color: ui.colors.onPrimary, fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                      {(revenue.summary.depositCount ?? 0) + (revenue.summary.shopSaleCount ?? 0)}
                    </Text>
                  </View>
                </View>
              </AppCard>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <AppCard style={{ flex: 1, marginBottom: 0 }} padding="sm">
                  <Text style={{ fontSize: 11, color: ui.colors.textSecondary, fontWeight: '600' }}>Señas cobradas</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 4 }}>
                    {formatCurrency(revenue.summary.collectedDeposits)}
                  </Text>
                  {(revenue.summary.pendingDeposits ?? 0) > 0 && (
                    <Text style={{ fontSize: 11, color: ui.colors.warning, marginTop: 4 }}>
                      +{formatCurrency(revenue.summary.pendingDeposits)} pendiente
                    </Text>
                  )}
                </AppCard>
                <AppCard style={{ flex: 1, marginBottom: 0 }} padding="sm">
                  <Text style={{ fontSize: 11, color: ui.colors.textSecondary, fontWeight: '600' }}>Tienda cobrada</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 4 }}>
                    {formatCurrency(revenue.summary.collectedShop)}
                  </Text>
                  {(revenue.summary.pendingShop ?? 0) > 0 && (
                    <Text style={{ fontSize: 11, color: ui.colors.warning, marginTop: 4 }}>
                      +{formatCurrency(revenue.summary.pendingShop)} pendiente
                    </Text>
                  )}
                </AppCard>
              </View>
              <SectionHeader
                title="Movimientos recientes"
                action={
                  revenue.recent.length > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <TouchableOpacity onPress={exportBillingCsv} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="download-outline" size={16} color={ui.colors.primary} />
                          <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.primary }}>CSV</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={openAllMovements} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: ui.colors.primary }}>Ver todos</Text>
                      </TouchableOpacity>
                    </View>
                  ) : undefined
                }
              />
              {!previewMovements.length ? (
                <AppCard>
                  <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>Sin movimientos en este período.</Text>
                </AppCard>
              ) : (
                <>
                  {previewMovements.map((item) => (
                    <RevenueMovementRow
                      key={`${item.kind}-${item.id}`}
                      item={item}
                      confirming={confirmingId === item.id && markPaidMutation.isPending}
                      onMarkPaid={(movement) => markPaidMutation.mutate(movement)}
                    />
                  ))}
                  {revenue.recent.length > previewMovements.length && (
                    <PrimaryButton
                      label={`Ver los ${revenue.recent.length} movimientos`}
                      variant="outline"
                      fullWidth
                      onPress={openAllMovements}
                      style={{ marginTop: 4 }}
                      icon={<Ionicons name="list-outline" size={18} color={ui.colors.primary} />}
                    />
                  )}
                </>
              )}
            </>
          ) : (
            <AppCard>
              <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>No hay datos de facturación disponibles.</Text>
            </AppCard>
          )}
        </>
      )}

      <TouchableOpacity onPress={onLogout} activeOpacity={0.8} style={{ marginTop: 24 }}>
        <AppCard padding="sm">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="log-out-outline" size={22} color={ui.colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: ui.colors.danger }}>Cerrar sesión</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
          </View>
        </AppCard>
      </TouchableOpacity>

      <ProfilePhotoViewer
        visible={showLogoViewer}
        photo={clubLogo}
        name={activeClub?.name || 'Club'}
        onClose={() => setShowLogoViewer(false)}
      />
    </ScrollView>
  );
}
