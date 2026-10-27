import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { themePreferenceLabel, useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, parseMoneyInput } from '@/lib/currency';
import { shareRevenueCsv, type ClubRevenueResponse, type RevenueMovement } from '@/lib/club/club-revenue';
import { confirmShopPurchase, markDepositPaid } from '@/lib/shop/shop-api';
import { pickAndUploadClubLogo, showClubLogoOptions } from '@/lib/club/club-logo';
import { pickAndUploadClubCover, showClubCoverOptions } from '@/lib/club/club-cover';
import {
  CLUB_PHOTOS_MAX,
  deleteClubPhoto,
  fetchClubPhotos,
  pickAndUploadClubPhotos,
  setClubPhotoPrimary,
  showClubPhotoOptions,
  type ClubPhoto,
} from '@/lib/club/club-photos';
import {
  type ClubLocationValue,
  clubLocationFromParts,
  clubLocationPayload,
  emptyClubLocation,
  hasClubLocation,
} from '@/lib/club/club-geocode';
import { getTabScreenPaddingBottom } from '@/lib/layout';
import { ui } from '@/theme/tokens';
import {
  AppCard,
  PrimaryButton,
  InputField,
  MoneyInputField,
  EmptyState,
  SectionHeader,
  SelectionChip,
  Avatar,
  ProfilePhotoViewer,
} from '@/components/x4match';
import { ClubLocationPicker } from '@/components/club/ClubLocationPicker';
import { RevenueMovementRow } from '@/components/club/RevenueMovementRow';
import { TourTarget, useScreenTour, type TourStep } from '@/components/tour/ScreenTour';
import { resetScreenTours } from '@/lib/tour';

const CLUB_HOME_TOUR_STEPS: TourStep[] = [
  {
    target: 'clubHome.cover',
    title: 'Portada del club',
    description: 'Es la imagen que ven los jugadores en la página de tu club. Tocala para cambiarla.',
  },
  {
    target: 'clubHome.logo',
    title: 'Logo',
    description: 'Tu logo aparece en el listado de clubes, en las reservas y en los partidos que se juegan en tu sede.',
  },
  {
    target: 'clubHome.tabs',
    title: 'Datos, sedes, configuración y facturación',
    description:
      '"Datos": información pública, fotos, tarifa por hora. "Sedes": agregá otras ubicaciones. "Config": Mercado Pago, contraseña y notificaciones. "Factura": ingresos de turnos y tienda.',
  },
  {
    target: 'tab.home',
    fixed: true,
    title: 'Mi club',
    description: 'Esta pantalla: el perfil público de tu club y su configuración.',
  },
  {
    target: 'tab.gerente',
    fixed: true,
    title: 'Gerente',
    description: 'El panel con la facturación, la ocupación, las alertas y recomendaciones para tu club.',
  },
  {
    target: 'tab.court-slots',
    fixed: true,
    title: 'Gestión',
    description: 'Canchas, horarios disponibles, promociones y estadísticas de uso.',
  },
  {
    target: 'tab.shop',
    fixed: true,
    title: 'Tienda',
    description: 'Productos, cobros, cupones y el catálogo de premios que los jugadores canjean con puntos.',
  },
  {
    target: 'tab.matches',
    fixed: true,
    title: 'Actividad',
    description: 'Los partidos y torneos que se juegan en tu sede.',
  },
];

type ClubTab = 'data' | 'venues' | 'settings' | 'billing';
type RevenuePeriod = 7 | 30 | 90;

interface ClubRow {
  id: string;
  name: string;
  city?: string;
  location?: string;
  address?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  phone?: string;
  email?: string;
  description?: string;
  logo_url?: string;
  cover_url?: string;
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
  { key: 'settings', label: 'Config' },
  { key: 'billing', label: 'Factura' },
];

const LIME = '#D7FF00';
const CARD_BG = '#161616';
const CARD_BORDER = 'rgba(255,255,255,0.10)';
const MUTED = '#8E8E9F';

