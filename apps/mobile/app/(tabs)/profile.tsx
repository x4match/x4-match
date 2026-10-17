import { useMemo, useRef, useState, type ComponentProps } from 'react';
import type { ImageSourcePropType } from 'react-native';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Pressable,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ageFromBirthDate } from '@/lib/age';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { themePreferenceLabel, useTheme } from '@/contexts/ThemeContext';
import { isClub, canOrganizeEvents, isPlayer, roleLabel } from '@/lib/roles';
import { api } from '@/lib/api';
import { mapPlayerMatchHistory } from '@/lib/mappers';
import { formatSkillScore, resolveSkillScore } from '@/lib/skill';
import { pickAndUploadProfilePhoto, showProfilePhotoOptions } from '@/lib/profile/profile-photo';
import { requestPlayerCoordinates, syncPlayerCoordinates } from '@/lib/geolocation';
import { invalidateRedeemablePoints, useRedeemablePoints } from '@/lib/shop/redeemable-points';
import { hapticSelection } from '@/lib/haptics';
import { resetScreenTours } from '@/lib/tour';
import { TourTarget, useScreenTour, type TourStep } from '@/components/tour/ScreenTour';
import { ui, fontFamily } from '@/theme/tokens';
import { getTabScreenPaddingBottom, tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  AppHeader,
  AppCard,
  PrimaryButton,
  Avatar,
  PlayerMatchStatsCard,
  PlayerMatchHistoryList,
  ProfilePhotoViewer,
  AnimatedNumber,
  FadeInUp,
  Sheet,
  PressableScale,
  TabScrollView,
  TournamentTitlesCard,
  CircuitRoleBadges,
  CircuitInvitationsCard,
} from '@/components/x4match';
import { CircularProgressRing } from '@/components/x4match/CircularProgressRing';
import type { PlayerMatchStats, BadgesSummary } from '@/lib/types';

type ProfileClub = { id: string; name: string; city?: string; location?: string };
type ProfileTab = 'profile' | 'settings';

const LIME = '#D7FF00';
const MUTED = '#8E8E9F';
const CARD_BG = '#161616';
const CARD_BORDER = 'rgba(255,255,255,0.10)';

const ICON_PROFILE = require('../../assets/figma/shared/profile.png');
const ICON_INSIGNIA = require('../../assets/figma/shared/insignia.png');
const ICON_CALENDAR = require('../../assets/figma/shared/calendar.png');
const ICON_CLUB = require('../../assets/figma/shared/edificio-primary.png');
const ICON_TROFEO = require('../../assets/figma/shared/trofeo.png');
const ICON_APARIENCIA = require('../../assets/figma/shared/apariencia.png');
const ICON_NOTE = require('../../assets/figma/shared/note.png');
const ICON_PASSWORD = require('../../assets/figma/auth/password.png');
const ICON_TRASH = require('../../assets/figma/shared/trash.png');
const ICON_LOGOUT = require('../../assets/figma/shared/logout.png');

const PROFILE_TOUR_STEPS: TourStep[] = [
  {
    target: 'profile.tabs',
    fixed: true,
    title: 'Perfil y configuración',
    description:
      '"Mi perfil" muestra tu información de jugador. En "Configuración" editás tus datos, disponibilidad, contraseña y apariencia.',
  },
  {
    target: 'profile.card',
    title: 'Tu tarjeta',
    description: 'Tocá tu foto para cambiarla. Abajo ves cuántos te siguen y a quién seguís.',
  },
  {
    target: 'profile.level',
    title: 'Tu nivel',
    description:
      'Tu puntaje (0 a 1000) y tu categoría. Los primeros 5 partidos competitivos son de nivelación. Tocá el "?" para ver cómo se calcula.',
  },
  {
    target: 'profile.club',
    title: 'Tu club principal',
    description: 'Elegí tu club para entrar en su ranking interno, sumar puntos jugando y canjearlos por premios.',
  },
  {
    target: 'profile.stats',
    title: 'Estadísticas e historial',
    description: 'Tus victorias, derrotas y el historial de partidos con lo que ganaste o perdiste de nivel en cada uno.',
  },
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveMainClubId(raw?: string | null): string | undefined {
  if (
    !raw ||
    raw === 'undefined' ||
    raw === 'null' ||
    !UUID_RE.test(raw)
  ) {
    return undefined;
  }
  return raw;
}

function isPlaceholderLocation(value?: string | null) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return !normalized || normalized === '—' || normalized === 'ubicacion actual' || normalized === 'ubicación actual';
}

