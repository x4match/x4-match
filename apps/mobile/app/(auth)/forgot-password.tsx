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
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import { Screen, InputField, PrimaryButton, FadeInUp, PressableScale, StackHeader } from '@/components/padely';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const validate = () => {
    if (!email) {
      setError('El email es requerido');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Email inválido');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email: email.trim() });
      const devCode = response.data?.devCode as string | undefined;

      const goReset = () => {
        router.push({
          pathname: '/(auth)/reset-password',
          params: {
            email: email.trim(),
            ...(devCode ? { devCode } : {}),
          },
        } as any);
      };

      if (devCode) {
        Alert.alert(
          'Código de recuperación',
          `En desarrollo el código es: ${devCode}\n\nVálido por 15 minutos.`,
          [{ text: 'Continuar', onPress: goReset }],
        );
      } else {
        Alert.alert(
          'Revisá tu email',
          'Si el email está registrado, te enviamos un código de recuperación. Válido por 15 minutos.',
          [{ text: 'Continuar', onPress: goReset }],
        );
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'No se pudo solicitar la recuperación';
      Alert.alert('Error', typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <LinearGradient colors={[ui.colors.bg, ui.colors.bgElevated, ui.colors.surface0]} style={{ flex: 1 }}>
        <StackHeader title="Recuperar contraseña" />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 22,
                    backgroundColor: 'rgba(20,184,166,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Ionicons name="key-outline" size={30} color={ui.colors.primary} />
                </View>
                <Text style={[ui.typography.h2, { color: ui.colors.textPrimary, textAlign: 'center' }]}>
                  ¿Olvidaste tu contraseña?
                </Text>
                <Text
                  style={[
                    ui.typography.bodySm,
                    { color: ui.colors.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 22 },
                  ]}
                >
                  Ingresá el email de tu cuenta y te enviaremos un código para crear una nueva contraseña.
                </Text>
              </View>
            </FadeInUp>

            <FadeInUp index={1}>
              <InputField
                label="Email"
                placeholder="tu@email.com"
                value={email}
                onChangeText={setEmail}
                error={error}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon={<Ionicons name="mail-outline" size={20} color={ui.colors.textMuted} />}
              />
              <PrimaryButton
                label="Enviar código"
                onPress={handleSubmit}
                loading={loading}
                fullWidth
                size="lg"
              />
            </FadeInUp>

            <FadeInUp index={2}>
              <PressableScale
                onPress={() => router.back()}
                accessibilityRole="link"
                accessibilityLabel="Volver al inicio de sesión"
                style={{ marginTop: 28, minHeight: 44, justifyContent: 'center' }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    color: ui.colors.textMuted,
                    fontFamily: ui.typography.body.fontFamily,
                  }}
                >
                  Volver a{' '}
                  <Text style={{ color: ui.colors.primary, fontFamily: ui.typography.label.fontFamily }}>
                    iniciar sesión
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
