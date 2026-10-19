import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { isClub, isPlayer } from '@/lib/roles';
import { needsPlayerOnboarding } from '@/lib/auth/onboarding';
import { ageFromBirthDate, isAtLeastMinAge, maxBirthDateForMinAge, minAgeErrorMessage } from '@/lib/age';
import { PLAYER_CATEGORY_OPTIONS } from '@/lib/skill';
import { requestPlayerCoordinates } from '@/lib/geolocation';
import { pickAndUploadProfilePhoto, showProfilePhotoOptions } from '@/lib/profile/profile-photo';
import { ui, fontFamily } from '@/theme/tokens';
import {
  Screen,
  PrimaryButton,
  FadeInUp,
  Avatar,
  PressableScale,
} from '@/components/x4match';
import type { CourtPosition, PlayerCategory, PreferredHand } from '@/lib/types';

const LIME = '#D7FF00';
const MUTED = '#8E8E9F';
const FIELD_BG = '#121212';
const FIELD_BORDER = 'rgba(255,255,255,0.14)';
const ICON_PROFILE = require('../../assets/figma/shared/profile.png');

const GENDER_OPTIONS = ['Masculino', 'Femenino'] as const;
const HAND_OPTIONS = ['Derecha', 'Izquierda'] as const;
const POSITION_OPTIONS = ['Drive', 'Revés', 'Ambos'] as const;
const AVAILABILITY_OPTIONS = [
  { id: 'morning', label: 'Mañana (6-12hs)' },
  { id: 'afternoon', label: 'Tarde (12-18hs)' },
  { id: 'night', label: 'Noche (18-22hs)' },
  { id: 'weekend', label: 'Fines de semana' },
] as const;

function toCourtPositionLabel(value?: string | null): (typeof POSITION_OPTIONS)[number] | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'drive') return 'Drive';
  if (v === 'reves' || v === 'revés') return 'Revés';
  if (v === 'ambos' || v === 'both') return 'Ambos';
  if (value === 'Drive' || value === 'Revés' || value === 'Ambos') return value;
  return undefined;
}

function fromCourtPositionLabel(label?: string): CourtPosition | undefined {
  if (label === 'Drive') return 'drive';
  if (label === 'Revés') return 'reves';
  if (label === 'Ambos') return 'ambos';
  return undefined;
}

