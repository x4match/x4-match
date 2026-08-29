import { useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import { Screen, InputField, PrimaryButton, FadeInUp, PressableScale, StackHeader } from '@/components/padely';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; devCode?: string }>();
  const emailParam = typeof params.email === 'string' ? params.email : '';
  const devCode = typeof params.devCode === 'string' ? params.devCode : '';

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState(devCode);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const next: Record<string, string> = {};
    if (!email) next.email = 'El email es requerido';
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = 'Email inválido';
    if (!code || code.length !== 6) next.code = 'Ingresá el código de 6 dígitos';
    if (!newPassword || newPassword.length < 6) next.newPassword = 'Mínimo 6 caracteres';
    if (newPassword !== confirmPassword) next.confirmPassword = 'Las contraseñas no coinciden';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });
      Alert.alert('Listo', 'Tu contraseña fue actualizada. Ya podés iniciar sesión.', [
        { text: 'Ir al login', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err: any) {
      const message = err.response?.data?.message || 'No se pudo restablecer la contraseña';
      Alert.alert('Error', typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <LinearGradient colors={[ui.colors.bg, ui.colors.bgElevated, ui.colors.surface0]} style={{ flex: 1 }}>
        <StackHeader title="Nueva contraseña" />
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
                  <Ionicons name="lock-closed-outline" size={30} color={ui.colors.accent} />
                </View>
                <Text style={[ui.typography.h2, { color: ui.colors.textPrimary, textAlign: 'center' }]}>
                  Creá tu nueva contraseña
                </Text>
                <Text
                  style={[
                    ui.typography.bodySm,
                    { color: ui.colors.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 22 },
                  ]}
                >
                  Ingresá el código de 6 dígitos y elegí una contraseña nueva.
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
                label="Código"
                placeholder="6 dígitos"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                error={errors.code}
                keyboardType="number-pad"
                leftIcon={<Ionicons name="shield-checkmark-outline" size={20} color={ui.colors.textMuted} />}
              />
              <InputField
                label="Nueva contraseña"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChangeText={setNewPassword}
                error={errors.newPassword}
                secureTextEntry
                leftIcon={<Ionicons name="lock-closed-outline" size={20} color={ui.colors.textMuted} />}
              />
              <InputField
                label="Confirmar contraseña"
                placeholder="Repetí la nueva contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={errors.confirmPassword}
                secureTextEntry
                leftIcon={<Ionicons name="key-outline" size={20} color={ui.colors.textMuted} />}
              />
              <PrimaryButton
                label="Restablecer contraseña"
                onPress={handleSubmit}
                loading={loading}
                fullWidth
                size="lg"
              />
            </FadeInUp>

            <FadeInUp index={3}>
              <PressableScale
                onPress={() => router.replace('/(auth)/forgot-password')}
                accessibilityRole="link"
                style={{ marginTop: 24, minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ textAlign: 'center', color: ui.colors.primary, fontFamily: ui.typography.label.fontFamily }}>
                  Reenviar código
                </Text>
              </PressableScale>
            </FadeInUp>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Screen>
  );
}
