import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { api } from '@/lib/api';
import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import {
  getAppleSignInErrorMessage,
  isApplePlatform,
  isAppleSignInAvailable,
  setPendingAppleSignup,
  signInWithApple,
} from '@/lib/apple-auth';
import {
  getGoogleSignInErrorMessage,
  isGoogleSignInAvailable,
  signInWithGoogle,
} from '@/lib/google-auth';
import { ui } from '@/theme/tokens';
import { Screen, InputField, PrimaryButton, FadeInUp, PressableScale } from '@/components/padely';

async function navigateAfterAuth(go: () => void) {
  // Espera a que se cierre el overlay de Google / teclado antes de montar tabs.
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  go();
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleEnabled, setAppleEnabled] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { login } = useAuth();
  const router = useRouter();
  const googleEnabled = isGoogleSignInAvailable();
  const socialBusy = loading || googleLoading || appleLoading;
  const showApple = isApplePlatform() && appleEnabled;
  const showSocial = googleEnabled || showApple;

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleEnabled);
  }, []);

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
      await navigateAfterAuth(() => {
        router.replace(isClub(role) ? '/(tabs)/gerente' : '/(tabs)/home');
      });
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
      const idToken = await signInWithGoogle();
      const response = await api.post('/auth/google', { idToken });
      await login(response.data.access_token, response.data.user);
      const role = response.data.user?.role;
      if (response.data.isNewUser && !isClub(role)) {
        await navigateAfterAuth(() => router.replace('/onboarding'));
        return;
      }
      await navigateAfterAuth(() => {
        router.replace(isClub(role) ? '/(tabs)/gerente' : '/(tabs)/home');
      });
    } catch (error: any) {
      const apiMessage = error.response?.data?.message;
      const message =
        typeof apiMessage === 'string'
          ? apiMessage
          : getGoogleSignInErrorMessage(error);
      if (message !== 'Inicio de sesión cancelado') {
        Alert.alert('Error', message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleLogin = async () => {
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
        await navigateAfterAuth(() => router.push('/(auth)/register'));
        return;
      }
      await login(response.data.access_token, response.data.user);
      const role = response.data.user?.role;
      await navigateAfterAuth(() => {
        router.replace(isClub(role) ? '/(tabs)/gerente' : '/(tabs)/home');
      });
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
                <Image
                  source={require('../../assets/x4match.png')}
                  accessibilityLabel="x4 match"
                  style={{
                    width: 132,
                    height: 132,
                    borderRadius: 32,
                    marginBottom: 20,
                  }}
                />
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
                disabled={socialBusy}
                fullWidth
                size="lg"
              />

              {showSocial ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      marginVertical: 20,
                    }}
                  >
                    <View style={{ flex: 1, height: 1, backgroundColor: ui.colors.border }} />
                    <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>o</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: ui.colors.border }} />
                  </View>

                  {showApple ? (
                    <AppleSignInButton
                      loading={appleLoading}
                      disabled={socialBusy}
                      onPress={() => void handleAppleLogin()}
                      style={{ marginBottom: googleEnabled ? 12 : 0 }}
                    />
                  ) : null}

                  {googleEnabled ? (
                    <PressableScale
                      onPress={handleGoogleLogin}
                      disabled={socialBusy}
                      accessibilityRole="button"
                      accessibilityLabel="Continuar con Google"
                      style={{
                        minHeight: 52,
                        borderRadius: ui.radius.lg,
                        borderWidth: 1,
                        borderColor: ui.colors.border,
                        backgroundColor: ui.colors.surface0,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        opacity: socialBusy ? 0.7 : 1,
                      }}
                    >
                      {googleLoading ? (
                        <ActivityIndicator color={ui.colors.textPrimary} />
                      ) : (
                        <>
                          <Ionicons name="logo-google" size={20} color={ui.colors.textPrimary} />
                          <Text
                            style={{
                              color: ui.colors.textPrimary,
                              fontFamily: ui.typography.label.fontFamily,
                              fontSize: 16,
                            }}
                          >
                            Continuar con Google
                          </Text>
                        </>
                      )}
                    </PressableScale>
                  ) : null}
                </>
              ) : null}
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