function ClubTabBar({ active, onChange }: { active: ClubTab; onChange: (t: ClubTab) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
        {CLUB_TABS.map((tab) => {
          const selected = active === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onChange(tab.key)}
              activeOpacity={0.85}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: selected ? LIME : '#0E0E0E',
                borderWidth: 1,
                borderColor: selected ? LIME : CARD_BORDER,
              }}
            >
              <Text
                style={{
                  fontWeight: '700',
                  fontSize: 13,
                  color: selected ? '#000000' : '#FAFAFA',
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function LimeCta({
  label,
  onPress,
  loading,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={{
        backgroundColor: LIME,
        borderRadius: 999,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: disabled || loading ? 0.6 : 1,
        marginTop: 4,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#000" />
      ) : (
        <>
          {icon}
          <Text style={{ color: '#000000', fontSize: 15, fontWeight: '700' }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function DarkActionButton({
  label,
  onPress,
  icon,
  danger,
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: CARD_BG,
        borderRadius: 999,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        borderWidth: 1,
        borderColor: danger ? ui.colors.danger : CARD_BORDER,
        marginTop: 10,
      }}
    >
      {icon}
      <Text
        style={{
          color: danger ? ui.colors.danger : ui.colors.textPrimary,
          fontSize: 15,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
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
  const scrollRef = useRef<ScrollView>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>(30);

  const [clubName, setClubName] = useState('');
  const [clubLocation, setClubLocation] = useState<ClubLocationValue>(emptyClubLocation());
  const [clubPhone, setClubPhone] = useState('');
  const [clubEmail, setClubEmail] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [courtPricePerHour, setCourtPricePerHour] = useState('');
  const [depositPercent, setDepositPercent] = useState(100);
  const [localLogoUri, setLocalLogoUri] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showLogoViewer, setShowLogoViewer] = useState(false);
  const [localCoverUri, setLocalCoverUri] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingCardPhoto, setUploadingCardPhoto] = useState(false);

  const [showCreateVenue, setShowCreateVenue] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [venueLocation, setVenueLocation] = useState<ClubLocationValue>(emptyClubLocation());

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

  const {
    data: clubPhotos = [],
    refetch: refetchClubPhotos,
    isLoading: loadingClubPhotos,
  } = useQuery({
    queryKey: ['club-profile-photos', activeClubId],
    queryFn: () => fetchClubPhotos(activeClubId!),
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
    setClubLocation(
      clubLocationFromParts({
        city: club.city,
        address: club.address,
        latitude: club.latitude,
        longitude: club.longitude,
      }),
    );
    setClubPhone(club.phone || '');
    setClubEmail(club.email || '');
    setClubDescription(club.description || '');
    const hourly = Number(club.courtPricePerHour ?? club.court_price_per_hour ?? 0);
    setCourtPricePerHour(hourly > 0 ? String(Math.round(hourly)) : '');
    const pct = Number(club.depositPercent ?? club.deposit_percent ?? 100);
    setDepositPercent(Number.isFinite(pct) ? Math.min(100, Math.max(0, Math.round(pct))) : 100);
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

  const invalidateClubMedia = async () => {
    await queryClient.invalidateQueries({ queryKey: ['club-profile-clubs'] });
    await queryClient.invalidateQueries({ queryKey: ['club-profile-detail', activeClubId] });
    await queryClient.invalidateQueries({ queryKey: ['club-profile-photos', activeClubId] });
    await queryClient.invalidateQueries({ queryKey: ['club', activeClubId] });
    await queryClient.invalidateQueries({ queryKey: ['clubs'] });
    await queryClient.invalidateQueries({ queryKey: ['home-open-matches'] });
  };

  const handleAddCardPhoto = async (source: 'library' | 'camera') => {
    if (!activeClubId) return;
    const remainingSlots = Math.max(0, CLUB_PHOTOS_MAX - clubPhotos.length);
    if (remainingSlots <= 0) {
      Alert.alert('Límite alcanzado', `Podés subir hasta ${CLUB_PHOTOS_MAX} fotos`);
      return;
    }
    setUploadingCardPhoto(true);
    try {
      const photos = await pickAndUploadClubPhotos(activeClubId, source, { remainingSlots });
      if (!photos.length) return;
      await invalidateClubMedia();
      await refetchClubPhotos();
      Alert.alert(
        'Listo',
        photos.length === 1
          ? 'Foto agregada para las cards de partidos'
          : `${photos.length} fotos agregadas para las cards de partidos`,
      );
    } finally {
      setUploadingCardPhoto(false);
    }
  };

  const handleSetPrimaryPhoto = async (photo: ClubPhoto) => {
    if (!activeClubId || photo.isPrimary) return;
    try {
      await setClubPhotoPrimary(activeClubId, photo.id);
      await invalidateClubMedia();
      await refetchClubPhotos();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo marcar como principal');
    }
  };

  const handleDeletePhoto = (photo: ClubPhoto) => {
    if (!activeClubId) return;
    Alert.alert('Eliminar foto', '¿Sacar esta foto de las cards?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteClubPhoto(activeClubId, photo.id);
              await invalidateClubMedia();
              await refetchClubPhotos();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'No se pudo eliminar');
            }
          })();
        },
      },
    ]);
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

  const createVenue = useMutation({
    mutationFn: async () => {
      if (!venueName.trim()) throw new Error('Indicá el nombre del club');
      if (!hasClubLocation(venueLocation)) {
        throw new Error('Elegí la ubicación del club (búsqueda o GPS)');
      }
      const loc = clubLocationPayload(venueLocation);
      const res = await api.post('/clubs', {
        name: venueName.trim(),
        ...loc,
      });
      return res.data;
    },
    onSuccess: () => {
      setVenueName('');
      setVenueLocation(emptyClubLocation());
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
    if (activeClubId) {
      refetchClubDetail();
      refetchClubPhotos();
    }
    if (tab === 'billing') refetchRevenue();
  };

  const isLoading = loadingClubs || (tab === 'billing' && loadingRevenue);

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
      <ClubLocationPicker value={venueLocation} onChange={setVenueLocation} requiredHint />
      <PrimaryButton
        label="Crear club"
        fullWidth
        loading={createVenue.isPending}
        disabled={!venueName.trim() || !hasClubLocation(venueLocation)}
        onPress={() => createVenue.mutate()}
        style={{ marginTop: 4 }}
      />
    </AppCard>
  );

  const { replay: replayTour } = useScreenTour('club-home', CLUB_HOME_TOUR_STEPS, {
    enabled: !!clubs?.length,
    scrollRef,
  });

  const handleReplayTours = async () => {
    if (!user?.id) return;
    await resetScreenTours(user.id);
    setTab('data');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setTimeout(replayTour, 400);
  };

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
      ref={scrollRef}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={LIME} />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom, paddingHorizontal: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ marginBottom: 20 }}>
        <TourTarget id="clubHome.cover">
        <TouchableOpacity
          onPress={handleCoverPress}
          disabled={uploadingCover || !activeClubId}
          activeOpacity={0.9}
        >
          <View
            style={{
              height: 168,
              borderRadius: 18,
              overflow: 'hidden',
              backgroundColor: CARD_BG,
              borderWidth: 1,
              borderColor: CARD_BORDER,
            }}
          >
            {clubCover ? (
              <Image source={{ uri: clubCover }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Ionicons name="image-outline" size={28} color={MUTED} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textSecondary }}>
                  {uploadingCover ? 'Subiendo portada…' : 'Agregar foto de portada'}
                </Text>
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                right: 12,
                bottom: 12,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: 'rgba(0,0,0,0.62)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {uploadingCover ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
              )}
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                {clubCover ? 'Cambiar portada' : 'Portada'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        </TourTarget>

        <TourTarget
          id="clubHome.logo"
          style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: -36, paddingHorizontal: 4, gap: 12, alignSelf: 'flex-start' }}
        >
          <TouchableOpacity onPress={handleLogoPress} disabled={uploadingLogo || !activeClubId} activeOpacity={0.9}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                borderWidth: 3,
                borderColor: '#000',
                overflow: 'hidden',
                backgroundColor: CARD_BG,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {clubLogo ? (
                <Image source={{ uri: clubLogo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Avatar
                  name={activeClub?.name || user?.name || 'Club'}
                  size="xl"
                  style={{ marginBottom: 0, width: 84, height: 84, borderRadius: 42 } as any}
                />
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLogoPress}
            disabled={uploadingLogo || !activeClubId}
            style={{ marginBottom: 10 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: LIME }}>
              {uploadingLogo ? 'Subiendo…' : clubLogo ? 'Cambiar logo' : 'Agregar logo'}
            </Text>
          </TouchableOpacity>
        </TourTarget>

        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: ui.colors.textPrimary, letterSpacing: -0.3 }}>
            {activeClub?.name || 'Mi club'}
          </Text>
          <Text style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{user?.email}</Text>
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

      <TourTarget id="clubHome.tabs">
        <ClubTabBar active={tab} onChange={setTab} />
      </TourTarget>

      {tab === 'data' && (
        <>
          <AppCard style={{ marginBottom: 14, backgroundColor: '#111115' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textPrimary }}>
              Datos de tu sede
            </Text>
            <Text style={{ fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 14 }}>
              Información pública de tu sede
            </Text>
            <InputField label="Nombre" value={clubName} onChangeText={setClubName} placeholder="Palermo Pádel Club" style={{ backgroundColor: '#0D0D11' }} />
            <ClubLocationPicker value={clubLocation} onChange={setClubLocation} requiredHint />
            <InputField label="Teléfono" value={clubPhone} onChangeText={setClubPhone} keyboardType="phone-pad" placeholder="Teléfono" style={{ backgroundColor: '#0D0D11' }} />
            <InputField
              label="Email de contacto"
              value={clubEmail}
              onChangeText={setClubEmail}
              placeholder="club@mail.com"
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
            <LimeCta
              label="Guardar datos"
              loading={updateClub.isPending}
              onPress={() => {
                if (!hasClubLocation(clubLocation)) {
                  Alert.alert('Ubicación', 'Elegí la ubicación del club con búsqueda o GPS.');
                  return;
                }
                const loc = clubLocationPayload(clubLocation);
                updateClub.mutate({
                  name: clubName.trim(),
                  city: loc.city || '',
                  address: loc.address || '',
                  phone: clubPhone.trim(),
                  email: clubEmail.trim(),
                  description: clubDescription.trim(),
                  ...(loc.latitude != null ? { latitude: loc.latitude } : {}),
                  ...(loc.longitude != null ? { longitude: loc.longitude } : {}),
                });
              }}
            />
          </AppCard>

          <AppCard style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textPrimary }}>
              Fotos para cards
            </Text>
            <Text style={{ fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 14 }}>
              Se muestran en los partidos abiertos · hasta {CLUB_PHOTOS_MAX}
            </Text>
            {loadingClubPhotos ? (
              <ActivityIndicator color={LIME} style={{ marginVertical: 12 }} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
                style={{ marginBottom: 12 }}
              >
                {clubPhotos.map((photo) => (
                  <View key={photo.id} style={{ width: 112 }}>
                    <View
                      style={{
                        width: 112,
                        height: 96,
                        borderRadius: 14,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: photo.isPrimary ? LIME : CARD_BORDER,
                        backgroundColor: '#111',
                      }}
                    >
                      <Image
                        source={{ uri: photo.photoUrl }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    </View>
                    <TouchableOpacity onPress={() => handleDeletePhoto(photo)} style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: ui.colors.danger }}>Eliminar</Text>
                    </TouchableOpacity>
                    {photo.isPrimary ? (
                      <Text style={{ fontSize: 12, fontWeight: '700', color: LIME, marginTop: 4 }}>Principal</Text>
                    ) : (
                      <TouchableOpacity onPress={() => void handleSetPrimaryPhoto(photo)} style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: LIME }}>Usar en cards</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {clubPhotos.length < CLUB_PHOTOS_MAX ? (
                  <TouchableOpacity
                    onPress={() =>
                      showClubPhotoOptions({
                        remainingSlots: Math.max(0, CLUB_PHOTOS_MAX - clubPhotos.length),
                        onPick: (source) => {
                          void handleAddCardPhoto(source);
                        },
                      })
                    }
                    activeOpacity={0.85}
                    style={{
                      width: 112,
                      height: 96,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: CARD_BORDER,
                      backgroundColor: '#111',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="add" size={28} color={MUTED} />
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
            )}
            <LimeCta
              label={uploadingCardPhoto ? 'Subiendo…' : 'Agregar fotos'}
              loading={uploadingCardPhoto}
              disabled={uploadingCardPhoto || clubPhotos.length >= CLUB_PHOTOS_MAX || !activeClubId}
              icon={<Ionicons name="cloud-upload-outline" size={18} color="#000" />}
              onPress={() =>
                showClubPhotoOptions({
                  remainingSlots: Math.max(0, CLUB_PHOTOS_MAX - clubPhotos.length),
                  onPick: (source) => {
                    void handleAddCardPhoto(source);
                  },
                })
              }
            />
          </AppCard>

          <AppCard style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textPrimary }}>
              Tarifa de cancha
            </Text>
            <Text style={{ fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 14 }}>
              Precio base por hora · se usa al publicar turnos libres
            </Text>
            <MoneyInputField
              label="Precio por hora"
              value={courtPricePerHour}
              onChangeText={setCourtPricePerHour}
              placeholder="30000"
            />
            <Text style={{ fontSize: 13, color: MUTED, marginTop: 14, marginBottom: 8 }}>
              Para confirmar/reservar la cancha, cada jugador paga
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {[25, 50, 100].map((pct) => (
                <SelectionChip
                  key={pct}
                  label={pct === 100 ? '100% (completo)' : `${pct}% seña`}
                  selected={depositPercent === pct}
                  onPress={() => setDepositPercent(pct)}
                />
              ))}
            </View>
            <LimeCta
              label="Guardar tarifa y cobro"
              loading={updateClub.isPending}
              onPress={() => {
                const price = parseMoneyInput(courtPricePerHour);
                if (!Number.isFinite(price) || price < 0) {
                  Alert.alert('Precio inválido', 'Ingresá un precio por hora válido.');
                  return;
                }
                updateClub.mutate({ courtPricePerHour: price, depositPercent });
              }}
            />
          </AppCard>

          {activeClubId ? (
            <>
              <DarkActionButton
                label="Noticias del club"
                onPress={() => router.push(`/news/mine?clubId=${activeClubId}` as any)}
                icon={<Ionicons name="megaphone-outline" size={18} color={ui.colors.textPrimary} />}
              />
              <DarkActionButton
                label="Ver club público"
                onPress={() => router.push(`/club/${activeClubId}` as any)}
                icon={<Ionicons name="sparkles-outline" size={18} color={ui.colors.textPrimary} />}
              />
            </>
          ) : null}
        </>
      )}

      {tab === 'venues' && (
        <>
          <SectionHeader title="Sedes" subtitle={`${clubs.length} ubicación${clubs.length !== 1 ? 'es' : ''}`} />
          {showCreateVenue ? (
            <AppCard style={{ marginBottom: 12 }}>
              <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 12 }}>Nueva sede</Text>
              <InputField label="Nombre" value={venueName} onChangeText={setVenueName} placeholder="Sede Norte" />
              <ClubLocationPicker value={venueLocation} onChange={setVenueLocation} requiredHint />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <SelectionChip
                    label="Cancelar"
                    selected={false}
                    onPress={() => {
                      setShowCreateVenue(false);
                      setVenueLocation(emptyClubLocation());
                    }}
                    flex
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="Crear"
                    fullWidth
                    loading={createVenue.isPending}
                    disabled={!venueName.trim() || !hasClubLocation(venueLocation)}
                    onPress={() => createVenue.mutate()}
                  />
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
                    {[club.address, club.city].filter(Boolean).join(' · ') || 'Sin dirección'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
              </View>
            </AppCard>
          ))}
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
                    Conectá tu cuenta para cobrar turnos online
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
          <TouchableOpacity onPress={() => void handleReplayTours()} activeOpacity={0.8}>
            <AppCard padding="sm" style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="help-buoy-outline" size={22} color={ui.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Ver tutoriales de nuevo</Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                    Volvé a ver la explicación de cada pantalla
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
              </View>
            </AppCard>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications' as any)} activeOpacity={0.8}>
            <AppCard padding="sm">
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
        </>
      )}

      {tab === 'billing' && (
        <>
          <SectionHeader
            title="Facturación"
            subtitle={activeClub ? `Ingresos de ${activeClub.name}` : 'Ingresos de turnos y tienda'}
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
                  <Text style={{ fontSize: 11, color: ui.colors.textSecondary, fontWeight: '600' }}>Turnos cobrados</Text>
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

      <DarkActionButton
        label="Cerrar sesión"
        onPress={onLogout}
        danger
        icon={<Ionicons name="log-out-outline" size={18} color={ui.colors.danger} />}
      />

      <ProfilePhotoViewer
        visible={showLogoViewer}
        photo={clubLogo}
        name={activeClub?.name || 'Club'}
        onClose={() => setShowLogoViewer(false)}
      />
    </ScrollView>
  );
}
