import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, Geist_800ExtraBold } from '@expo-google-fonts/geist';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/components/ui/Toast';
import { applyGeistTextDefaults } from '@/lib/apply-geist';
import { configureGoogleSignIn } from '@/lib/google-auth';
import { queryClient } from '@/lib/query-client';
import { ui } from '@/theme/tokens';
import '../global.css';

SplashScreen.preventAutoHideAsync();

export const Colors = {
  primary: ui.colors.bg,
  primaryLight: ui.colors.surface1,
  primaryDark: ui.colors.surface2,
  accent: ui.colors.accent,
  accentLight: '#BEF264',
  white: ui.colors.textInverse,
  textMuted: ui.colors.textMuted,
  textDark: ui.colors.textPrimary,
  background: ui.colors.bg,
  cardBorder: ui.colors.border,
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
  });
  const [splashTimedOut, setSplashTimedOut] = useState(false);

  const ready = fontsLoaded || fontError || splashTimedOut;

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (fontsLoaded) {
      applyGeistTextDefaults();
    }

    void SplashScreen.hideAsync();
  }, [ready, fontsLoaded]);

  // Evita pantalla en blanco si las fuentes tardan o fallan en Expo Go.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSplashTimedOut(true);
      void SplashScreen.hideAsync();
    }, 4000);
    return () => clearTimeout(timeout);
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: ui.colors.bg },
                headerTintColor: ui.colors.textPrimary,
                headerTitleStyle: {
                  fontFamily: fontsLoaded ? ui.typography.h3.fontFamily : undefined,
                  fontSize: 17,
                },
                contentStyle: { backgroundColor: ui.colors.bg },
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
              }}
            >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="match/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="match/[id]/result" options={{ headerShown: false }} />
            <Stack.Screen name="club/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="create-open-match" options={{ headerShown: false }} />
            <Stack.Screen name="browse-open-matches" options={{ headerShown: false }} />
            <Stack.Screen name="auto-matchmaking" options={{ headerShown: false }} />
            <Stack.Screen name="matchmaking" options={{ headerShown: false }} />
            <Stack.Screen name="availability" options={{ headerShown: false }} />
            <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
            <Stack.Screen name="edit-preferences" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
            <Stack.Screen name="player/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="conversation/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="tournaments" options={{ headerShown: false }} />
            <Stack.Screen name="tournament/[id]/index" options={{ headerShown: false }} />
            <Stack.Screen name="tournament/[id]/manage" options={{ headerShown: false }} />
            <Stack.Screen name="tournament/[id]/register" options={{ headerShown: false }} />
            <Stack.Screen name="circuit/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="manage-clubs" options={{ headerShown: false }} />
            <Stack.Screen name="change-password" options={{ headerShown: false }} />
            <Stack.Screen name="badges" options={{ headerShown: false }} />
            <Stack.Screen name="club-billing" options={{ headerShown: false }} />
            <Stack.Screen name="club-payments" options={{ headerShown: false }} />
            <Stack.Screen name="club-alerts" options={{ headerShown: false }} />
            <Stack.Screen name="club-clients" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="ranking-general" options={{ headerShown: false }} />
            <Stack.Screen name="recent-matches" options={{ headerShown: false }} />
            <Stack.Screen name="history/[id]" options={{ headerShown: false }} />
          </Stack>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
