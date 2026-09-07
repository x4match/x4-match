import { useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { api } from '@/lib/api';
import {
  GoogleSignInCancelledError,
  getGoogleIdToken,
  googleSignInUserMessage,
} from '@/lib/google-auth';
import { ui } from '@/theme/tokens';
import { Screen, InputField, PrimaryButton, FadeInUp, PressableScale } from '@/components/padely';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { login } = useAuth();
  const router = useRouter();

  const validate = () => {
    const next: typeof errors = {};
    if (!email) next.email = 'El email es requerido';
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = 'Email inválido';
    if (!password) next.password = 'La contraseña es requerida';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      await login(response.data.access_token, response.data.user);
      const role = response.data.user?.role;
      router.replace(isClub(role) ? '/(tabs)/gerente' : '/(tabs)/home');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Error al iniciar sesión';
      Alert.alert('Error', typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const idToken = await getGoogleIdToken();
      const response = await api.post('/auth/google', { idToken });
      await login(response.data.access_token, response.data.user);
      const role = response.data.user?.role;
      router.replace(
        response.data.isNewUser
          ? '/onboarding'
          : isClub(role)
            ? '/(tabs)/gerente'
            : '/(tabs)/home',
      );
    } catch (error: unknown) {
      if (error instanceof GoogleSignInCancelledError) return;
      const apiMessage = (error as { response?: { data?: { message?: unknown } } })?.response
        ?.data?.message;
      const message =
        typeof apiMessage === 'string'
          ? apiMessage
          : googleSignInUserMessage(error);
      if (message) Alert.alert('Error', message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Screen>
      <LinearGradient colors={[ui.colors.bg, ui.colors.bgElevated, ui.colors.surface0]} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              paddingHorizontal: ui.spacing.lg,
              paddingVertical: 48,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <FadeInUp index={0}>
              <View style={{ alignItems: 'center', marginBottom: 40 }}>
                <LinearGradient
                  colors={[ui.colors.primary, ui.colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 28,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    ...ui.shadow.glow,
                  }}
                >
                  <Ionicons name="tennisball" size={42} color={ui.colors.bgElevated} />
                </LinearGradient>
                <Text style={[ui.typography.display, { color: ui.colors.textPrimary }]}>x4 match</Text>
                <Text style={[ui.typography.bodySm, { color: ui.colors.textSecondary, marginTop: 6 }]}>
                  Tu rendimiento de pádel, vivo
                </Text>
              </View>
            </FadeInUp>

            <FadeInUp index={1}>
              <InputField
                label="Email"
                placeholder="tu@email.com"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Ionicons name="mail-outline" size={20} color={ui.colors.textMuted} />}
              />
              <InputField
                label="Contraseña"
                placeholder="Tu contraseña"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                secureTextEntry
                leftIcon={<Ionicons name="lock-closed-outline" size={20} color={ui.colors.textMuted} />}
              />
              <PressableScale
                onPress={() => router.push('/(auth)/forgot-password')}
                accessibilityRole="link"
                accessibilityLabel="Olvidé mi contraseña"
                style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: 16, minHeight: 36, justifyContent: 'center' }}
              >
                <Text
                  style={{
                    color: ui.colors.primary,
                    fontFamily: ui.typography.label.fontFamily,
                    fontSize: 14,
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </Text>
              </PressableScale>
              <PrimaryButton
                label="Iniciar sesión"
                onPress={handleLogin}
                loading={loading}
                disabled={googleLoading}
                fullWidth
                size="lg"
              />
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
              <PrimaryButton
                label="Continuar con Google"
                onPress={handleGoogleLogin}
                loading={googleLoading}
                disabled={loading}
                fullWidth
                size="lg"
                variant="dark"
                icon={
                  <Text style={{ color: '#4285F4', fontSize: 18, fontWeight: '800' }}>G</Text>
                }
              />
            </FadeInUp>

            <FadeInUp index={2}>
              <PressableScale
                onPress={() => router.push('/(auth)/register')}
                accessibilityRole="link"
                accessibilityLabel="Registrate, crear cuenta"
                style={{ marginTop: 28, minHeight: 44, justifyContent: 'center' }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    color: ui.colors.textMuted,
                    fontFamily: ui.typography.body.fontFamily,
                  }}
                >
                  ¿No tenés cuenta?{' '}
                  <Text style={{ color: ui.colors.primary, fontFamily: ui.typography.label.fontFamily }}>
                    Registrate
                  </Text>
                </Text>
              </PressableScale>
            </FadeInUp>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Screen>
  );
}
