import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import '../global.css';

const queryClient = new QueryClient();

// Paleta de colores - Playtomic style
export const Colors = {
  primary: '#3B5BDB',       // Azul vibrante (header)
  primaryLight: '#4C6EF5',  // Azul más claro
  primaryDark: '#2B4ACB',   // Azul oscuro
  accent: '#f59e0b',        // Ámbar/dorado
  accentLight: '#fbbf24',   // Ámbar claro
  white: '#ffffff',
  textMuted: '#94a3b8',     // Gris suave
  textDark: '#1a1a2e',      // Texto oscuro
  background: '#f5f5f5',    // Fondo gris claro
  cardBorder: '#e5e7eb',    // Borde de tarjetas
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
            headerBackTitle: '',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, headerBackTitle: '' }} />
          <Stack.Screen name="match/[id]" options={{ title: 'Partido', headerBackTitle: '' }} />
          <Stack.Screen name="match/[id]/result" options={{ title: 'Cargar Resultado', headerBackTitle: '' }} />
          <Stack.Screen name="club/[id]" options={{ title: 'Club', headerBackTitle: '' }} />
          <Stack.Screen name="matchmaking" options={{ title: 'Buscar Partido', headerBackTitle: '' }} />
          <Stack.Screen name="availability" options={{ title: 'Disponibilidad', headerBackTitle: '' }} />
          <Stack.Screen name="edit-profile" options={{ title: 'Editar perfil', headerBackTitle: '' }} />
          <Stack.Screen name="edit-preferences" options={{ title: 'Preferencias', headerBackTitle: '' }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
