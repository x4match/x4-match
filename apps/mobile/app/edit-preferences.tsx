import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const HAND_OPTIONS = ['Derecha', 'Izquierda'] as const;
const POSITION_OPTIONS = ['Lado derecho', 'Lado izquierdo'] as const;
const MATCH_TYPE_OPTIONS = ['Competitivo', 'Amistoso'] as const;
const PLAY_TIME_OPTIONS = ['Mañana', 'Tarde', 'Noche'] as const;

function OptionSelector({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly string[];
  selected?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View className="mb-6">
      <Text className="text-sm font-semibold text-gray-700 mb-3">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => onSelect(option)}
            className={`px-5 py-2.5 rounded-full border ${
              selected === option
                ? 'bg-gray-900 border-gray-900'
                : 'bg-white border-gray-300'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                selected === option ? 'text-white' : 'text-gray-700'
              }`}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

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
      updateUser({
        preferredHand: response.data.preferredHand,
        courtPosition: response.data.courtPosition,
        matchType: response.data.matchType,
        preferredPlayTime: response.data.preferredPlayTime,
      });
      Alert.alert('Listo', 'Preferencias actualizadas correctamente');
      router.back();
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'No se pudieron actualizar las preferencias');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3B5BDB" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={saving} style={{ marginRight: 4 }}>
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-white text-base font-semibold">
                  Guardar
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        <OptionSelector
          label="Mejor mano"
          options={HAND_OPTIONS}
          selected={hand}
          onSelect={setHand}
        />

        <OptionSelector
          label="Lado de la pista"
          options={POSITION_OPTIONS}
          selected={position}
          onSelect={setPosition}
        />

        <OptionSelector
          label="Tipo de partido"
          options={MATCH_TYPE_OPTIONS}
          selected={matchType}
          onSelect={setMatchType}
        />

        <OptionSelector
          label="Horario de juego preferido"
          options={PLAY_TIME_OPTIONS}
          selected={playTime}
          onSelect={setPlayTime}
        />
      </ScrollView>
    </View>
  );
}

