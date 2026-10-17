import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  getAppleSignInErrorMessage,
  getPendingAppleSignup,
  isApplePlatform,
  isAppleSignInAvailable,
  setPendingAppleSignup,
  signInWithApple,
} from '@/lib/auth/apple-auth';
import {
  getGoogleSignInErrorMessage,
  getPendingGoogleSignup,
  isGoogleSignInAvailable,
  setPendingGoogleSignup,
  signInWithGoogle,
} from '@/lib/auth/google-auth';
import { postAuthRoute } from '@/lib/auth/onboarding';
import { describeAxiosError, devLog, devWarn } from '@/lib/debug';
import { LinearGradient } from 'expo-linear-gradient';
import { ui, fontFamily } from '@/theme/tokens';
import { Screen, AppCard, PrimaryButton, FadeInUp, PressableScale, KeyboardAvoid } from '@/components/x4match';
import type { PlayerCategory, UserRole } from '@/lib/types';
import { pendingVerificationHref, verifyEmailHref } from '@/lib/auth/verification';

const LIME = '#D7FF00';
const MUTED = '#8E8E9F';
const CARD_BG = '#161616';
const FIELD_BORDER = 'rgba(255,255,255,0.14)';
const CLUB_BORDER_COLORS = ['#5B5B5B', '#FFFFFF', '#5B5B5B'] as const;
const CLUB_BORDER_LOCATIONS = [0, 0.5192, 1] as const;

const LOGO = require('../../assets/figma/shared/x4match-logo.png');
const ICON_PROFILE = require('../../assets/figma/shared/profile.png');
const ICON_CLUB = require('../../assets/figma/shared/edificio.png');
const TIRAS_SELECTED = require('../../assets/figma/profile/tiras.png');
const TIRAS_OFFSET = require('../../assets/figma/auth/tiras-offset.png');
const ICON_APPLE = require('../../assets/figma/auth/apple.png');
const ICON_GOOGLE = require('../../assets/figma/auth/google.png');
const ICON_DNI = require('../../assets/figma/auth/dni.png');
const ICON_EMAIL = require('../../assets/figma/auth/email.png');
const ICON_PASSWORD = require('../../assets/figma/auth/password.png');

type FejubaMatch = {
  fejubaId: string;
  fullName: string;
  category: PlayerCategory | null;
  rawCategory: string | null;
  genderHint: 'Masculino' | 'Femenino' | null;
};

function AuthField({
  label,
  icon,
  error,
  hint,
  secureTextEntry,
  editable = true,
  ...props
}: {
  label: string;
  icon: number;
  error?: string;
  hint?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences';
  editable?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={{ marginBottom: 18, width: '100%' }}>
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: error ? ui.colors.danger : FIELD_BORDER,
          borderRadius: 22,
          backgroundColor: '#121212',
          minHeight: 52,
          paddingHorizontal: 16,
          gap: 12,
          opacity: editable ? 1 : 0.7,
        }}
      >
        <Image source={icon} style={{ width: 18, height: 18 }} resizeMode="contain" />
        <TextInput
          {...props}
          editable={editable}
          placeholderTextColor={MUTED}
          secureTextEntry={isPassword && !showPassword}
          style={{
            flex: 1,
            fontSize: 15,
            lineHeight: 20,
            fontFamily: fontFamily.regular,
            color: '#FFFFFF',
            paddingVertical: 14,
            includeFontPadding: false,
            textAlignVertical: 'center',
          }}
        />
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={MUTED}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {hint && !error ? (
        <Text style={{ color: MUTED, fontSize: 12, marginTop: 6, fontFamily: fontFamily.regular }}>
          {hint}
        </Text>
      ) : null}
      {error ? (
        <Text style={{ color: ui.colors.danger, fontSize: 12, marginTop: 6 }}>{error}</Text>
      ) : null}
    </View>
  );
}

