import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  InteractionManager,
  TextInput,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { postAuthRoute } from '@/lib/auth/onboarding';
import { api } from '@/lib/api';
import {
  getAppleSignInErrorMessage,
  isApplePlatform,
  isAppleSignInAvailable,
  setPendingAppleSignup,
  signInWithApple,
} from '@/lib/auth/apple-auth';
import {
  getGoogleSignInErrorMessage,
  isGoogleSignInAvailable,
  setPendingGoogleSignup,
  signInWithGoogle,
} from '@/lib/auth/google-auth';
import { ui, fontFamily } from '@/theme/tokens';
import { Screen, FadeInUp, PressableScale } from '@/components/x4match';
import {
  getAccountVerificationState,
  getEmailNotVerified,
  pendingVerificationHref,
  verifyEmailHref,
} from '@/lib/auth/verification';

const LIME = '#D7FF00';
const MUTED = '#8E8E9F';
const FIELD_BORDER = 'rgba(255,255,255,0.14)';

const LOGO = require('../../assets/figma/shared/x4match-logo.png');
const ICON_EMAIL = require('../../assets/figma/auth/email.png');
const ICON_PASSWORD = require('../../assets/figma/auth/password.png');
const ICON_GOOGLE = require('../../assets/figma/auth/google.png');
const ICON_APPLE = require('../../assets/figma/auth/apple.png');

async function navigateAfterAuth(go: () => void) {
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  go();
}

function AuthField({
  label,
  icon,
  error,
  secureTextEntry,
  ...props
}: {
  label: string;
  icon: number;
  error?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'sentences';
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={{ marginBottom: 16, width: '100%' }}>
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
          borderRadius: 16,
          backgroundColor: '#0A0A0A',
          minHeight: 52,
          paddingHorizontal: 14,
          gap: 10,
        }}
      >
        <Image source={icon} style={{ width: 14, height: 14 }} resizeMode="contain" />
        <TextInput
          {...props}
          placeholderTextColor={MUTED}
          secureTextEntry={isPassword && !showPassword}
          style={{
            flex: 1,
            fontSize: 15,
            fontFamily: fontFamily.regular,
            color: '#FFFFFF',
            paddingVertical: 14,
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
      {error ? (
        <Text style={{ color: ui.colors.danger, fontSize: 12, marginTop: 6 }}>{error}</Text>
      ) : null}
    </View>
  );
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
  const insets = useSafeAreaInsets();
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
      await navigateAfterAuth(() => {
        router.replace(postAuthRoute(response.data.user) as any);
      });
    } catch (error: any) {
      const unverifiedEmail = getEmailNotVerified(error);
      if (unverifiedEmail) {
        router.push(
          verifyEmailHref({
            email: unverifiedEmail.email ?? email.trim(),
            devCode: unverifiedEmail.devCode,
            from: 'login',
          }) as any,
        );
        return;
      }
      const verification = getAccountVerificationState(error);
      if (verification) {
        router.push(pendingVerificationHref(verification, email.trim()) as any);
        return;
      }
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
      if (response.data?.needsRegistration) {
        setPendingGoogleSignup({
          idToken,
          email: response.data.email,
          fullName: response.data.fullName,
          photo: response.data.photo,
        });
        await navigateAfterAuth(() => router.push('/(auth)/register'));
        return;
      }
      await login(response.data.access_token, response.data.user);
      await navigateAfterAuth(() => {
        router.replace(postAuthRoute(response.data.user) as any);
      });
    } catch (error: any) {
      const verification = getAccountVerificationState(error);
      if (verification) {
        await navigateAfterAuth(() => router.push(pendingVerificationHref(verification) as any));
        return;
      }
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
      await navigateAfterAuth(() => {
        router.replace(postAuthRoute(response.data.user) as any);
      });
    } catch (error: any) {
      const verification = getAccountVerificationState(error);
      if (verification) {
        await navigateAfterAuth(() => router.push(pendingVerificationHref(verification) as any));
        return;
      }
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
              <View style={{ alignItems: 'center', marginBottom: 36 }}>
                <Image
                  source={LOGO}
                  accessibilityLabel="x4 match"
                  style={{ width: 148, height: 148 }}
                  resizeMode="contain"
                />
                <Text
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    letterSpacing: 1.4,
                    fontFamily: fontFamily.regular,
                    fontWeight: '600',
                    color: '#FFFFFF',
                    textAlign: 'center',
                  }}
                >
                  JUGÁ. COMPETÍ. SUBÍ DE NIVEL
                </Text>
              </View>
            </FadeInUp>

            <FadeInUp index={1}>
              <AuthField
                label="Email"
                icon={ICON_EMAIL}
                placeholder="Ingresá tu email"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <AuthField
                label="Contraseña"
                icon={ICON_PASSWORD}
                placeholder="Ingresar contraseña"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                secureTextEntry
                autoCapitalize="none"
              />

              <PressableScale
                onPress={() => router.push('/(auth)/forgot-password')}
                accessibilityRole="link"
                accessibilityLabel="Olvidé mi contraseña"
                style={{
                  alignSelf: 'flex-end',
                  marginTop: -4,
                  marginBottom: 20,
                  minHeight: 32,
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: LIME,
                    fontFamily: fontFamily.regular,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </Text>
              </PressableScale>

              <PressableScale
                onPress={() => void handleLogin()}
                disabled={socialBusy}
                accessibilityRole="button"
                accessibilityLabel="Iniciar sesión"
                style={{
                  backgroundColor: LIME,
                  borderRadius: 999,
                  minHeight: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: socialBusy ? 0.7 : 1,
                }}
              >
                {loading ? (
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
                    Iniciar sesión
                  </Text>
                )}
              </PressableScale>

              {showSocial ? (
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
                        onPress={() => void handleAppleLogin()}
                        disabled={socialBusy}
                        accessibilityRole="button"
                        accessibilityLabel="Iniciar sesión con Apple"
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
                          <>
                            <Image
                              source={ICON_APPLE}
                              style={{ width: 16, height: 16 }}
                              resizeMode="contain"
                            />
                            <Text
                              style={{
                                color: '#000000',
                                fontSize: 12,
                                fontWeight: '600',
                                fontFamily: fontFamily.regular,
                                flexShrink: 1,
                              }}
                              numberOfLines={1}
                            >
                              Iniciar sesión con Apple
                            </Text>
                          </>
                        )}
                      </Pressable>
                    ) : null}

                    {googleEnabled ? (
                      <Pressable
                        onPress={() => void handleGoogleLogin()}
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
                          <>
                            <Image
                              source={ICON_GOOGLE}
                              style={{ width: 18, height: 18 }}
                              resizeMode="contain"
                            />
                            <Text
                              style={{
                                color: '#FFFFFF',
                                fontSize: 12,
                                fontWeight: '600',
                                fontFamily: fontFamily.regular,
                                flexShrink: 1,
                              }}
                              numberOfLines={1}
                            >
                              Continuar con Google
                            </Text>
                          </>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
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
                    color: MUTED,
                    fontFamily: fontFamily.regular,
                    fontSize: 14,
                  }}
                >
                  ¿No tenés cuenta?{' '}
                  <Text style={{ color: LIME, fontWeight: '700' }}>Registrate</Text>
                </Text>
              </PressableScale>
            </FadeInUp>
          </ScrollView>
      </View>
    </Screen>
  );
}
