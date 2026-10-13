import { useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { describeAxiosError } from '@/lib/debug';
import { unregisterPushNotifications } from '@/lib/notifications/push-notifications';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, PrimaryButton } from '@/components/x4match';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const confirmDelete = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Esta acción no se puede deshacer. Se borra tu perfil, credenciales y datos personales.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void handleDelete();
          },
        },
      ],
    );
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await unregisterPushNotifications();
      await api.delete('/users/me');
      await logout();
      router.replace('/(auth)/login');
    } catch (error) {
      Alert.alert('Error', describeAxiosError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <StackHeader title="Eliminar cuenta" />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: ui.spacing.lg }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: ui.colors.dangerSoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Ionicons name="trash-outline" size={26} color={ui.colors.danger} />
          </View>
          <Text style={{ fontSize: 15, color: ui.colors.textMuted, textAlign: 'center' }}>
            Vas a eliminar tu cuenta de x4 match de forma permanente.
          </Text>
        </View>

        <AppCard style={{ marginBottom: ui.spacing.md }}>
          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 8 }}>
            Se elimina
          </Text>
          <Text style={{ fontSize: 14, color: ui.colors.textSecondary, lineHeight: 20 }}>
            Perfil, email, foto, credenciales, seguidores, mensajes, notificaciones y tokens de
            sesión. Si sos gerente, se desvincula tu acceso al club.
          </Text>
        </AppCard>

        <AppCard style={{ marginBottom: ui.spacing.lg }}>
          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 8 }}>
            Se puede conservar
          </Text>
          <Text style={{ fontSize: 14, color: ui.colors.textSecondary, lineHeight: 20 }}>
            Resultados de partidos o torneos ya jugados, de forma anonimizada, y registros de
            pagos si la ley lo exige. Los datos del club (canchas, turnos) no se borran.
          </Text>
        </AppCard>

        <PrimaryButton
          label="Eliminar mi cuenta"
          onPress={confirmDelete}
          loading={loading}
          fullWidth
          size="lg"
          variant="dark"
        />
      </ScrollView>
    </Screen>
  );
}
