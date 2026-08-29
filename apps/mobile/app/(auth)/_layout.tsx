import { Stack } from 'expo-router';
import { Colors } from '../_layout';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: Colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: Colors.primary,
        },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Iniciar Sesión' }} />
      <Stack.Screen name="register" options={{ title: 'Registro' }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
    </Stack>
  );
}
