import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { themePreferenceLabel, useTheme } from '@/contexts/ThemeContext';
import { isClub, canOrganizeEvents, isPlayer, roleLabel } from '@/lib/roles';
import { api } from '@/lib/api';
import { mapPlayerMatchHistory } from '@/lib/mappers';
import { resolveSkillScore } from '@/lib/skill';
import { pickAndUploadProfilePhoto, showProfilePhotoOptions } from '@/lib/profile-photo';
import { requestPlayerCoordinates, syncPlayerCoordinates } from '@/lib/geolocation';
import { invalidateRedeemablePoints, useRedeemablePoints } from '@/lib/redeemable-points';
import { ui } from '@/theme/tokens';
import { getTabScreenPaddingBottom, tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  AppHeader,
  AppCard,
  PrimaryButton,
  Avatar,
  PlayerMatchStatsCard,
  PlayerMatchHistoryList,
  SkillProgress,
  ProfilePhotoViewer,
  AnimatedNumber,
  FadeInUp,
  BadgesSection,
  Sheet,
  PressableScale,
} from '@/components/padely';
import { ClubProfilePanel } from '@/components/club/ClubProfilePanel';
import type { PlayerMatchStats, BadgesSummary } from '@/lib/types';

type ProfileClub = { id: string; name: string; zone?: string; city?: string };

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
  iconBg,
  iconColor,
  title,
  subtitle,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <AppCard padding="sm">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name={icon} size={20} color={iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: danger ? ui.colors.danger : ui.colors.textPrimary }}>
                {title}
              </Text>
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>{subtitle}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
        </View>
      </AppCard>
    </TouchableOpacity>
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
  const isClubAccount = useMemo(() => isClub(user?.role), [user?.role]);
  const canOrganize = useMemo(() => canOrganizeEvents(user?.role) && !isClub(user?.role), [user?.role]);
  const isPlayerAccount = useMemo(() => isPlayer(user?.role), [user?.role]);
  const authed = Boolean(token);

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
      const haystack = [club.name, club.zone, club.city].filter(Boolean).join(' ').toLowerCase();
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
  const zone = resolveLocality([
    localityOverride,
    me?.location,
    isPlaceholderLocation(user?.location) ? null : user?.location,
    me?.zone,
    me?.player?.zone,
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

  if (isClubAccount) {
    return (
      <Screen>
        <AppHeader title="Perfil" />
        <View style={{ flex: 1, paddingHorizontal: ui.spacing.lg }}>
          <ClubProfilePanel onLogout={handleLogout} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Perfil" />
      <ScrollView
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
        <FadeInUp index={0}>
          <View style={{ alignItems: 'center', marginBottom: ui.spacing.lg }}>
            <TouchableOpacity onPress={handlePhotoPress} disabled={uploadingPhoto} activeOpacity={0.9}>
              <View style={{ position: 'relative' }}>
                <Avatar name={displayName} photo={profileImage} size="xl" style={{ marginBottom: 0 }} />
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
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color={ui.colors.onPrimary} />
                  ) : (
                    <Ionicons name="camera" size={16} color={ui.colors.onPrimary} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePhotoPress} disabled={uploadingPhoto} style={{ marginTop: 12 }}>
              <Text style={{ color: ui.colors.primary, fontWeight: '600', fontSize: 14 }}>
                {uploadingPhoto ? 'Subiendo foto...' : profileImage ? 'Cambiar foto de perfil' : 'Agregar foto de perfil'}
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 8 }}>
              {profileImage ? 'Tocá la foto para verla o cambiarla' : 'Mostrá tu foto para que te reconozcan en la app'}
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 12 }}>{displayName}</Text>
            <Text style={{ fontSize: 13, color: ui.colors.textMuted, marginTop: 4 }}>{user?.email}</Text>
            <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
              {roleLabel(user?.role)}
            </Text>
            {isPlayer(user?.role) ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 28,
                  marginTop: 16,
                }}
              >
                <View style={{ alignItems: 'center', minWidth: 72 }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.textPrimary }}>
                    {followCounts?.followers ?? 0}
                  </Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                    Seguidores
                  </Text>
                </View>
                <View style={{ width: 1, height: 28, backgroundColor: ui.colors.border }} />
                <View style={{ alignItems: 'center', minWidth: 72 }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.textPrimary }}>
                    {followCounts?.following ?? 0}
                  </Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                    Seguidos
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </FadeInUp>

        {isPlayer(user?.role) ? (
          <FadeInUp index={1}>
            <AppCard variant="elevated" style={{ marginBottom: ui.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>Localidad</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: ui.colors.textPrimary }}>{zone}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowLevelingHelp(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Cómo funciona la nivelación"
                >
                  <Ionicons name="help-circle-outline" size={22} color={ui.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => void handleUseCurrentLocation()}
                disabled={updatingLocation}
                activeOpacity={0.8}
                style={{
                  marginTop: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  alignSelf: 'flex-start',
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: ui.radius.sm,
                  backgroundColor: ui.colors.primarySoft,
                  borderWidth: 1,
                  borderColor: ui.colors.border,
                  opacity: updatingLocation ? 0.7 : 1,
                }}
              >
                {updatingLocation ? (
                  <ActivityIndicator size="small" color={ui.colors.primary} />
                ) : (
                  <Ionicons name="navigate-outline" size={16} color={ui.colors.primary} />
                )}
                <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.primary }}>
                  {updatingLocation ? 'Actualizando…' : 'Usar ubicación actual'}
                </Text>
              </TouchableOpacity>
              <View style={{ marginTop: 12 }}>
                <SkillProgress
                  score={skillScore}
                  category={levelCategory}
                  label={isInPlacement ? 'Nivel en nivelación' : 'Nivel actual'}
                />
              </View>
              {isInPlacement ? (
                <View
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: ui.radius.md,
                    backgroundColor: ui.colors.surfaceAlt,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: ui.colors.textPrimary }}>
                    En nivelación · {Math.min(placementMatchesPlayed, placementMatchesRequired)}/
                    {placementMatchesRequired} partidos
                  </Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                    Categoría declarada: {declaredCategory || levelCategory || '—'}. Jugá partidos
                    competitivos con resultado confirmado para confirmar tu categoría real.
                  </Text>
                </View>
              ) : declaredCategory ? (
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 10 }}>
                  Categoría:{' '}
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{declaredCategory}</Text>
                </Text>
              ) : null}
              {me?.competitiveMonthly != null ? (
                <>
                  <Text style={[ui.typography.bodySm, { color: ui.colors.textSecondary, marginTop: 12 }]}>
                    Puntos competitivos ({me.competitiveMonthly.monthKey})
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                    <AnimatedNumber value={me.competitiveMonthly.points} suffix=" pts" style={{ color: ui.colors.primary, fontSize: 22 }} />
                    <Text style={[ui.typography.bodySm, { color: ui.colors.textSecondary }]}>
                      · {me.competitiveMonthly.matchesPlayed} partidos
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 4 }}>
                    Ganás más si los rivales son más fuertes; perdés más si perdés contra más débiles
                  </Text>
                </>
              ) : null}
            </AppCard>
          </FadeInUp>
        ) : null}

        {isPlayerAccount ? (
          <FadeInUp index={2}>
            <AppCard style={{ marginBottom: ui.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>Club principal</Text>
                  <Text
                    style={{ fontSize: 16, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 4 }}
                    numberOfLines={2}
                  >
                    {mainClub?.name || (mainClubId ? 'Cargando…' : 'Sin club principal')}
                  </Text>
                  {mainClub && (mainClub.zone || mainClub.city) ? (
                    <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }} numberOfLines={1}>
                      {mainClub.zone || mainClub.city}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: ui.colors.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="business-outline" size={22} color={ui.colors.primary} />
                </View>
              </View>

              {mainClubId ? (
                <View style={{ marginTop: 14, gap: 12 }}>
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
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>Puntos globales canjeables</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                        <AnimatedNumber
                          value={redeemablePoints}
                          suffix=" pts"
                          style={{ color: ui.colors.primary, fontSize: 22 }}
                        />
                      </View>
                      <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 4 }}>
                        Saldo para canjear en toda la app
                      </Text>
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
                <View style={{ marginTop: 14, gap: 12 }}>
                  <Text style={{ fontSize: 13, color: ui.colors.textMuted }}>
                    Elegí tu club principal para seguir el ranking interno y sumar puntos globales canjeables.
                  </Text>
                  <PrimaryButton
                    label="Elegir club principal"
                    fullWidth
                    onPress={() => setShowClubPicker(true)}
                  />
                </View>
              )}
            </AppCard>
          </FadeInUp>
        ) : null}

        {isPlayer(user?.role) ? (
          <View style={{ marginBottom: ui.spacing.md, gap: 12 }}>
            <PlayerMatchStatsCard
              stats={(me?.stats as PlayerMatchStats) ?? {
                wins: 0,
                losses: 0,
                completed: 0,
                notCompleted: 0,
                total: 0,
              }}
              title="Resumen de partidos"
            />
            <PlayerMatchHistoryList
              data={matchHistory}
              title="Historial de partidos"
              showRatingChange
              limit={15}
            />
            <BadgesSection
              badges={badgesSummary?.earned}
              earnedCount={badgesSummary?.earnedCount}
              total={badgesSummary?.total}
              onPress={() => router.push('/badges' as any)}
            />
          </View>
        ) : null}

        {!isPlayer(user?.role) ? (
          <AppCard variant="gradient" style={{ marginBottom: ui.spacing.md }}>
            <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>Modo de cuenta</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: ui.colors.textPrimary }}>{roleLabel(user?.role)}</Text>
          </AppCard>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: ui.spacing.lg }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Editar perfil" variant="outline" fullWidth onPress={() => router.push('/edit-profile' as any)} />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label={isClubAccount ? 'Horarios' : 'Jugar'}
              variant="dark"
              fullWidth
              onPress={() => {
                if (isClubAccount) router.push('/(tabs)/court-slots' as any);
                else router.push('/(tabs)/search' as any);
              }}
            />
          </View>
        </View>

        {isPlayer(user?.role) && (
          <>
            <MenuRow
              icon="calendar-outline"
              iconBg={ui.colors.primarySoft}
              iconColor={ui.colors.primary}
              title="Configurar disponibilidad"
              subtitle="Horarios en los que podés jugar"
              onPress={() => router.push('/availability' as any)}
            />
            <MenuRow
              icon="business-outline"
              iconBg={ui.colors.accentSoft}
              iconColor={ui.colors.accent}
              title="Clubs y premios"
              subtitle={
                mainClubId
                  ? `${redeemablePoints} pts canjeables · ranking y premios`
                  : 'Ranking interno y canje de puntos'
              }
              onPress={() =>
                router.push(
                  (mainClubId ? `/club/${mainClubId}?tab=rewards` : '/(tabs)/clubs') as any,
                )
              }
            />
            <MenuRow
              icon="trophy-outline"
              iconBg={ui.colors.primarySoft}
              iconColor={ui.colors.primary}
              title="Mis torneos y circuitos"
              subtitle="Creá y gestioná eventos"
              onPress={() => router.push('/(tabs)/organizer' as any)}
            />
            <MenuRow
              icon="time-outline"
              iconBg={ui.colors.surfaceAlt}
              iconColor={ui.colors.textSecondary}
              title="Historial de organización"
              subtitle="Torneos que organizaste"
              onPress={() => router.push('/(tabs)/history' as any)}
            />
          </>
        )}
        {canOrganize && !isPlayer(user?.role) && (
          <MenuRow
            icon="trophy-outline"
            iconBg={ui.colors.primarySoft}
            iconColor={ui.colors.primary}
            title="Panel de organización"
            subtitle="Torneos y circuitos"
            onPress={() => router.push('/(tabs)/organizer' as any)}
          />
        )}
        <MenuRow
          icon="color-palette-outline"
          iconBg={ui.colors.primarySoft}
          iconColor={ui.colors.primary}
          title="Apariencia"
          subtitle={themePreferenceLabel(preference)}
          onPress={cyclePreference}
        />
        <MenuRow
          icon="lock-closed-outline"
          iconBg={ui.colors.warningSoft}
          iconColor={ui.colors.warning}
          title="Cambiar contraseña"
          subtitle="Actualizá tu contraseña"
          onPress={() => router.push('/change-password' as any)}
        />
        <MenuRow
          icon="log-out-outline"
          iconBg={ui.colors.dangerSoft}
          iconColor={ui.colors.danger}
          title="Cerrar sesión"
          subtitle="Cerrar sesión de la aplicación"
          onPress={handleLogout}
          danger
        />
      </ScrollView>
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
                    {club.zone || club.city ? (
                      <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                        {club.zone || club.city}
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
