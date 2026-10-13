import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ui } from '@/theme/tokens';
import { Screen, PrimaryButton, FadeInUp } from '@/components/x4match';
import type { AccountVerificationState } from '@/lib/auth/verification';

export default function PendingVerificationScreen() {
  const router = useRouter();
  const { state, email } = useLocalSearchParams<{
    state?: AccountVerificationState;
    email?: string;
  }>();
  const rejected = state === 'rejected';

  return (
    <Screen>
      <LinearGradient
        colors={[ui.colors.bg, ui.colors.bgElevated, ui.colors.surface0]}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: ui.spacing.lg,
            paddingVertical: 48,
          }}
        >
          <FadeInUp index={0}>
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 24,
                  backgroundColor: rejected ? `${ui.colors.danger}22` : ui.colors.primaryGlow,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <Ionicons
                  name={rejected ? 'close-circle-outline' : 'time-outline'}
                  size={34}
                  color={rejected ? ui.colors.danger : ui.colors.primary}
                />
              </View>
              <Text
                style={[ui.typography.h2, { color: ui.colors.textPrimary, textAlign: 'center' }]}
              >
                {rejected ? 'Registro no aprobado' : 'Pendiente de verificación'}
              </Text>
              <Text
                style={[
                  ui.typography.bodySm,
                  {
                    color: ui.colors.textSecondary,
                    marginTop: 10,
                    textAlign: 'center',
                    lineHeight: 22,
                  },
                ]}
              >
                {rejected
                  ? 'No pudimos verificar el registro de tu club. Escribinos a soporte para revisarlo.'
                  : 'Recibimos el registro de tu club. El equipo de x4 match lo va a revisar y vas a poder ingresar apenas esté aprobado.'}
              </Text>
              {email ? (
                <Text
                  style={[
                    ui.typography.bodySm,
                    { color: ui.colors.textMuted, marginTop: 14, textAlign: 'center' },
                  ]}
                >
                  Cuenta: {email}
                </Text>
              ) : null}
            </View>
          </FadeInUp>

          <FadeInUp index={1}>
            <PrimaryButton
              label="Volver a iniciar sesión"
              onPress={() => router.replace('/(auth)/login')}
              fullWidth
              size="lg"
            />
          </FadeInUp>
        </ScrollView>
      </LinearGradient>
    </Screen>
  );
}