function resolveLocality(parts: Array<string | null | undefined>): string {
  const unique = [...new Set(parts.map((p) => p?.trim()).filter(Boolean) as string[])];
  const meaningful = unique.filter((p) => !isPlaceholderLocation(p));
  return meaningful[0] || 'Sin localidad';
}
function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  muted,
}: {
  icon: ImageSourcePropType;
  title: string;
  subtitle: string;
  onPress: () => void;
  /** Icono gris (acciones destructivas / sesión). */
  muted?: boolean;
}) {
  const ringColor = muted ? 'rgba(255,255,255,0.18)' : LIME;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ marginBottom: 10 }}>
      <View
        style={{
          backgroundColor: CARD_BG,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: CARD_BORDER,
          paddingVertical: 14,
          paddingHorizontal: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: muted ? 1 : 0,
                borderColor: muted ? ringColor : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: muted ? '#1A2025' : 'transparent',
              }}
            >
              <Image source={icon} style={{ width: 22, height: 22 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: ui.colors.textPrimary,
                  fontFamily: fontFamily.regular,
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: MUTED,
                  marginTop: 3,
                  fontFamily: fontFamily.regular,
                }}
              >
                {subtitle}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={MUTED} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ProfileTabs({
  value,
  onChange,
}: {
  value: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}) {
  const options: { value: ProfileTab; label: string }[] = [
    { value: 'profile', label: 'Mi perfil' },
    { value: 'settings', label: 'Configuración' },
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        width: '100%',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        marginBottom: ui.spacing.lg,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              void hapticSelection();
              onChange(opt.value);
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: active ? LIME : 'transparent',
              marginBottom: -1,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                lineHeight: 20,
                fontFamily: fontFamily.regular,
                fontWeight: active ? '700' : '400',
                color: active ? LIME : MUTED,
                textAlign: 'center',
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const LEVEL_STRIPES = require('../../assets/figma/profile/tiras.png');
const DETAILS_STRIPES = require('../../assets/figma/profile/tiras-detalles.png');

function LevelStripes({ width = 200, height = 160 }: { width?: number; height?: number }) {
  return (
    <Image
      source={LEVEL_STRIPES}
      style={{ width, height }}
      resizeMode="cover"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

function DetailsStripes({ width = 220, height = 180 }: { width?: number; height?: number }) {
  return (
    <Image
      source={DETAILS_STRIPES}
      style={{ width, height }}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

function formatPositionLabel(pos?: string | null) {
  if (!pos?.trim()) return 'No definida';
  const key = pos.trim().toLowerCase();
  if (key === 'drive') return 'Drive';
  if (key === 'reves' || key === 'revés') return 'Revés';
  if (key === 'ambos' || key === 'both') return 'Ambos';
  return pos.charAt(0).toUpperCase() + pos.slice(1);
}

function formatGenderLabel(gender?: string | null) {
  if (!gender?.trim()) return 'No informado';
  const key = gender.trim().toLowerCase();
  if (key === 'male' || key === 'masculino' || key === 'hombre') return 'Masculino';
  if (key === 'female' || key === 'femenino' || key === 'mujer') return 'Femenino';
  if (key === 'other' || key === 'otro') return 'Otro';
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

function ProfileDetailItem({
  icon,
  label,
  value,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <MaterialCommunityIcons name={icon} size={18} color={LIME} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: MUTED, fontFamily: fontFamily.regular }}>{label}</Text>
        <Text
          style={{
            marginTop: 2,
            fontSize: 15,
            fontWeight: '700',
            color: ui.colors.textPrimary,
            fontFamily: fontFamily.regular,
          }}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function LimeButton({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={loading}
      style={{
        backgroundColor: LIME,
        borderRadius: 999,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#000" />
      ) : (
        <Text
          style={{
            color: '#000000',
            fontSize: 15,
            fontWeight: '700',
            fontFamily: fontFamily.regular,
          }}
        >
          {label}
        </Text>
      )}
    </PressableScale>
  );
}

export default function ProfileScreen() {
  const { user, token, logout, updateUser } = useAuth();
  const { preference, cyclePreference } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const bottomPad = getTabScreenPaddingBottom(insets.bottom);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showLevelingHelp, setShowLevelingHelp] = useState(false);
  const [showClubPicker, setShowClubPicker] = useState(false);
  const [clubSearch, setClubSearch] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [localityOverride, setLocalityOverride] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>('profile');
  const isClubAccount = useMemo(() => isClub(user?.role), [user?.role]);
  const canOrganize = useMemo(() => canOrganizeEvents(user?.role) && !isClub(user?.role), [user?.role]);
  const isPlayerAccount = useMemo(() => isPlayer(user?.role), [user?.role]);
  const authed = Boolean(token);
  const scrollRef = useRef<ScrollView>(null);
  useScreenTour('profile', PROFILE_TOUR_STEPS, {
    enabled: isPlayerAccount && profileTab === 'profile',
    scrollRef,
  });

  const handleReplayTours = async () => {
    if (!user?.id) return;
    await resetScreenTours(user.id);
    router.navigate('/(tabs)/home' as any);
  };

  const { data: me, refetch, isRefetching } = useQuery({
    queryKey: ['profile-me'],
    queryFn: async () => {
      const authRes = await api.get('/auth/me');
      if (isPlayer(user?.role)) {
        const [playerRes, profileRes] = await Promise.all([
          api.get('/players/me'),
          api.get('/users/profile'),
        ]);
        return { ...authRes.data, player: playerRes.data, ...profileRes.data };
      }
      return authRes.data;
    },
    enabled: authed,
  });

  const mainClubId = resolveMainClubId(me?.mainClubId ?? user?.mainClubId);

  const { data: mainClubFetched, refetch: refetchMainClub } = useQuery({
    queryKey: ['profile-main-club', mainClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${mainClubId}`);
      return res.data as ProfileClub;
    },
    enabled: authed && isPlayerAccount && !!mainClubId,
  });

  const mainClub: ProfileClub | null = me?.mainClub ?? mainClubFetched ?? null;

  const { data: mainClubPoints, refetch: refetchMainClubPoints } = useRedeemablePoints(
    mainClubId,
    isPlayerAccount,
  );

  const redeemablePoints = Number(mainClubPoints?.points ?? 0);

  const { data: clubOptions, refetch: refetchClubOptions, isFetching: loadingClubs } = useQuery({
    queryKey: ['clubs-profile-picker'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return res.data as ProfileClub[];
    },
    enabled: authed && isPlayerAccount && (showClubPicker || !mainClubId),
  });

  const filteredClubs = useMemo(() => {
    const list = clubOptions || [];
    const q = clubSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((club) => {
      const haystack = [club.name, club.city, club.location].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [clubOptions, clubSearch]);

  const setMainClubMutation = useMutation({
    mutationFn: (clubId: string) => api.patch('/users/profile', { mainClubId: clubId }),
    onSuccess: async (_, clubId) => {
      await updateUser({ mainClubId: clubId });
      setShowClubPicker(false);
      setClubSearch('');
      await queryClient.invalidateQueries({ queryKey: ['profile-me'] });
      await queryClient.invalidateQueries({ queryKey: ['home-player-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['profile-main-club', clubId] });
      await queryClient.invalidateQueries({ queryKey: ['player-home-main-club', clubId] });
      invalidateRedeemablePoints(queryClient);
      refetch();
      refetchMainClub();
      refetchMainClubPoints();
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo guardar tu club principal');
    },
  });

  const { data: badgesSummary, refetch: refetchBadges, isRefetching: isRefetchingBadges } = useQuery({
    queryKey: ['badges-me'],
    queryFn: async () => {
      const res = await api.get('/badges/me');
      return res.data as BadgesSummary;
    },
    enabled: authed && isPlayer(user?.role),
  });

  const { data: followCounts, refetch: refetchFollowCounts, isRefetching: isRefetchingFollows } = useQuery({
    queryKey: ['follow-counts', 'me'],
    queryFn: async () => {
      const res = await api.get('/follows/me/counts');
      return res.data as { followers: number; following: number };
    },
    enabled: authed && isPlayer(user?.role),
  });

  const { data: matchHistoryRaw, refetch: refetchHistory, isRefetching: isRefetchingHistory } = useQuery({
    queryKey: ['match-history', 'me'],
    queryFn: async () => {
      const res = await api.get('/users/match-history', { params: { limit: 15 } });
      return res.data;
    },
    enabled: authed && isPlayer(user?.role),
  });

  const matchHistory = matchHistoryRaw ? mapPlayerMatchHistory(matchHistoryRaw) : null;

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const displayName = me?.name || user?.name || 'Usuario';
  const profileImage = localPhotoUri || me?.photo || me?.player?.photo_url || user?.photo;

  const handleChangePhoto = async (source: 'library' | 'camera') => {
    setUploadingPhoto(true);
    try {
      const photoUrl = await pickAndUploadProfilePhoto(source);
      if (!photoUrl) return;
      setLocalPhotoUri(photoUrl);
      await updateUser({ photo: photoUrl });
      await queryClient.invalidateQueries({ queryKey: ['profile-me'] });
      await queryClient.invalidateQueries({ queryKey: ['home-player-me'] });
      Alert.alert('Listo', 'Foto de perfil actualizada');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoPress = () => {
    showProfilePhotoOptions({
      hasPhoto: !!profileImage,
      onView: profileImage ? () => setShowPhotoViewer(true) : undefined,
      onPick: (source) => {
        void handleChangePhoto(source);
      },
    });
  };
  const locality = resolveLocality([
    localityOverride,
    me?.location,
    isPlaceholderLocation(user?.location) ? null : user?.location,
    me?.city,
    me?.player?.city,
  ]);

  const handleUseCurrentLocation = async () => {
    setUpdatingLocation(true);
    try {
      const coords = await requestPlayerCoordinates({ withLabel: true, showAlerts: true });
      if (!coords) return;
      const synced = await syncPlayerCoordinates(coords, { updateLocality: true });
      const savedLabel = synced.location || coords.label;
      if (savedLabel) {
        setLocalityOverride(savedLabel);
        await updateUser({ location: savedLabel });
      }
      await queryClient.invalidateQueries({ queryKey: ['profile-me'] });
      await queryClient.invalidateQueries({ queryKey: ['home-player-me'] });
      await refetch();
      Alert.alert(
        'Listo',
        savedLabel ? `Ubicación actualizada: ${savedLabel}` : 'Ubicación GPS actualizada',
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'No se pudo guardar la ubicación. Intentá de nuevo.',
      );
    } finally {
      setUpdatingLocation(false);
    }
  };

  const skillScore = resolveSkillScore(
    me?.skillScore ?? me?.player?.skillScore ?? user?.skillScore,
    me?.player?.rating ?? user?.rating,
  );
  const levelCategory = me?.levelCategory ?? me?.player?.levelCategory ?? user?.levelCategory;
  const declaredCategory = me?.declaredCategory ?? me?.player?.declaredCategory ?? user?.declaredCategory;
  const categoryStatus =
    me?.categoryStatus ?? me?.player?.categoryStatus ?? user?.categoryStatus;
  const placementMatchesPlayed = Number(
    me?.placementMatchesPlayed ?? me?.player?.placementMatchesPlayed ?? user?.placementMatchesPlayed ?? 0,
  );
  const placementMatchesRequired = Number(
    me?.placementMatchesRequired ??
    me?.player?.placementMatchesRequired ??
    user?.placementMatchesRequired ??
    5,
  );
  const isInPlacement = categoryStatus === 'provisional';
  const courtPosition =
    me?.preferences?.courtPosition ??
    me?.player?.courtPosition ??
    me?.player?.position ??
    user?.courtPosition;
  const gender = me?.gender || me?.player?.gender || user?.gender;
  const birthDateRaw = me?.birthDate ?? me?.player?.birthDate ?? user?.birthDate;
  const playerAge = birthDateRaw ? ageFromBirthDate(new Date(birthDateRaw)) : null;
  const detailsLocation = locality && locality !== 'Sin localidad' ? locality : 'No definida';
  const placementPlayed = Math.min(placementMatchesPlayed, placementMatchesRequired);

  if (isClubAccount) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: MUTED, textAlign: 'center', marginBottom: 16 }}>
            La sede se gestiona desde Inicio.
          </Text>
          <LimeButton label="Ir a Inicio" onPress={() => router.replace('/(tabs)/home' as any)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: ui.spacing.lg }}>
        <TourTarget id="profile.tabs">
          <ProfileTabs value={profileTab} onChange={setProfileTab} />
        </TourTarget>
      </View>
      <TabScrollView
        ref={scrollRef}
        contentContainerStyle={{
          ...tabScreenPadding,
          paddingBottom: bottomPad,
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || isRefetchingHistory || isRefetchingBadges || isRefetchingFollows}
            onRefresh={() => {
              refetch();
              refetchHistory();
              refetchBadges();
              refetchFollowCounts();
              queryClient.invalidateQueries({ queryKey: ['player-tournament-titles', user?.id] });
              if (mainClubId) {
                refetchMainClub();
                refetchMainClubPoints();
              }
              if (!mainClubId || showClubPicker) refetchClubOptions();
            }}
            tintColor={ui.colors.primary}
          />
        }
      >
        {profileTab === 'profile' ? (
          <>
            <FadeInUp index={0}>
              <TourTarget id="profile.card" style={{ marginBottom: ui.spacing.md }}>
              <AppCard
                style={{
                  marginBottom: 0,
                  backgroundColor: CARD_BG,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                  <TouchableOpacity onPress={handlePhotoPress} disabled={uploadingPhoto} activeOpacity={0.9}>
                    <View style={{ position: 'relative' }}>
                      {profileImage ? (
                        <Avatar name={displayName} photo={profileImage} size="xl" style={{ marginBottom: 0 }} />
                      ) : (
                        <View
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: '#2A2A2A',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="person" size={36} color="#6B6B6B" />
                        </View>
                      )}
                      <View
                        style={{
                          position: 'absolute',
                          right: -2,
                          bottom: -2,
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: LIME,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 3,
                          borderColor: CARD_BG,
                        }}
                      >
                        {uploadingPhoto ? (
                          <ActivityIndicator size="small" color="#000" />
                        ) : (
                          <Ionicons name="add" size={18} color="#000" />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: '700',
                        fontFamily: fontFamily.regular,
                        color: ui.colors.textPrimary,
                        lineHeight: 28,
                      }}
                    >
                      {displayName}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: MUTED,
                        marginTop: 4,
                        fontFamily: fontFamily.regular,
                      }}
                      numberOfLines={2}
                    >
                      {user?.email}
                      {user?.role ? ` · ${roleLabel(user.role)}` : ''}
                    </Text>
                    <CircuitRoleBadges userId={user?.id} />
                  </View>
                </View>

                {isPlayer(user?.role) ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginTop: 18,
                      paddingTop: 16,
                      borderTopWidth: 1,
                      borderTopColor: 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <TouchableOpacity
                      style={{ flex: 1, alignItems: 'center' }}
                      activeOpacity={0.75}
                      onPress={() =>
                        router.push({
                          pathname: `/follows/${user?.id}` as any,
                          params: { tab: 'followers', name: displayName },
                        })
                      }
                    >
                      <Text style={{ fontSize: 15, color: ui.colors.textPrimary, fontFamily: fontFamily.regular }}>
                        <Text style={{ fontWeight: '700' }}>{followCounts?.followers ?? 0}</Text>
                        {'  '}
                        <Text style={{ color: MUTED }}>Seguidores</Text>
                      </Text>
                    </TouchableOpacity>
                    <View style={{ width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                    <TouchableOpacity
                      style={{ flex: 1, alignItems: 'center' }}
                      activeOpacity={0.75}
                      onPress={() =>
                        router.push({
                          pathname: `/follows/${user?.id}` as any,
                          params: { tab: 'following', name: displayName },
                        })
                      }
                    >
                      <Text style={{ fontSize: 15, color: ui.colors.textPrimary, fontFamily: fontFamily.regular }}>
                        <Text style={{ fontWeight: '700' }}>{followCounts?.following ?? 0}</Text>
                        {'  '}
                        <Text style={{ color: MUTED }}>Seguidos</Text>
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </AppCard>
              </TourTarget>
            </FadeInUp>

            {isPlayer(user?.role) ? (
              <>
                <FadeInUp index={1}>
                  <TourTarget id="profile.level" style={{ marginBottom: ui.spacing.md }}>
                  <AppCard
                    style={{
                      marginBottom: 0,
                      backgroundColor: CARD_BG,
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ position: 'relative', minHeight: 100 }}>
                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          right: -24,
                          top: -20,
                          bottom: -20,
                          width: 200,
                          opacity: 1,
                        }}
                      >
                        <LevelStripes width={200} height={180} />
                      </View>
                      <TouchableOpacity
                        onPress={() => setShowLevelingHelp(true)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ position: 'absolute', right: 0, top: 0, zIndex: 2 }}
                        accessibilityLabel="Cómo funciona la nivelación"
                      >
                        <Ionicons name="help-circle-outline" size={20} color={MUTED} />
                      </TouchableOpacity>

                      <Text
                        style={{
                          fontSize: 11,
                          letterSpacing: 1.2,
                          fontWeight: '700',
                          color: MUTED,
                          fontFamily: fontFamily.regular,
                          marginBottom: 8,
                        }}
                      >
                        TU NIVEL
                      </Text>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: '700',
                          color: ui.colors.textPrimary,
                          fontFamily: fontFamily.regular,
                          marginBottom: 12,
                          maxWidth: '70%',
                        }}
                      >
                        {isInPlacement ? 'Nivel en nivelación' : 'Nivel actual'}
                      </Text>
                      <View
                        style={{
                          alignSelf: 'flex-start',
                          //backgroundColor: LIME,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: LIME,
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          marginBottom: 14,
                        }}
                      >
                        <Text
                          style={{
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: '700',
                            fontFamily: fontFamily.regular,
                          }}
                        >
                          {formatSkillScore(skillScore)}

                          {levelCategory || declaredCategory
                            ? `.${levelCategory || declaredCategory}`
                            : ''}
                        </Text>
                      </View>
                      {isInPlacement ? (
                        <Text
                          style={{
                            fontSize: 12,
                            color: MUTED,
                            lineHeight: 18,
                            fontFamily: fontFamily.regular,
                            maxWidth: '92%',
                          }}
                        >
                          En nivelación:{' '}
                          {Math.min(placementMatchesPlayed, placementMatchesRequired)}/
                          {placementMatchesRequired} partidos completados con resultado confirmado
                          para confirmar tu categoría real.
                        </Text>
                      ) : declaredCategory ? (
                        <Text style={{ fontSize: 12, color: MUTED, fontFamily: fontFamily.regular }}>
                          Categoría: {declaredCategory}
                        </Text>
                      ) : null}
                    </View>
                  </AppCard>
                  </TourTarget>
                </FadeInUp>

                <FadeInUp index={2}>
                  <AppCard
                    style={{
                      marginBottom: ui.spacing.md,
                      backgroundColor: CARD_BG,
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ position: 'relative' }}>
                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          right: -28,
                          bottom: -36,
                          width: 220,
                          height: 180,
                          opacity: 1,
                        }}
                      >
                        <DetailsStripes width={220} height={180} />
                      </View>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: '700',
                          color: ui.colors.textPrimary,
                          fontFamily: fontFamily.regular,
                          marginBottom: 18,
                        }}
                      >
                        Detalles
                      </Text>
                      <View style={{ flexDirection: 'row' }}>
                        <View style={{ flex: 1, gap: 18, paddingRight: 14 }}>
                          <ProfileDetailItem
                            icon="map-search"
                            label="Posición"
                            value={formatPositionLabel(courtPosition)}
                          />
                          <ProfileDetailItem
                            icon="account"
                            label="Género"
                            value={formatGenderLabel(gender)}
                          />
                          <ProfileDetailItem
                            icon="calendar"
                            label="Edad"
                            value={playerAge != null ? `${playerAge} años` : 'No informada'}
                          />
                        </View>
                        <View
                          style={{
                            width: 1,
                            backgroundColor: 'rgba(255,255,255,0.12)',
                          }}
                        />
                        <View style={{ flex: 1, gap: 18, paddingLeft: 14 }}>
                          <ProfileDetailItem
                            icon="map-marker"
                            label="Ubicación"
                            value={detailsLocation}
                          />
                          <ProfileDetailItem
                            icon="tag"
                            label="Categoría"
                            value={declaredCategory || 'No definida'}
                          />
                          {isInPlacement ? (
                            <ProfileDetailItem
                              icon="check"
                              label="En nivelación"
                              value={`${placementPlayed}/${placementMatchesRequired} partidos`}
                            />
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </AppCard>
                </FadeInUp>

                <FadeInUp index={3}>
                  <LinearGradient
                    colors={['rgba(215, 255, 0, 0.58)', 'rgba(248, 255, 210, 0.58)']}
                    start={{ x: 0.02, y: 0.48 }}
                    end={{ x: 0.98, y: 0.52 }}
                    style={{
                      borderRadius: ui.radius.lg,
                      padding: 1,
                      marginBottom: ui.spacing.md,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: CARD_BG,
                        borderRadius: ui.radius.lg - 1,
                        padding: ui.spacing.lg,
                        overflow: 'hidden',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: ui.colors.textPrimary,
                          fontFamily: fontFamily.regular,
                          marginBottom: 14,
                        }}
                      >
                        Puntos competitivos (
                        {me?.competitiveMonthly?.monthKey ??
                          new Date().toISOString().slice(0, 7)}
                        )
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <CircularProgressRing
                          value={Number(me?.competitiveMonthly?.points ?? 0)}
                          maxValue={Math.max(100, Number(me?.competitiveMonthly?.points ?? 0))}
                          size={64}
                          strokeWidth={5}
                          color={LIME}
                          trackColor="rgba(255,255,255,0.12)"
                        />
                        <Text style={{ fontSize: 14, color: MUTED, fontFamily: fontFamily.regular }}>
                          pts · {me?.competitiveMonthly?.matchesPlayed ?? 0} partidos
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </FadeInUp>
              </>
            ) : null}

            {isPlayerAccount ? (
              <FadeInUp index={3}>
                <TourTarget id="profile.club" style={{ marginBottom: ui.spacing.md }}>
                <AppCard style={{ marginBottom: 0, backgroundColor: CARD_BG }}>
                  <Pressable
                    disabled={!mainClubId}
                    onPress={() => {
                      void hapticSelection();
                      router.push(`/club/${mainClubId}` as any);
                    }}
                    accessibilityRole={mainClubId ? 'button' : undefined}
                    accessibilityLabel={
                      mainClubId ? `Ver página de ${mainClub?.name ?? 'tu club principal'}` : undefined
                    }
                    style={({ pressed }) => ({ gap: 12, opacity: pressed ? 0.7 : 1 })}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: ui.colors.textPrimary,
                          fontFamily: fontFamily.regular,
                        }}
                      >
                        Club principal
                      </Text>
                      {mainClubId ? (
                        <Ionicons name="chevron-forward" size={18} color={MUTED} />
                      ) : null}
                    </View>

                    {mainClubId ? (
                      <>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: ui.colors.textPrimary,
                            fontFamily: fontFamily.regular,
                          }}
                          numberOfLines={2}
                        >
                          {mainClub?.name || 'Cargando…'}
                        </Text>
                        {mainClub && (mainClub.city || mainClub.location) ? (
                          <Text style={{ fontSize: 12, color: MUTED }} numberOfLines={1}>
                            {mainClub.city || mainClub.location}
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                  </Pressable>

                  {mainClubId ? (
                    <View style={{ gap: 12, marginTop: 12 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 12,
                          borderRadius: ui.radius.md,
                          backgroundColor: ui.colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: ui.colors.border,
                        }}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                            Puntos globales canjeables
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                            <AnimatedNumber
                              value={redeemablePoints}
                              suffix=" pts"
                              style={{ color: LIME, fontSize: 22 }}
                            />
                          </View>
                        </View>
                        <Ionicons name="gift-outline" size={22} color={ui.colors.accent} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton
                            label="Ver premios"
                            variant="outline"
                            fullWidth
                            size="sm"
                            onPress={() => router.push(`/club/${mainClubId}?tab=rewards` as any)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton
                            label="Cambiar club"
                            variant="ghost"
                            fullWidth
                            size="sm"
                            onPress={() => setShowClubPicker(true)}
                            style={{ backgroundColor: ui.colors.surfaceAlt }}
                          />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={{ gap: 14, marginTop: 12 }}>
                      <Text style={{ fontSize: 14, color: MUTED, fontFamily: fontFamily.regular }}>
                        Sin club principal
                      </Text>
                      <LimeButton label="Elegir club principal" onPress={() => setShowClubPicker(true)} />
                    </View>
                  )}
                </AppCard>
                </TourTarget>
              </FadeInUp>
            ) : null}

            {isPlayer(user?.role) ? (
              <View style={{ marginBottom: ui.spacing.md, gap: 12 }}>
                <CircuitInvitationsCard style={{ marginBottom: 0 }} />
                <TournamentTitlesCard playerId={user?.id} isSelf />
                <TourTarget id="profile.stats">
                  <PlayerMatchStatsCard
                    stats={
                      (me?.stats as PlayerMatchStats) ?? {
                        wins: 0,
                        losses: 0,
                        completed: 0,
                        notCompleted: 0,
                        total: 0,
                      }
                    }
                    title="Resumen de partidos"
                  />
                </TourTarget>
                <PlayerMatchHistoryList
                  data={matchHistory}
                  title="Historial de partidos"
                  showRatingChange
                  limit={15}
                />
              </View>
            ) : null}

            {!isPlayer(user?.role) ? (
              <AppCard variant="gradient" style={{ marginBottom: ui.spacing.md }}>
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>Modo de cuenta</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: ui.colors.textPrimary }}>
                  {roleLabel(user?.role)}
                </Text>
              </AppCard>
            ) : null}
          </>
        ) : (
          <>
            {isPlayer(user?.role) ? (
              <View
                style={{
                  backgroundColor: CARD_BG,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: CARD_BORDER,
                  padding: 16,
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: MUTED,
                    fontFamily: fontFamily.regular,
                    marginBottom: 4,
                  }}
                >
                  Localidad
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: ui.colors.textPrimary,
                    fontFamily: fontFamily.regular,
                    marginBottom: 14,
                  }}
                >
                  {locality}
                </Text>
                <LimeButton
                  label={updatingLocation ? 'Actualizando…' : 'Usar ubicación actual'}
                  onPress={() => void handleUseCurrentLocation()}
                  loading={updatingLocation}
                />
              </View>
            ) : null}

            <MenuRow
              icon={ICON_PROFILE}
              title="Editar perfil"
              subtitle="Nombre, foto y datos personales"
              onPress={() => router.push('/edit-profile' as any)}
            />
            {isPlayer(user?.role) && (
              <>
                <MenuRow
                  icon={ICON_INSIGNIA}
                  title="Insignias"
                  subtitle={
                    badgesSummary
                      ? `${badgesSummary.earnedCount}/${badgesSummary.total} desbloqueadas`
                      : 'Logros y reconocimientos'
                  }
                  onPress={() => router.push('/badges' as any)}
                />
                <MenuRow
                  icon={ICON_CALENDAR}
                  title="Configurar disponibilidad"
                  subtitle="Horarios en los que podés jugar"
                  onPress={() => router.push('/availability' as any)}
                />
                {/* <MenuRow
                  icon={ICON_CLUB}
                  title="Club y premios"
                  subtitle={
                    mainClubId
                      ? `${redeemablePoints} pts canjeables · premios del club`
                      : 'Puntos canjeables y premios del club'
                  }
                  onPress={() =>
                    router.push(
                      (mainClubId ? `/club/${mainClubId}?tab=rewards` : '/clubs') as any,
                    )
                  }
                />
                <MenuRow
                  icon={ICON_TROFEO}
                  title="Módulo de organizador"
                  subtitle="Torneos y circuitos"
                  onPress={() => router.push('/(tabs)/organizer' as any)}
                /> */}
              </>
            )}
            {canOrganize && !isPlayer(user?.role) && (
              <MenuRow
                icon={ICON_TROFEO}
                title="Módulo de organizador"
                subtitle="Torneos y circuitos"
                onPress={() => router.push('/(tabs)/organizer' as any)}
              />
            )}
            <MenuRow
              icon={ICON_APARIENCIA}
              title="Apariencia"
              subtitle={themePreferenceLabel(preference)}
              onPress={cyclePreference}
            />
            <MenuRow
              icon={ICON_NOTE}
              title="Ver tutoriales de nuevo"
              subtitle="Volvé a ver la explicación de cada pantalla"
              onPress={() => void handleReplayTours()}
            />
            <MenuRow
              icon={ICON_PASSWORD}
              title="Cambiar contraseña"
              subtitle="Actualizá tu contraseña"
              onPress={() => router.push('/change-password' as any)}
            />
            <MenuRow
              icon={ICON_PROFILE}
              title="Usuarios bloqueados"
              subtitle="Desbloqueá jugadores que bloqueaste"
              onPress={() => router.push('/blocked-users' as any)}
            />
            <MenuRow
              icon={ICON_TRASH}
              title="Eliminar cuenta"
              subtitle="Borrar tu cuenta de forma permanente"
              onPress={() => router.push('/delete-account' as any)}
              muted
            />
            <MenuRow
              icon={ICON_LOGOUT}
              title="Cerrar sesión"
              subtitle="Cerrar sesión de la aplicación"
              onPress={handleLogout}
              muted
            />
          </>
        )}
      </TabScrollView>
      <ProfilePhotoViewer
        visible={showPhotoViewer}
        photo={profileImage}
        name={displayName}
        onClose={() => setShowPhotoViewer(false)}
      />
      <Sheet visible={showLevelingHelp} onClose={() => setShowLevelingHelp(false)} title="Cómo funciona tu nivel">
        <Text style={[ui.typography.bodySm, { color: ui.colors.textSecondary, lineHeight: 20, marginBottom: 12 }]}>
          Tu nivel va de <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>0 a 1000</Text> puntos. Al
          registrarte elegís una categoría (8va a 1ra) como declaración provisional y arrancás en el piso de esa
          categoría (0% de progreso).
        </Text>
        <Text style={[ui.typography.bodySm, { color: ui.colors.textSecondary, lineHeight: 20, marginBottom: 12 }]}>
          Los primeros <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>5 partidos competitivos</Text>{' '}
          con resultado confirmado son de nivelación: tu puntaje se ajusta con Elo y, al completarlos, se confirma la
          categoría que indiquen tus resultados (puede subir o bajar respecto a la declarada).
        </Text>
        <Text style={[ui.typography.bodySm, { color: ui.colors.textSecondary, lineHeight: 20, marginBottom: 12 }]}>
          Durante la nivelación no sumás puntos del ranking competitivo mensual. Después de confirmada tu categoría,
          cada partido competitivo ajusta tu nivel y tus puntos mensuales según el resultado y la fuerza de los rivales.
        </Text>
        <Text style={[ui.typography.bodySm, { color: ui.colors.textSecondary, lineHeight: 20 }]}>
          Tu categoría visible (8va, 7ma, 6ta, etc.) se calcula a partir de ese puntaje. Por ejemplo: 8va (0–159), 5ta
          (400–519) o 1ra (880–1000).
        </Text>
      </Sheet>
      <Sheet
        visible={showClubPicker}
        onClose={() => {
          setShowClubPicker(false);
          setClubSearch('');
        }}
        title="Elegí tu club principal"
      >
        <Text style={[ui.typography.bodySm, { color: ui.colors.textSecondary, marginBottom: 12, lineHeight: 20 }]}>
          El club principal define tu ranking interno y dónde sumás puntos mensuales.
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: ui.radius.md,
            backgroundColor: ui.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: ui.colors.border,
            marginBottom: 12,
          }}
        >
          <Ionicons name="search-outline" size={18} color={ui.colors.textMuted} />
          <TextInput
            value={clubSearch}
            onChangeText={setClubSearch}
            placeholder="Buscar club…"
            placeholderTextColor={ui.colors.textMuted}
            style={{ flex: 1, fontSize: 15, color: ui.colors.textPrimary, padding: 0 }}
            autoCorrect={false}
          />
          {clubSearch ? (
            <TouchableOpacity onPress={() => setClubSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={ui.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        {loadingClubs && !clubOptions ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator color={ui.colors.primary} />
          </View>
        ) : filteredClubs.length === 0 ? (
          <Text style={{ fontSize: 13, color: ui.colors.textMuted, textAlign: 'center', paddingVertical: 16 }}>
            No encontramos clubs con esa búsqueda.
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            {filteredClubs.map((club) => {
              const selected = club.id === mainClubId;
              return (
                <PressableScale
                  key={club.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Elegir club ${club.name}`}
                  disabled={setMainClubMutation.isPending}
                  onPress={() => setMainClubMutation.mutate(club.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    marginBottom: 8,
                    minHeight: 52,
                    borderRadius: ui.radius.md,
                    backgroundColor: selected ? ui.colors.primarySoft : ui.colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: selected ? ui.colors.primary : ui.colors.border,
                    opacity: setMainClubMutation.isPending ? 0.7 : 1,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }} numberOfLines={1}>
                      {club.name}
                    </Text>
                    {club.city || club.location ? (
                      <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                        {club.city || club.location}
                      </Text>
                    ) : null}
                  </View>
                  {setMainClubMutation.isPending && setMainClubMutation.variables === club.id ? (
                    <ActivityIndicator size="small" color={ui.colors.primary} />
                  ) : (
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selected ? ui.colors.primary : ui.colors.textMuted}
                    />
                  )}
                </PressableScale>
              );
            })}
          </ScrollView>
        )}
      </Sheet>
    </Screen>
  );
}
