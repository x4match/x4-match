import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { ui } from '@/theme/tokens';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace(isClub(user.role) ? '/(tabs)/gerente' : '/(tabs)/home');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [user, loading]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ui.colors.bg }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          backgroundColor: ui.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Ionicons name="tennisball" size={36} color="#fff" />
      </View>
      <Text style={[ui.typography.h2, { color: ui.colors.textPrimary, marginBottom: 16 }]}>x4 match</Text>
      <ActivityIndicator color={ui.colors.primary} />
    </View>
  );
}
