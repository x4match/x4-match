import { useEffect, useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { postAuthRoute } from '@/lib/auth/onboarding';
import { pendingVerificationHref } from '@/lib/auth/verification';
import { ui } from '@/theme/tokens';
import { Screen, OtpInput, PrimaryButton, FadeInUp, PressableScale, StackHeader } from '@/components/x4match';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const params = useLocalSearchParams<{ email?: string; devCode?: string; from?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const fromRegister = params.from === 'register';

  const [devCode, setDevCode] = useState(typeof params.devCode === 'string' ? params.devCode : '');
  const [code, setCode] = useState(devCode);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async (value: string = code) => {
    if (loading) return;
    if (value.length !== 6) {
      setError('Ingresá el código de 6 dígitos');
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const response = await api.post('/auth/verify-email', { email, code: value });
      if (response.data?.pendingVerification) {
        router.replace(pendingVerificationHref('pending', email) as any);
        return;
      }
      const user = response.data.user;
      await login(response.data.access_token, user);
      if (fromRegister) {
        router.replace(user?.role === 'CLUB_ADMIN' ? '/(tabs)/home' : '/onboarding');
      } else {
        router.replace(postAuthRoute(user) as any);
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'No se pudo verificar el código';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const response = await api.post('/auth/resend-verification', { email });
      const nextDevCode = response.data?.devCode as string | undefined;
      if (nextDevCode) {
        setDevCode(nextDevCode);
        setCode(nextDevCode);
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
      Alert.alert('Código enviado', 'Revisá tu email (y la carpeta de spam).');
    } catch (err: any) {
      const message = err.response?.data?.message || 'No se pudo reenviar el código';
      Alert.alert('Error', typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen>
      <LinearGradient colors={[ui.colors.bg, ui.colors.bgElevated, ui.colors.surface0]} style={{ flex: 1 }}>
        <StackHeader title="Verificá tu email" />
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: ui.spacing.lg,
            paddingTop: 24,
            paddingBottom: 48,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <FadeInUp index={0}>
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 22,
                  backgroundColor: 'rgba(163,230,53,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name="mail-unread-outline" size={30} color={ui.colors.accent} />
              </View>
              <Text style={[ui.typography.h2, { color: ui.colors.textPrimary, textAlign: 'center' }]}>
                Revisá tu email
              </Text>
              <Text
                style={[
                  ui.typography.bodySm,
                  { color: ui.colors.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 22 },
                ]}
              >
                Te enviamos un código de 6 dígitos a{' '}
                <Text style={{ color: ui.colors.textPrimary }}>{email}</Text>. Ingresalo para activar tu
                cuenta.
              </Text>
            </View>
          </FadeInUp>

          {!!devCode && (
            <FadeInUp index={1}>
              <View
                style={{
                  backgroundColor: 'rgba(20,184,166,0.12)',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(20,184,166,0.35)',
                  padding: 14,
                  marginBottom: 20,
                }}
              >
                <Text style={{ color: ui.colors.primary, fontFamily: ui.typography.label.fontFamily, fontSize: 13 }}>
                  Código de desarrollo: {devCode}
                </Text>
              </View>
            </FadeInUp>
          )}

          <FadeInUp index={2}>
            <OtpInput
              label="Código"
              value={code}
              onChange={(value) => {
                setCode(value);
                if (error) setError(undefined);
              }}
              onComplete={handleVerify}
              error={error}
              autoFocus={!devCode}
              editable={!loading}
            />
            <PrimaryButton label="Verificar" onPress={() => handleVerify()} loading={loading} fullWidth size="lg" />
          </FadeInUp>

          <FadeInUp index={3}>
            <PressableScale
              onPress={handleResend}
              disabled={cooldown > 0 || resending}
              accessibilityRole="button"
              style={{ marginTop: 24, minHeight: 44, justifyContent: 'center' }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  color: cooldown > 0 ? ui.colors.textMuted : ui.colors.primary,
                  fontFamily: ui.typography.label.fontFamily,
                }}
              >
                {cooldown > 0 ? `Reenviar código en ${cooldown}s` : 'Reenviar código'}
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => router.replace('/(auth)/login')}
              accessibilityRole="link"
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ textAlign: 'center', color: ui.colors.textSecondary }}>
                Volver a iniciar sesión
              </Text>
            </PressableScale>
          </FadeInUp>
        </ScrollView>
      </LinearGradient>
    </Screen>
  );
}
