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
      <Stack.Screen name="login" options={{ title: 'Iniciar Sesión', headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Registro', headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Recuperar Contraseña', headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ title: 'Restablecer Contraseña', headerShown: false }} />
      <Stack.Screen name="verify-email" options={{ title: 'Verificar email', headerShown: false }} />
      <Stack.Screen
        name="pending-verification"
        options={{ title: 'Pendiente de verificación', headerShown: false, gestureEnabled: false }}
      />
    </Stack>
  );
}