function staffHomeRoute(role?: string) {
  if (isClub(role)) return '/(tabs)/court-slots';
  return '/(tabs)/home';
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function SectionLabel({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <Text
      style={{
        fontSize: 14,
        fontFamily: fontFamily.regular,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 10,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

function HintText({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <Text
      style={{
        color: error ? ui.colors.danger : MUTED,
        fontSize: 12,
        lineHeight: 17,
        fontFamily: fontFamily.regular,
        marginTop: 8,
        marginBottom: 16,
      }}
    >
      {children}
    </Text>
  );
}

function OnboardingChip({
  label,
  active,
  onPress,
  fill = true,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  fill?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: fill ? 1 : undefined,
        minWidth: fill ? 0 : undefined,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 999,
        backgroundColor: active ? LIME : FIELD_BG,
        borderWidth: 1,
        borderColor: active ? LIME : FIELD_BORDER,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: '700',
          fontFamily: fontFamily.regular,
          color: active ? '#000000' : '#FFFFFF',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChipRow({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View style={{ flexDirection: 'row', width: '100%', gap: 8, marginBottom: 8, ...style }}>
      {children}
    </View>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ['Datos personales', 'Perfil de juego', 'Primeros seguidos'];
  return (
    <View style={{ marginBottom: 28, marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        {[1, 2, 3].map((n, index) => {
          const active = step >= n;
          const lineActive = step > n;
          return (
            <View key={n} style={{ flex: index < 2 ? 1 : 0, flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: active ? LIME : 'rgba(255,255,255,0.22)',
                }}
              />
              {index < 2 ? (
                <View
                  style={{
                    flex: 1,
                    height: 2,
                    marginHorizontal: 4,
                    borderRadius: 1,
                    backgroundColor: lineActive ? LIME : 'rgba(255,255,255,0.18)',
                  }}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <Text
        style={{
          marginTop: 14,
          textAlign: 'center',
          color: MUTED,
          fontSize: 14,
          fontWeight: '600',
          fontFamily: fontFamily.regular,
        }}
      >
        {labels[step - 1]}
      </Text>
    </View>
  );
}

function FieldShell({
  label,
  error,
  children,
  style,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ marginBottom: 16, width: '100%' }, style]}>
      <Text
        style={{
          fontSize: 14,
          fontFamily: fontFamily.regular,
          fontWeight: '600',
          color: '#FFFFFF',
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      {children}
      {error ? (
        <Text style={{ color: ui.colors.danger, fontSize: 12, marginTop: 6 }}>{error}</Text>
      ) : null}
    </View>
  );
}

function OnboardingField({
  label,
  error,
  value,
  onChangeText,
  placeholder,
  editable = true,
  autoCapitalize,
  autoCorrect,
}: {
  label: string;
  error?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  autoCorrect?: boolean;
}) {
  return (
    <FieldShell label={label} error={error}>
      <View
        style={{
          borderWidth: 1,
          borderColor: error ? ui.colors.danger : FIELD_BORDER,
          borderRadius: 22,
          backgroundColor: FIELD_BG,
          minHeight: 52,
          paddingHorizontal: 16,
          justifyContent: 'center',
          opacity: editable ? 1 : 0.7,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          editable={editable}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          style={{
            fontSize: 15,
            lineHeight: 20,
            fontFamily: fontFamily.regular,
            color: '#FFFFFF',
            paddingVertical: 14,
            includeFontPadding: false,
            textAlignVertical: 'center',
          }}
        />
      </View>
    </FieldShell>
  );
}

function DateField({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  error?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed') return;
    if (selected) onChange(selected);
  };

  return (
    <FieldShell label={label} error={error}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOpen((prev) => !prev)}
        style={{
          borderWidth: 1,
          borderColor: error ? ui.colors.danger : FIELD_BORDER,
          borderRadius: 22,
          backgroundColor: FIELD_BG,
          minHeight: 52,
          paddingHorizontal: 16,
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontFamily: fontFamily.regular,
            color: value ? '#FFFFFF' : MUTED,
          }}
        >
          {value ? formatDate(value) : placeholder || 'dd/mm/aaaa'}
        </Text>
      </TouchableOpacity>
      {open ? (
        <DateTimePicker
          value={value || new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={maxBirthDateForMinAge()}
          onChange={handleChange}
        />
      ) : null}
    </FieldShell>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateUser, logout } = useAuth();
  const checkedCompleteRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(1);
  const [stepReady, setStepReady] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(user?.photo || null);
  const [name, setName] = useState(user?.fejubaFound ? user?.name || '' : '');
  const [birthDate, setBirthDate] = useState<Date | null>(
    user?.birthDate ? new Date(user.birthDate) : null,
  );
  const [gender, setGender] = useState<string | undefined>(
    user?.gender === 'Masculino' || user?.gender === 'Femenino' ? user.gender : undefined,
  );
  const [location, setLocation] = useState(user?.location || '');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [declaredCategory, setDeclaredCategory] = useState<PlayerCategory | undefined>(
    (user?.declaredCategory as PlayerCategory | undefined) || undefined,
  );
  const [availability, setAvailability] = useState<string[]>([]);
  const [preferredHand, setPreferredHand] = useState<PreferredHand | null>(
    (user?.preferredHand as PreferredHand) || null,
  );
  const [courtPosition, setCourtPosition] = useState<(typeof POSITION_OPTIONS)[number] | undefined>(
    toCourtPositionLabel(user?.courtPosition),
  );
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [followQuery, setFollowQuery] = useState('');
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followingId, setFollowingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);

  const age = useMemo(() => ageFromBirthDate(birthDate), [birthDate]);
  const fejubaFound = Boolean(user?.fejubaFound || user?.fejubaId || user?.fejubaCategory);

  useEffect(() => {
    if (!user || checkedCompleteRef.current) return;
    checkedCompleteRef.current = true;
    // Si ya completó onboarding (p. ej. entró por deep link), no lo retenemos acá.
    if (isPlayer(user.role) && !needsPlayerOnboarding(user)) {
      router.replace(staffHomeRoute(user.role) as any);
    }
  }, [user, router]);

  // Restaurar step si la screen se remontó a mitad del flujo.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user?.id) {
          if (!cancelled) setStepReady(true);
          return;
        }
        const raw = await AsyncStorage.getItem(`onboarding_step:${user.id}`);
        const saved = raw ? Number(raw) : 1;
        if (!cancelled && saved >= 1 && saved <= 3) {
          // No pisar un avance que el usuario ya hizo mientras cargábamos.
          setStep((current) => Math.max(current, saved));
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setStepReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!stepReady || !user?.id) return;
    void AsyncStorage.setItem(`onboarding_step:${user.id}`, String(step));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step, stepReady, user?.id]);

  useEffect(() => {
    if (!user) return;
    if (user.fejubaFound || user.fejubaId) {
      if (user.name) setName(user.name);
      if (user.gender === 'Masculino' || user.gender === 'Femenino') setGender(user.gender);
      if (user.declaredCategory) setDeclaredCategory(user.declaredCategory as PlayerCategory);
    }
    if (user.photo) setPhotoUri(user.photo);
    if (user.nickname) setNickname(user.nickname);
  }, [user]);

  const { data: searchResults = [], isFetching: searchingPlayers } = useQuery({
    queryKey: ['onboarding-follow-search', followQuery],
    enabled: step === 3 && followQuery.trim().length >= 2,
    queryFn: async () => {
      const res = await api.get('/players/search', { params: { q: followQuery.trim() } });
      return Array.isArray(res.data) ? res.data : res.data?.items || [];
    },
  });

  const saveStep1 = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        nickname: nickname.trim().toLowerCase(),
        gender,
        birthDate: birthDate ? toIsoDate(birthDate) : null,
        location: location.trim() || null,
      };
      if (coords) {
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
      }
      const res = await api.patch('/users/profile', payload);
      return res.data;
    },
    onSuccess: (data) => {
      // Avanzar YA: si updateUser/SecureStore tarda o algo remonta la screen,
      // no queremos quedar trabados en step 1 con el spinner.
      setStep(2);
      setErrors({});
      void updateUser({
        name: data?.name || name.trim(),
        nickname: data?.nickname || nickname.trim().toLowerCase(),
        gender: data?.gender || gender,
        birthDate: data?.birthDate || (birthDate ? toIsoDate(birthDate) : undefined),
        location: data?.location ?? (location.trim() || undefined),
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      const status = error?.response?.status;
      const text = Array.isArray(message)
        ? message.join('\n')
        : message ||
          (status === 409 || String(message || '').toLowerCase().includes('nickname')
            ? 'Ese nombre de usuario ya está en uso'
            : 'No se pudo guardar');
      // Unique nickname suele venir como 500 de Postgres
      if (
        status === 500 &&
        /nickname|unique|duplicate/i.test(String(error?.response?.data?.message || error?.message || ''))
      ) {
        Alert.alert('Nombre de usuario', 'Ese nombre de usuario ya está en uso. Probá con otro.');
        return;
      }
      Alert.alert('Error', text);
    },
  });

  const saveStep2 = useMutation({
    mutationFn: async () => {
      await api.patch('/users/profile', { declaredCategory });
      await api.patch('/users/preferences', {
        preferredHand: preferredHand || undefined,
        courtPosition: fromCourtPositionLabel(courtPosition) || undefined,
        availabilityWindows: availability,
        preferredPlayTime: availability.join(','),
      });
    },
    onSuccess: () => {
      setStep(3);
      setErrors({});
      void updateUser({
        declaredCategory,
        preferredHand: preferredHand || undefined,
        courtPosition: fromCourtPositionLabel(courtPosition) || courtPosition,
        availabilityWindows: availability,
        preferredPlayTime: availability.join(','),
        levelCategory: declaredCategory,
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      Alert.alert(
        'Error',
        Array.isArray(message) ? message.join('\n') : message || 'No se pudo guardar',
      );
    },
  });

  const finish = async () => {
    try {
      const profileRes = await api.get('/users/profile');
      const profile = profileRes.data ?? {};
      await updateUser({
        nickname: profile.nickname || nickname.trim().toLowerCase(),
        gender: profile.gender || gender,
        birthDate: profile.birthDate || (birthDate ? toIsoDate(birthDate) : undefined),
        declaredCategory: profile.declaredCategory || declaredCategory,
        preferredHand: profile.preferences?.preferredHand || preferredHand || undefined,
        courtPosition:
          profile.preferences?.courtPosition ||
          fromCourtPositionLabel(courtPosition) ||
          courtPosition,
      });
      if (user?.id) {
        await AsyncStorage.removeItem(`onboarding_step:${user.id}`);
      }
    } catch {
      // Igual salimos: los datos ya se guardaron en steps 1–2.
    }
    router.replace(staffHomeRoute(user?.role) as any);
  };
  const skip = () => finish();

  const handleLogoutLater = () => {
    Alert.alert(
      'Cerrar sesión',
      'Podés completar tu perfil más tarde. Vas a volver a iniciar sesión.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setLoggingOut(true);
              try {
                if (user?.id) {
                  await AsyncStorage.removeItem(`onboarding_step:${user.id}`);
                }
                await logout();
                router.replace('/(auth)/login' as any);
              } catch {
                Alert.alert('Error', 'No se pudo cerrar sesión. Intentá de nuevo.');
              } finally {
                setLoggingOut(false);
              }
            })();
          },
        },
      ],
    );
  };

  const validateStep1 = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'El nombre es requerido';
    const normalizedNickname = nickname.trim().toLowerCase();
    if (!normalizedNickname) next.nickname = 'Elegí un nombre de usuario';
    else if (!/^[a-z0-9_]{3,20}$/.test(normalizedNickname)) {
      next.nickname = 'Entre 3 y 20 caracteres (letras, números o _)';
    }
    if (!birthDate) next.birthDate = 'La fecha de nacimiento es requerida';
    else if (age == null) next.birthDate = 'Fecha inválida';
    else if (!isAtLeastMinAge(birthDate)) next.birthDate = minAgeErrorMessage();
    if (!gender) next.gender = 'Elegí tu sexo';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = () => {
    const next: Record<string, string> = {};
    if (!declaredCategory) next.declaredCategory = 'Elegí tu categoría';
    if (!preferredHand) next.preferredHand = 'Elegí tu mano hábil';
    if (!courtPosition) next.courtPosition = 'Elegí de qué lado jugás';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleUseLocation = async () => {
    setLocating(true);
    try {
      const current = await requestPlayerCoordinates({ withLabel: true, showAlerts: true });
      if (!current) {
        Alert.alert(
          'Ubicación',
          'No pudimos obtener tu ubicación. Revisá que el permiso esté activo en Ajustes e intentá de nuevo.',
        );
        return;
      }
      setCoords({ latitude: current.latitude, longitude: current.longitude });
      if (current.label) setLocation(current.label);
      else if (!location.trim() || location.trim() === 'Ubicación actual') {
        setLocation(`${current.latitude.toFixed(4)}, ${current.longitude.toFixed(4)}`);
      }
    } finally {
      setLocating(false);
    }
  };

  const handlePhoto = () => {
    showProfilePhotoOptions({
      hasPhoto: !!photoUri,
      onPick: async (source) => {
        const photoUrl = await pickAndUploadProfilePhoto(source);
        if (!photoUrl) return;
        setPhotoUri(photoUrl);
        await updateUser({ photo: photoUrl });
      },
    });
  };

  const followPlayer = async (targetUserId: string) => {
    const id = String(targetUserId);
    if (followedIds.has(id)) return;
    setFollowingId(id);
    try {
      await api.post(`/follows/${id}`);
      setFollowedIds((prev) => new Set(prev).add(id));
    } catch (error: any) {
      const message = error?.response?.data?.message || 'No se pudo seguir al jugador';
      Alert.alert('Error', typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setFollowingId(null);
    }
  };

  if (!isPlayer(user?.role) && step === 1) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: ui.spacing.lg, backgroundColor: '#000' }}>
          <PrimaryButton
            label={isClub(user?.role) ? 'Ir a horarios' : 'Ir al panel'}
            onPress={() => router.replace(staffHomeRoute(user?.role) as any)}
            fullWidth
            size="lg"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: Math.max(insets.top, 12) + 8,
            paddingBottom: 16,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              minHeight: 28,
              marginBottom: 4,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {step > 1 ? (
              <TouchableOpacity
                onPress={() => setStep((prev) => Math.max(1, prev - 1))}
                style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={20} color={LIME} />
                <Text style={{ color: LIME, fontWeight: '700', fontFamily: fontFamily.regular }}>Volver</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <TouchableOpacity
              onPress={handleLogoutLater}
              disabled={loggingOut}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ opacity: loggingOut ? 0.6 : 1 }}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color={MUTED} />
              ) : (
                <Text style={{ color: MUTED, fontSize: 13, fontWeight: '600', fontFamily: fontFamily.regular }}>
                  Cerrar sesión
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: '#FFFFFF',
              fontFamily: fontFamily.regular,
              marginBottom: 8,
            }}
          >
            ¡{gender === 'Femenino' ? 'Bienvenida' : gender === 'Masculino' ? 'Bienvenido' : 'Bienvenido/a'}
            {name.trim() ? `, ${name.trim()}` : ''}!
          </Text>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 20,
              color: '#FFFFFF',
              fontFamily: fontFamily.regular,
              marginBottom: 8,
            }}
          >
            Te ayudamos a configurar tu perfil en pocos minutos
            {fejubaFound ? ' · Encontramos tu categoría federada' : ''}.
          </Text>

          <Stepper step={step} />

          {step === 1 ? (
            <FadeInUp index={0}>
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <TouchableOpacity onPress={handlePhoto} activeOpacity={0.85}>
                  {photoUri ? (
                    <Image
                      source={{ uri: photoUri }}
                      style={{
                        width: 112,
                        height: 112,
                        borderRadius: 56,
                        borderWidth: 2,
                        borderColor: LIME,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 112,
                        height: 112,
                        borderRadius: 56,
                        borderWidth: 2,
                        borderColor: LIME,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'transparent',
                      }}
                    >
                      <Image
                        source={ICON_PROFILE}
                        style={{ width: 48, height: 62 }}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePhoto} style={{ marginTop: 12 }}>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontWeight: '600',
                      fontSize: 15,
                      fontFamily: fontFamily.regular,
                    }}
                  >
                    Subir foto
                  </Text>
                </TouchableOpacity>
              </View>

              <OnboardingField
                label="Nombre completo"
                value={name}
                onChangeText={setName}
                error={errors.name}
                placeholder={fejubaFound ? undefined : 'Como figurás en la cancha'}
                autoCapitalize="words"
              />

              <OnboardingField
                label="Nombre de usuario"
                value={nickname}
                onChangeText={(text) =>
                  setNickname(text.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g, ''))
                }
                error={errors.nickname}
                placeholder="ej: franconawel"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1.45 }}>
                  <DateField
                    label="Fecha de nacimiento"
                    value={birthDate}
                    onChange={setBirthDate}
                    error={errors.birthDate}
                    placeholder="dd/mm/aaaa"
                  />
                </View>
                <View style={{ flex: 0.7 }}>
                  <OnboardingField
                    label="Edad"
                    value={age != null ? String(age) : ''}
                    onChangeText={() => undefined}
                    editable={false}
                    placeholder="—"
                  />
                </View>
              </View>

              <View style={{ marginBottom: 18 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: fontFamily.regular,
                    fontWeight: '600',
                    color: '#FFFFFF',
                    marginBottom: 10,
                  }}
                >
                  Sexo
                </Text>
                <View style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
                  {GENDER_OPTIONS.map((option) => {
                    const active = gender === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setGender(option)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          minHeight: 48,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: active ? LIME : FIELD_BG,
                          borderWidth: 1,
                          borderColor: active ? LIME : FIELD_BORDER,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: '700',
                            fontFamily: fontFamily.regular,
                            color: active ? '#000000' : '#FFFFFF',
                          }}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.gender ? (
                  <Text style={{ color: ui.colors.danger, fontSize: 12, marginTop: 6 }}>
                    {errors.gender}
                  </Text>
                ) : null}
              </View>



              <OnboardingField
                label="Ubicación"
                value={location}
                onChangeText={setLocation}
              />
              <PressableScale
                onPress={handleUseLocation}
                disabled={locating}
                style={{
                  minHeight: 52,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: LIME,
                  backgroundColor: 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  opacity: locating ? 0.7 : 1,
                }}
              >
                {locating ? (
                  <ActivityIndicator color={LIME} />
                ) : (
                  <Text
                    style={{
                      color: LIME,
                      fontSize: 15,
                      fontWeight: '700',
                      fontFamily: fontFamily.regular,
                    }}
                  >
                    Usar mi ubicación actual
                  </Text>
                )}
              </PressableScale>

              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  lineHeight: 17,
                  fontFamily: fontFamily.regular,
                  marginBottom: 8,
                  marginTop: -4,
                }}
              >
                No compartimos tu ubicación exacta: solo una ubicación aproximada para encontrar
                jugadores cerca.
              </Text>
            </FadeInUp>
          ) : null}

          {step === 2 ? (
            <FadeInUp index={0}>
              <SectionLabel>¿Cuál es tu categoría?</SectionLabel>
              {fejubaFound && declaredCategory ? (
                <View style={{ marginBottom: 4 }}>
                  <ChipRow>
                    <OnboardingChip label={declaredCategory} active onPress={() => undefined} />
                  </ChipRow>
                  <HintText>
                    Categoría federada detectada con tu DNI. Queda confirmada sin nivelación.
                  </HintText>
                </View>
              ) : (
                <View style={{ marginBottom: 4 }}>
                  <ChipRow>
                    {PLAYER_CATEGORY_OPTIONS.slice(0, 4).map((option) => (
                      <OnboardingChip
                        key={option}
                        label={option}
                        active={declaredCategory === option}
                        onPress={() => setDeclaredCategory(option)}
                      />
                    ))}
                  </ChipRow>
                  <ChipRow>
                    {PLAYER_CATEGORY_OPTIONS.slice(4).map((option) => (
                      <OnboardingChip
                        key={option}
                        label={option}
                        active={declaredCategory === option}
                        onPress={() => setDeclaredCategory(option)}
                      />
                    ))}
                  </ChipRow>
                  {errors.declaredCategory ? (
                    <HintText error>{errors.declaredCategory}</HintText>
                  ) : null}
                </View>
              )}

              <SectionLabel style={{ marginTop: 16 }}>Disponibilidad</SectionLabel>
              <ChipRow>
                {AVAILABILITY_OPTIONS.slice(0, 2).map((option) => {
                  const selected = availability.includes(option.id);
                  return (
                    <OnboardingChip
                      key={option.id}
                      label={option.label}
                      active={selected}
                      onPress={() =>
                        setAvailability((prev) =>
                          selected ? prev.filter((id) => id !== option.id) : [...prev, option.id],
                        )
                      }
                    />
                  );
                })}
              </ChipRow>
              <ChipRow style={{ marginBottom: 18 }}>
                {AVAILABILITY_OPTIONS.slice(2).map((option) => {
                  const selected = availability.includes(option.id);
                  return (
                    <OnboardingChip
                      key={option.id}
                      label={option.label}
                      active={selected}
                      onPress={() =>
                        setAvailability((prev) =>
                          selected ? prev.filter((id) => id !== option.id) : [...prev, option.id],
                        )
                      }
                    />
                  );
                })}
              </ChipRow>

              <SectionLabel>Mano hábil</SectionLabel>
              <ChipRow style={{ marginBottom: 4 }}>
                {HAND_OPTIONS.map((option) => {
                  const value = option === 'Derecha' ? 'right' : 'left';
                  return (
                    <OnboardingChip
                      key={option}
                      label={option}
                      active={preferredHand === value}
                      onPress={() => setPreferredHand(value)}
                    />
                  );
                })}
              </ChipRow>
              {errors.preferredHand ? (
                <HintText error>{errors.preferredHand}</HintText>
              ) : (
                <View style={{ height: 16 }} />
              )}

              <SectionLabel>¿De qué jugás?</SectionLabel>
              <ChipRow style={{ marginBottom: 4 }}>
                {POSITION_OPTIONS.map((option) => (
                  <OnboardingChip
                    key={option}
                    label={option}
                    active={courtPosition === option}
                    onPress={() => setCourtPosition(option)}
                  />
                ))}
              </ChipRow>
              {errors.courtPosition ? (
                <HintText error>{errors.courtPosition}</HintText>
              ) : null}
            </FadeInUp>
          ) : null}

          {step === 3 ? (
            <FadeInUp index={0}>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 22,
                  fontWeight: '700',
                  fontFamily: fontFamily.regular,
                  marginBottom: 8,
                  marginTop: 4,
                }}
              >
                Buscá jugadores para <Text style={{ color: LIME }}>seguir</Text>
              </Text>
              <Text
                style={{
                  color: MUTED,
                  fontSize: 13,
                  lineHeight: 18,
                  fontFamily: fontFamily.regular,
                  marginBottom: 20,
                }}
              >
                Opcional: podés omitir este paso y seguir gente después
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  borderWidth: 1.5,
                  borderColor: LIME,
                  backgroundColor: 'transparent',
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  marginBottom: 16,
                  minHeight: 52,
                }}
              >
                <Ionicons name="search" size={18} color={LIME} />
                <TextInput
                  value={followQuery}
                  onChangeText={setFollowQuery}
                  placeholder="Nombre o usuario"
                  placeholderTextColor={MUTED}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    color: '#FFFFFF',
                    fontSize: 15,
                    fontFamily: fontFamily.regular,
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {searchingPlayers ? (
                <Text style={{ color: MUTED, marginBottom: 8, fontFamily: fontFamily.regular }}>
                  Buscando…
                </Text>
              ) : null}
              {(searchResults as any[]).map((player: any, index: number) => {
                const playerId = String(player.userId || player.user_id || player.id);
                const followed = followedIds.has(playerId);
                return (
                  <FadeInUp key={playerId || index} index={index}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 12,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: FIELD_BORDER,
                        backgroundColor: FIELD_BG,
                      }}
                    >
                      <Avatar
                        name={player.name || player.nickname || 'J'}
                        photo={player.photo || player.photo_url}
                        size="md"
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontWeight: '700',
                            color: '#FFFFFF',
                            fontFamily: fontFamily.regular,
                          }}
                        >
                          {player.name || player.nickname}
                        </Text>
                        {player.nickname ? (
                          <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                            @{player.nickname}
                          </Text>
                        ) : null}
                      </View>
                      <PressableScale
                        onPress={() => followPlayer(playerId)}
                        disabled={followed || followingId === playerId}
                        style={{
                          minHeight: 36,
                          paddingHorizontal: 14,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: followed ? 'transparent' : LIME,
                          borderWidth: 1,
                          borderColor: followed ? FIELD_BORDER : LIME,
                          opacity: followingId === playerId ? 0.7 : 1,
                        }}
                      >
                        {followingId === playerId ? (
                          <ActivityIndicator color={followed ? MUTED : '#000'} size="small" />
                        ) : (
                          <Text
                            style={{
                              color: followed ? MUTED : '#000000',
                              fontWeight: '700',
                              fontSize: 13,
                              fontFamily: fontFamily.regular,
                            }}
                          >
                            {followed ? 'Siguiendo' : 'Seguir'}
                          </Text>
                        )}
                      </PressableScale>
                    </View>
                  </FadeInUp>
                );
              })}
            </FadeInUp>
          ) : null}
        </ScrollView>

        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: '#000000',
          }}
        >
          {step === 1 ? (
            <PressableScale
              onPress={() => {
                if (!validateStep1()) {
                  Alert.alert(
                    'Completá tus datos',
                    'Revisá nombre, usuario, fecha de nacimiento y sexo para continuar.',
                  );
                  return;
                }
                saveStep1.mutate();
              }}
              disabled={saveStep1.isPending}
              style={{
                backgroundColor: LIME,
                borderRadius: 999,
                minHeight: 54,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: saveStep1.isPending ? 0.7 : 1,
              }}
            >
              {saveStep1.isPending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text
                  style={{
                    color: '#000000',
                    fontSize: 16,
                    fontWeight: '700',
                    fontFamily: fontFamily.regular,
                  }}
                >
                  Continuar
                </Text>
              )}
            </PressableScale>
          ) : null}
          {step === 2 ? (
            <PressableScale
              onPress={() => {
                if (!validateStep2()) {
                  Alert.alert(
                    'Completá tu perfil de juego',
                    'Elegí categoría, mano hábil y lado de la cancha para continuar.',
                  );
                  return;
                }
                saveStep2.mutate();
              }}
              disabled={saveStep2.isPending}
              style={{
                backgroundColor: LIME,
                borderRadius: 999,
                minHeight: 54,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: saveStep2.isPending ? 0.7 : 1,
              }}
            >
              {saveStep2.isPending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text
                  style={{
                    color: '#000000',
                    fontSize: 16,
                    fontWeight: '700',
                    fontFamily: fontFamily.regular,
                  }}
                >
                  Continuar
                </Text>
              )}
            </PressableScale>
          ) : null}
          {step === 3 ? (
            <View style={{ gap: 10 }}>
              <PressableScale
                onPress={finish}
                style={{
                  backgroundColor: LIME,
                  borderRadius: 999,
                  minHeight: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#000000',
                    fontSize: 16,
                    fontWeight: '700',
                    fontFamily: fontFamily.regular,
                  }}
                >
                  Empezar a jugar
                </Text>
              </PressableScale>
              <PressableScale
                onPress={skip}
                style={{
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 15,
                    fontWeight: '600',
                    fontFamily: fontFamily.regular,
                  }}
                >
                  Omitir
                </Text>
              </PressableScale>
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
