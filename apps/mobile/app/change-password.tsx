import { useState } from 'react';
import { View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, InputField, PrimaryButton } from '@/components/padely';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Por favor completá todos los campos');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas nuevas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      Alert.alert('Listo', 'Contraseña actualizada correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <StackHeader title="Cambiar contraseña" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: ui.spacing.lg }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: 'rgba(245,158,11,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Ionicons name="lock-closed" size={26} color={ui.colors.accent} />
            </View>
            <Text style={{ fontSize: 15, color: ui.colors.textMuted, textAlign: 'center' }}>
              Ingresá tu contraseña actual y elegí una nueva
            </Text>
          </View>

          <AppCard>
            <InputField
              label="Contraseña actual"
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={ui.colors.textMuted} />}
              placeholder="Tu contraseña actual"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <InputField
              label="Nueva contraseña"
              leftIcon={<Ionicons name="key-outline" size={18} color={ui.colors.textMuted} />}
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              hint="Mínimo 6 caracteres"
            />
            <InputField
              label="Confirmar nueva contraseña"
              leftIcon={<Ionicons name="key-outline" size={18} color={ui.colors.textMuted} />}
              placeholder="Repetí la nueva contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <PrimaryButton
              label="Cambiar contraseña"
              onPress={handleChange}
              loading={loading}
              variant="dark"
              fullWidth
              size="lg"
            />
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