function RoleOptionCard({
  selected,
  title,
  description,
  icon,
  stripes,
  metallicBorder = false,
  onPress,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: number;
  stripes: number;
  metallicBorder?: boolean;
  onPress: () => void;
}) {
  const stripeWidth = 168;
  const stripeHeight = 112;
  const useMetallic = metallicBorder && !selected;

  const inner = (
    <View
      style={{
        backgroundColor: CARD_BG,
        borderRadius: useMetallic ? 19 : 20,
        overflow: 'hidden',
        minHeight: 108,
        position: 'relative',
        ...(useMetallic
          ? {}
          : {
              borderWidth: 1,
              borderColor: selected ? LIME : FIELD_BORDER,
            }),
      }}
    >
      <Image
        source={stripes}
        style={{
          position: 'absolute',
          right: -20,
          top: '50%',
          width: stripeWidth,
          height: stripeHeight,
          marginTop: -(stripeHeight / 2),
          opacity: selected ? 1 : 0.95,
        }}
        resizeMode="cover"
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingVertical: 18,
          gap: 14,
          minHeight: 108,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: selected ? 'rgba(215,255,0,0.12)' : 'rgba(255,255,255,0.06)',
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: selected ? LIME : FIELD_BORDER,
            borderWidth: 1,
          }}
        >
          <Image source={icon} style={{ width: 26, height: 34 }} resizeMode="contain" />
        </View>
        <View style={{ flex: 1, paddingRight: 40, justifyContent: 'center' }}>
          <Text
            style={{
              fontWeight: '700',
              fontSize: 17,
              lineHeight: 22,
              color: '#FFFFFF',
              fontFamily: fontFamily.regular,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: selected ? 'rgba(255,255,255,0.9)' : MUTED,
              marginTop: 4,
              lineHeight: 18,
              fontFamily: fontFamily.regular,
            }}
          >
            {description}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{ marginBottom: 12, borderRadius: 20 }}
    >
      {useMetallic ? (
        <LinearGradient
          colors={[...CLUB_BORDER_COLORS]}
          locations={[...CLUB_BORDER_LOCATIONS]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ borderRadius: 20, padding: 1 }}
        >
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </Pressable>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'role' | 'form'>('role');
  const [role, setRole] = useState<UserRole>('PLAYER');
  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleEnabled, setAppleEnabled] = useState(false);
  const [appleSignup, setAppleSignup] = useState(false);
  const [googleSignup, setGoogleSignup] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fejubaMatches, setFejubaMatches] = useState<FejubaMatch[]>([]);
  const [showMatchPicker, setShowMatchPicker] = useState(false);

  const normalizedDni = useMemo(() => dni.replace(/\D/g, ''), [dni]);
  const showApple = isApplePlatform() && appleEnabled;
  const googleEnabled = isGoogleSignInAvailable();
  const socialSignup = appleSignup || googleSignup;
  const socialBusy = loading || appleLoading || googleLoading;

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleEnabled);
    const pendingApple = getPendingAppleSignup();
    if (pendingApple) {
      setAppleSignup(true);
      if (pendingApple.email) setEmail(pendingApple.email);
      if (pendingApple.fullName) setName(pendingApple.fullName);
      return;
    }
    const pendingGoogle = getPendingGoogleSignup();
    if (!pendingGoogle) return;
    setGoogleSignup(true);
    if (pendingGoogle.email) setEmail(pendingGoogle.email);
    if (pendingGoogle.fullName) setName(pendingGoogle.fullName);
  }, []);

  const validate = () => {
    const next: Record<string, string> = {};
    if (role === 'CLUB_ADMIN' && !name.trim()) next.name = 'El nombre es requerido';
    if (role === 'PLAYER') {
      if (!/^\d{7,8}$/.test(normalizedDni)) next.dni = 'Ingresá un DNI válido (7 u 8 dígitos)';
    }
    if (!email) next.email = 'El email es requerido';
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = 'Email inválido';
    if (!socialSignup) {
      if (!password || password.length < 6) next.password = 'Mínimo 6 caracteres';
      if (password !== confirmPassword) next.confirmPassword = 'Las contraseñas no coinciden';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const registerAccount = async (match: FejubaMatch | null) => {
    setLoading(true);
    devLog('register', 'POST /auth/register', {
      role,
      email: email.trim(),
      dni: role === 'PLAYER' ? normalizedDni : undefined,
      fejubaId: match?.fejubaId ?? null,
      provider: appleSignup ? 'apple' : googleSignup ? 'google' : 'password',
    });
    try {
      const pendingApple = appleSignup ? getPendingAppleSignup() : null;
      const pendingGoogle = googleSignup ? getPendingGoogleSignup() : null;
      if (appleSignup && !pendingApple?.identityToken) {
        Alert.alert('Error', 'Se perdió la sesión de Apple. Volvé a tocar Continuar con Apple.');
        return;
      }
      if (googleSignup && !pendingGoogle?.idToken) {
        Alert.alert('Error', 'Se perdió la sesión de Google. Volvé a tocar Continuar con Google.');
        return;
      }
      const response = await api.post('/auth/register', {
        email: email.trim(),
        ...(pendingApple?.identityToken
          ? { identityToken: pendingApple.identityToken }
          : pendingGoogle?.idToken
            ? { idToken: pendingGoogle.idToken, photo: pendingGoogle.photo }
            : { password }),
        role,
        name:
          role === 'CLUB_ADMIN'
            ? name.trim() || pendingApple?.fullName || pendingGoogle?.fullName
            : match?.fullName ||
            pendingApple?.fullName ||
            pendingGoogle?.fullName ||
            undefined,
        dni: role === 'PLAYER' ? normalizedDni : undefined,
        declaredCategory: role === 'PLAYER' ? match?.category || undefined : undefined,
        gender: role === 'PLAYER' ? match?.genderHint || undefined : undefined,
        fejubaId: match?.fejubaId,
        fejubaCategory: match?.rawCategory || match?.category || undefined,
      });
      devLog('register', 'cuenta creada', { userId: response.data?.user?.id });
      setPendingAppleSignup(null);
      setPendingGoogleSignup(null);
      if (response.data?.emailVerificationRequired) {
        router.replace(
          verifyEmailHref({
            email: response.data.email ?? email.trim(),
            devCode: response.data.devCode,
            from: 'register',
          }) as any,
        );
        return;
      }
      if (response.data?.pendingVerification) {
        router.replace(
          pendingVerificationHref('pending', response.data.user?.email ?? email.trim()) as any,
        );
        return;
      }
      await login(response.data.access_token, {
        ...response.data.user,
        fejubaFound: Boolean(match),
      });
      router.replace(
        role === 'CLUB_ADMIN' ? '/(tabs)/home' : '/onboarding',
      );
    } catch (error: any) {
      const message = describeAxiosError(error);
      devWarn('register', 'falló POST /auth/register', message);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    if (role === 'CLUB_ADMIN') {
      await registerAccount(null);
      return;
    }

    setLoading(true);
    devLog('register', 'GET /auth/fejuba-lookup', { dni: normalizedDni });
    try {
      const lookup = await api.get('/auth/fejuba-lookup', {
        params: { dni: normalizedDni },
      });
      const matches: FejubaMatch[] = Array.isArray(lookup.data?.matches)
        ? lookup.data.matches
        : [];
      devLog('register', 'fejuba-lookup ok', { count: matches.length });

      if (matches.length === 0) {
        await registerAccount(null);
        return;
      }

      if (matches.length === 1) {
        await registerAccount(matches[0]);
        return;
      }

      setFejubaMatches(matches);
      setShowMatchPicker(true);
      setLoading(false);
    } catch (error: any) {
      // Si el lookup falla, seguimos con registro manual en onboarding.
      devWarn('register', 'fejuba-lookup falló, sigo con registro', {
        message: error?.message,
        code: error?.code,
      });
      await registerAccount(null);
    }
  };

  const confirmMatch = async (match: FejubaMatch) => {
    setShowMatchPicker(false);
    await registerAccount(match);
  };

  const handleApple = async () => {
    if (!isApplePlatform()) return;
    setAppleLoading(true);
    try {
      const { identityToken, fullName } = await signInWithApple();
      const response = await api.post('/auth/apple', { identityToken, fullName });
      if (response.data?.needsRegistration) {
        setPendingAppleSignup({
          identityToken,
          email: response.data.email,
          fullName: response.data.fullName || fullName,
        });
        setPendingGoogleSignup(null);
        setGoogleSignup(false);
        setAppleSignup(true);
        setEmail(response.data.email || '');
        if (response.data.fullName || fullName) {
          setName(response.data.fullName || fullName || '');
        }
        setStep('form');
        return;
      }
      await login(response.data.access_token, response.data.user);
      router.replace(postAuthRoute(response.data.user) as any);
    } catch (error: any) {
      const apiMessage = error.response?.data?.message;
      const message =
        typeof apiMessage === 'string' ? apiMessage : getAppleSignInErrorMessage(error);
      if (message !== 'Inicio de sesión cancelado') {
        Alert.alert('Error', message);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!googleEnabled) return;
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const response = await api.post('/auth/google', { idToken });
      if (response.data?.needsRegistration) {
        setPendingGoogleSignup({
          idToken,
          email: response.data.email,
          fullName: response.data.fullName,
          photo: response.data.photo,
        });
        setPendingAppleSignup(null);
        setAppleSignup(false);
        setGoogleSignup(true);
        setEmail(response.data.email || '');
        if (response.data.fullName) setName(response.data.fullName);
        setStep('form');
        return;
      }
      await login(response.data.access_token, response.data.user);
      router.replace(postAuthRoute(response.data.user) as any);
    } catch (error: any) {
      const apiMessage = error.response?.data?.message;
      const message =
        typeof apiMessage === 'string' ? apiMessage : getGoogleSignInErrorMessage(error);
      if (message !== 'Inicio de sesión cancelado') {
        Alert.alert('Error', message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  if (step === 'role') {
    return (
      <Screen>
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 24) + 16,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FadeInUp index={0}>
              <View style={{ alignItems: 'center', marginBottom: 28 }}>
                <Image
                  source={LOGO}
                  accessibilityLabel="x4 match"
                  style={{ width: 132, height: 132 }}
                  resizeMode="contain"
                />
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 28,
                    fontWeight: '700',
                    color: '#FFFFFF',
                    fontFamily: fontFamily.regular,
                    textAlign: 'center',
                  }}
                >
                  Crear cuenta
                </Text>
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    color: '#fff',
                    fontFamily: fontFamily.regular,
                    textAlign: 'center',
                  }}
                >
                  Elegí cómo querés usar x4 match
                </Text>
              </View>
            </FadeInUp>

            <FadeInUp index={1}>
              <RoleOptionCard
                selected={role === 'PLAYER'}
                title="Jugador"
                description="Buscá partidos, organizá torneos, circuitos y competí en la comunidad"
                icon={ICON_PROFILE}
                stripes={TIRAS_SELECTED}
                onPress={() => setRole('PLAYER')}
              />
              <RoleOptionCard
                selected={role === 'CLUB_ADMIN'}
                title="Club"
                description="Publicá horarios libres de canchas y gestioná tu sede."
                icon={ICON_CLUB}
                stripes={TIRAS_OFFSET}
                metallicBorder
                onPress={() => setRole('CLUB_ADMIN')}
              />

              <PressableScale
                onPress={() => setStep('form')}
                disabled={socialBusy}
                accessibilityRole="button"
                accessibilityLabel="Continuar"
                style={{
                  marginTop: 16,
                  backgroundColor: LIME,
                  borderRadius: 999,
                  minHeight: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: socialBusy ? 0.7 : 1,
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
                  Continuar
                </Text>
              </PressableScale>

              {showApple || googleEnabled ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginVertical: 22,
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        borderWidth: 1.5,
                        borderColor: 'rgba(255,255,255,0.22)',
                      }}
                    />
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                  </View>

                  <View style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
                    {showApple ? (
                      <Pressable
                        onPress={() => void handleApple()}
                        disabled={socialBusy}
                        accessibilityRole="button"
                        accessibilityLabel="Registrarse con Apple"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          minHeight: 48,
                          borderRadius: 22,
                          backgroundColor: '#FFFFFF',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          paddingHorizontal: 10,
                          opacity: socialBusy ? 0.7 : 1,
                        }}
                      >
                        {appleLoading ? (
                          <ActivityIndicator color="#000" />
                        ) : (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              maxWidth: '100%',
                            }}
                          >
                            <Image
                              source={ICON_APPLE}
                              style={{ width: 16, height: 16 }}
                              resizeMode="contain"
                            />
                            <Text
                              style={{
                                color: '#000000',
                                fontSize: 12,
                                lineHeight: 16,
                                fontWeight: '600',
                                fontFamily: fontFamily.regular,
                                flexShrink: 1,
                                includeFontPadding: false,
                                textAlignVertical: 'center',
                              }}
                              numberOfLines={1}
                            >
                              Registrarse con Apple
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    ) : null}

                    {googleEnabled ? (
                      <Pressable
                        onPress={() => void handleGoogle()}
                        disabled={socialBusy}
                        accessibilityRole="button"
                        accessibilityLabel="Continuar con Google"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          minHeight: 48,
                          borderRadius: 22,
                          borderWidth: 1,
                          borderColor: FIELD_BORDER,
                          backgroundColor: '#111111',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          paddingHorizontal: 10,
                          opacity: socialBusy ? 0.7 : 1,
                        }}
                      >
                        {googleLoading ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              maxWidth: '100%',
                            }}
                          >
                            <Image
                              source={ICON_GOOGLE}
                              style={{ width: 18, height: 18 }}
                              resizeMode="contain"
                            />
                            <Text
                              style={{
                                color: '#FFFFFF',
                                fontSize: 12,
                                lineHeight: 16,
                                fontWeight: '600',
                                fontFamily: fontFamily.regular,
                                flexShrink: 1,
                                includeFontPadding: false,
                                textAlignVertical: 'center',
                              }}
                              numberOfLines={1}
                            >
                              Continuar con Google
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                </>
              ) : null}
            </FadeInUp>

            <FadeInUp index={2}>
              <PressableScale
                onPress={() => router.push('/(auth)/login')}
                accessibilityRole="link"
                accessibilityLabel="Iniciá sesión"
                style={{ marginTop: 24, minHeight: 44, justifyContent: 'center' }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    color: MUTED,
                    fontFamily: fontFamily.regular,
                    fontSize: 14,
                  }}
                >
                  ¿Ya tenés cuenta?{' '}
                  <Text style={{ color: LIME, fontWeight: '700' }}>Iniciá sesión</Text>
                </Text>
              </PressableScale>
            </FadeInUp>
          </ScrollView>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <KeyboardAvoid style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: Math.max(insets.top, 12) + 8,
            paddingBottom: Math.max(insets.bottom, 24) + 8,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => setStep('role')}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ alignSelf: 'flex-start', marginBottom: 12, minHeight: 36, justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: '#FFFFFF',
              fontFamily: fontFamily.regular,
              marginBottom: 8,
            }}
          >
            {role === 'PLAYER' ? 'Creá tu cuenta' : 'Datos del club'}
          </Text>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 14,
              lineHeight: 20,
              fontFamily: fontFamily.regular,
              marginBottom: 28,
            }}
          >
            {socialSignup
              ? role === 'PLAYER'
                ? `Entrás con ${appleSignup ? 'Apple' : 'Google'}. Completá tu DNI para buscar tu categoría federada.`
                : `Entrás con ${appleSignup ? 'Apple' : 'Google'}. Completá los datos del club para continuar.`
              : role === 'PLAYER'
                ? 'Con tu DNI buscamos tu categoría federada si estás registrado'
                : 'Completá tus datos para continuar'}
          </Text>

          {role === 'CLUB_ADMIN' ? (
            <AuthField
              label="Nombre del club / responsable"
              icon={ICON_PROFILE}
              value={name}
              onChangeText={setName}
              error={errors.name}
              placeholder="Nombre del club"
            />
          ) : (
            <AuthField
              label="DNI"
              icon={ICON_DNI}
              value={dni}
              onChangeText={(value) => setDni(value.replace(/[^\d]/g, '').slice(0, 8))}
              error={errors.dni}
              keyboardType="number-pad"
              placeholder=""
            />
          )}

          <AuthField
            label="Email"
            icon={ICON_EMAIL}
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            hint={
              socialSignup
                ? `Lo provee ${appleSignup ? 'Apple' : 'Google'}. No hace falta contraseña.`
                : undefined
            }
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!socialSignup}
            placeholder=""
          />

          {socialSignup ? null : (
            <>
              <AuthField
                label="Contraseña"
                icon={ICON_PASSWORD}
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                secureTextEntry
                autoCapitalize="none"
                placeholder=""
              />
              <AuthField
                label="Confirmar contraseña"
                icon={ICON_PASSWORD}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={errors.confirmPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder=""
              />
            </>
          )}

          <PressableScale
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={role === 'PLAYER' ? 'Continuar' : 'Crear cuenta'}
            style={{
              marginTop: 50,
              backgroundColor: LIME,
              borderRadius: 999,
              minHeight: 54,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text
                style={{
                  color: '#000000',
                  fontSize: 16,
                  fontWeight: '700',
                  fontFamily: fontFamily.regular,
                }}
              >
                {role === 'PLAYER' ? 'Continuar' : 'Crear cuenta'}
              </Text>
            )}
          </PressableScale>
        </ScrollView>
        </KeyboardAvoid>
      </View>

      <Modal visible={showMatchPicker} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          onPress={() => setShowMatchPicker(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: ui.colors.bgElevated,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: ui.spacing.lg,
              maxHeight: '70%',
            }}
          >
            <Text style={[ui.typography.h2, { color: ui.colors.textPrimary, marginBottom: 8 }]}>
              Elegí tu perfil
            </Text>
            <Text style={{ color: ui.colors.textSecondary, marginBottom: 16 }}>
              Encontramos más de un jugador con ese DNI.
            </Text>
            <ScrollView>
              {fejubaMatches.map((match) => (
                <AppCard
                  key={match.fejubaId}
                  onPress={() => confirmMatch(match)}
                  style={{ marginBottom: 10 }}
                >
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    {match.fullName}
                  </Text>
                  <Text style={{ color: ui.colors.textSecondary, marginTop: 4 }}>
                    {match.rawCategory || match.category || 'Sin categoría'}
                  </Text>
                </AppCard>
              ))}
            </ScrollView>
            <PrimaryButton
              label="Ninguno / continuar a mano"
              variant="ghost"
              onPress={() => {
                setShowMatchPicker(false);
                void registerAccount(null);
              }}
              fullWidth
              style={{ marginTop: 8 }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
