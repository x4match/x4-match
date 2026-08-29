import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, PrimaryButton, OptionChips } from '@/components/padely';

const HAND_OPTIONS = ['Derecha', 'Izquierda'] as const;
const POSITION_OPTIONS = ['Drive', 'Revés', 'Ambos'] as const;
const MATCH_TYPE_OPTIONS = ['Competitivo', 'Amistoso'] as const;
const PLAY_TIME_OPTIONS = ['Mañana', 'Tarde', 'Noche'] as const;

export default function EditPreferencesScreen() {
  const router = useRouter();
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hand, setHand] = useState<string | undefined>();
  const [position, setPosition] = useState<string | undefined>();
  const [matchType, setMatchType] = useState<string | undefined>();
  const [playTime, setPlayTime] = useState<string | undefined>();

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await api.get('/users/profile');
      const data = response.data;
      setHand(data.preferences?.preferredHand || undefined);
      setPosition(data.preferences?.courtPosition || undefined);
      setMatchType(data.preferences?.matchType || undefined);
      setPlayTime(data.preferences?.preferredPlayTime || undefined);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api.patch('/users/preferences', {
        preferredHand: hand,
        courtPosition: position,
        matchType: matchType,
        preferredPlayTime: playTime,
      });
      await updateUser({
        preferredHand: response.data.preferredHand,
        courtPosition: response.data.courtPosition,
        matchType: response.data.matchType,
        preferredPlayTime: response.data.preferredPlayTime,
      });
      Alert.alert('Listo', 'Preferencias actualizadas correctamente');
      router.back();
    } catch (error: any) {
      const message = error?.response?.data?.message;
      Alert.alert(
        'Error',
        Array.isArray(message)
          ? message.join('\n')
          : typeof message === 'string'
            ? message
            : 'No se pudieron actualizar las preferencias',
      );
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <TouchableOpacity onPress={handleSave} disabled={saving || loading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      {saving ? (
        <ActivityIndicator size="small" color={ui.colors.primary} />
      ) : (
        <Text style={{ color: ui.colors.primary, fontWeight: '700', fontSize: 15 }}>Guardar</Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <Screen>
        <StackHeader title="Preferencias" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={ui.colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StackHeader title="Preferencias de juego" rightAction={saveButton} />
      <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 14, color: ui.colors.textMuted, marginBottom: ui.spacing.lg }}>
          Contanos cómo te gusta jugar para mejorar el matchmaking
        </Text>

        <AppCard>
          <OptionChips label="Mejor mano" options={HAND_OPTIONS} selected={hand} onSelect={setHand} />
          <OptionChips label="Posición en pista" options={POSITION_OPTIONS} selected={position} onSelect={setPosition} />
          <OptionChips label="Tipo de partido" options={MATCH_TYPE_OPTIONS} selected={matchType} onSelect={setMatchType} />
          <OptionChips label="Horario preferido" options={PLAY_TIME_OPTIONS} selected={playTime} onSelect={setPlayTime} />
        </AppCard>

        <PrimaryButton label="Guardar preferencias" onPress={handleSave} loading={saving} fullWidth size="lg" />
      </ScrollView>
    </Screen>
  );
}
