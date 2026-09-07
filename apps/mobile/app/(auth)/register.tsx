import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import {
  getAppleSignInErrorMessage,
  getPendingAppleSignup,
  isApplePlatform,
  isAppleSignInAvailable,
  setPendingAppleSignup,
  signInWithApple,
} from '@/lib/apple-auth';
import { isClub } from '@/lib/roles';
import { describeAxiosError, devLog, devWarn } from '@/lib/debug';
import { ui } from '@/theme/tokens';
import { Screen, AppCard, InputField, PrimaryButton, FadeInUp, PressableScale } from '@/components/padely';
import type { PlayerCategory, UserRole } from '@/lib/types';

type FejubaMatch = {
  fejubaId: string;
  fullName: string;
  category: PlayerCategory | null;
  rawCategory: string | null;
  genderHint: 'Masculino' | 'Femenino' | null;
};

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState<'role' | 'form'>('role');
  const [role, setRole] = useState<UserRole>('PLAYER');
  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleEnabled, setAppleEnabled] = useState(false);
  const [appleSignup, setAppleSignup] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fejubaMatches, setFejubaMatches] = useState<FejubaMatch[]>([]);
  const [showMatchPicker, setShowMatchPicker] = useState(false);

  const normalizedDni = useMemo(() => dni.replace(/\D/g, ''), [dni]);
  const showApple = isApplePlatform() && appleEnabled;

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleEnabled);
    const pending = getPendingAppleSignup();
    if (!pending) return;
    setAppleSignup(true);
    if (pending.email) setEmail(pending.email);
    if (pending.fullName) setName(pending.fullName);
  }, []);

  const validate = () => {
    const next: Record<string, string> = {};
    if (role === 'CLUB_ADMIN' && !name.trim()) next.name = 'El nombre es requerido';
    if (role === 'PLAYER') {
      if (!/^\d{7,8}$/.test(normalizedDni)) next.dni = 'Ingresá un DNI válido (7 u 8 dígitos)';
    }
    if (!email) next.email = 'El email es requerido';
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = 'Email inválido';
    if (!appleSignup) {
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
    });
    try {
      const pending = appleSignup ? getPendingAppleSignup() : null;
      if (appleSignup && !pending?.identityToken) {
        Alert.alert('Error', 'Se perdió la sesión de Apple. Volvé a tocar Continuar con Apple.');
        return;
      }
      const response = await api.post('/auth/register', {
        email: email.trim(),
        ...(pending?.identityToken
          ? { identityToken: pending.identityToken }
          : { password }),
        role,
        name:
          role === 'CLUB_ADMIN'
            ? name.trim() || pending?.fullName
            : match?.fullName || pending?.fullName || undefined,
        dni: role === 'PLAYER' ? normalizedDni : undefined,
        declaredCategory: role === 'PLAYER' ? match?.category || undefined : undefined,
        gender: role === 'PLAYER' ? match?.genderHint || undefined : undefined,
        fejubaId: match?.fejubaId,
        fejubaCategory: match?.rawCategory || match?.category || undefined,
      });
      devLog('register', 'cuenta creada', { userId: response.data?.user?.id });
      setPendingAppleSignup(null);
      await login(response.data.access_token, {
        ...response.data.user,
        fejubaFound: Boolean(match),
      });
      router.replace(
        role === 'CLUB_ADMIN' ? '/(tabs)/profile' : '/onboarding',
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
        setAppleSignup(true);
        setEmail(response.data.email || '');
        if (response.data.fullName || fullName) {
          setName(response.data.fullName || fullName || '');
        }
        setStep('form');
        return;
      }
      await login(response.data.access_token, response.data.user);
      const nextRole = response.data.user?.role;
      router.replace(isClub(nextRole) ? '/(tabs)/gerente' : '/(tabs)/home');
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

  if (step === 'role') {
    return (
      <Screen>
        <LinearGradient colors={[ui.colors.bg, ui.colors.bgElevated]} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: ui.spacing.lg }}>
            <FadeInUp index={0}>
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                <Image
                  source={require('../../assets/x4match.png')}
                  accessibilityLabel="x4 match"
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 24,
                    marginBottom: 16,
                  }}
                />
                <Text style={[ui.typography.h1, { color: ui.colors.textPrimary }]}>Crear cuenta</Text>
                <Text style={[ui.typography.bodySm, { color: ui.colors.textSecondary, marginTop: 4 }]}>
                  Elegí cómo querés usar x4 match
                </Text>
              </View>
            </FadeInUp>

            <AppCard
              onPress={() => setRole('PLAYER')}
              style={{
                borderWidth: 2,
                borderColor: role === 'PLAYER' ? ui.colors.primary : 'transparent',
              }}
            >
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: 'rgba(20,184,166,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="person" size={24} color={ui.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary }}>
                    Jugador
                  </Text>
                  <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 4 }}>
                    Buscá partidos, organizá torneos y circuitos, y competí en la comunidad.
                  </Text>
                </View>
                <Ionicons
                  name={role === 'PLAYER' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={role === 'PLAYER' ? ui.colors.primary : ui.colors.textMuted}
                />
              </View>
            </AppCard>

            <AppCard
              onPress={() => setRole('CLUB_ADMIN')}
              style={{
                borderWidth: 2,
                borderColor: role === 'CLUB_ADMIN' ? ui.colors.primary : 'transparent',
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: 'rgba(245,158,11,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="business" size={24} color={ui.colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary }}>
                    Club
                  </Text>
                  <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 4 }}>
                    Publicá horarios libres de canchas y gestioná tu sede.
                  </Text>
                </View>
                <Ionicons
                  name={role === 'CLUB_ADMIN' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={role === 'CLUB_ADMIN' ? ui.colors.primary : ui.colors.textMuted}
                />
              </View>
            </AppCard>

            <View style={{ marginTop: 24 }}>
              <PrimaryButton
                label="Continuar"
                onPress={() => setStep('form')}
                disabled={appleLoading}
                fullWidth
                size="lg"
              />
            </View>

            {showApple ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginTop: 20,
                    marginBottom: 16,
                  }}
                >
                  <View style={{ flex: 1, height: 1, backgroundColor: ui.colors.border }} />
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>o</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: ui.colors.border }} />
                </View>
                <AppleSignInButton
                  variant="sign-up"
                  loading={appleLoading}
                  disabled={appleLoading}
                  onPress={() => void handleApple()}
                />
              </>
            ) : null}

            <PressableScale
              onPress={() => router.push('/(auth)/login')}
              accessibilityRole="link"
              accessibilityLabel="Iniciá sesión"
              style={{ marginTop: 20, minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ textAlign: 'center', color: ui.colors.textMuted }}>
                ¿Ya tenés cuenta?{' '}
                <Text style={{ color: ui.colors.primary, fontFamily: ui.typography.label.fontFamily }}>
                  Iniciá sesión
                </Text>
              </Text>
            </PressableScale>
          </ScrollView>
        </LinearGradient>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity onPress={() => setStep('role')} style={{ padding: 16, paddingTop: 48 }}>
          <Ionicons name="chevron-back" size={26} color={ui.colors.textPrimary} />
        </TouchableOpacity>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: ui.spacing.lg,
            paddingTop: 8,
            paddingBottom: ui.spacing.xxxl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[ui.typography.h1, { color: ui.colors.textPrimary, marginBottom: 4 }]}>
            {role === 'PLAYER' ? 'Creá tu cuenta' : 'Datos del club'}
          </Text>
          <Text style={{ color: ui.colors.textSecondary, marginBottom: 24 }}>
            {appleSignup
              ? role === 'PLAYER'
                ? 'Entrás con Apple. Completá tu DNI para buscar tu categoría federada.'
                : 'Entrás con Apple. Completá los datos del club para continuar.'
              : role === 'PLAYER'
                ? 'Con tu DNI buscamos tu categoría federada si estás registrado.'
                : 'Completá tus datos para continuar'}
          </Text>

          {role === 'CLUB_ADMIN' ? (
            <InputField
              label="Nombre del club / responsable"
              value={name}
              onChangeText={setName}
              error={errors.name}
              leftIcon={<Ionicons name="person-outline" size={20} color={ui.colors.textMuted} />}
            />
          ) : (
            <InputField
              label="DNI"
              value={dni}
              onChangeText={(value) => setDni(value.replace(/[^\d]/g, '').slice(0, 8))}
              error={errors.dni}
              keyboardType="number-pad"
              placeholder="Ej. 30123456"
              leftIcon={<Ionicons name="card-outline" size={20} color={ui.colors.textMuted} />}
            />
          )}

          <InputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            hint={appleSignup ? 'Lo provee Apple. No hace falta contraseña.' : undefined}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!appleSignup}
            leftIcon={<Ionicons name="mail-outline" size={20} color={ui.colors.textMuted} />}
          />
          {appleSignup ? null : (
            <>
              <InputField
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                secureTextEntry
                leftIcon={<Ionicons name="lock-closed-outline" size={20} color={ui.colors.textMuted} />}
              />
              <InputField
                label="Confirmar contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={errors.confirmPassword}
                secureTextEntry
                leftIcon={<Ionicons name="lock-closed-outline" size={20} color={ui.colors.textMuted} />}
              />
            </>
          )}

          <PrimaryButton
            label={role === 'PLAYER' ? 'Continuar' : 'Crear cuenta'}
            onPress={handleSubmit}
            loading={loading}
            fullWidth
            size="lg"
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

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
