import { useEffect } from 'react';
import { View, ActivityIndicator, Image, InteractionManager } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { ui } from '@/theme/tokens';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const task = InteractionManager.runAfterInteractions(() => {
      if (user) {
        router.replace(isClub(user.role) ? '/(tabs)/gerente' : '/(tabs)/home');
      } else {
        router.replace('/(auth)/login');
      }
    });

    return () => task.cancel();
  }, [user, loading, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ui.colors.bg }}>
      <Image
        source={require('../assets/x4match.png')}
        accessibilityLabel="x4 match"
        style={{ width: 96, height: 96, borderRadius: 24, marginBottom: 16 }}
      />
      <ActivityIndicator color={ui.colors.primary} />
    </View>
  );
}
