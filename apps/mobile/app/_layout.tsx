import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/components/ui/Toast';
import { TourProvider } from '@/components/tour/ScreenTour';
import { AppUpdatePrompt } from '@/components/AppUpdatePrompt';
import { applyUtendoTextDefaults } from '@/lib/apply-utendo';
import { configureGoogleSignIn } from '@/lib/auth/google-auth';
import { PushNotificationNavigator } from '@/lib/notifications/PushNotificationNavigator';
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
    'Utendo-Regular': require('../assets/fonts/Utendo-Regular.ttf'),
  });
  const [splashTimedOut, setSplashTimedOut] = useState(false);

  const ready = fontsLoaded || fontError || splashTimedOut;

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (fontsLoaded) {
      applyUtendoTextDefaults();
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <TourProvider>
              <PushNotificationNavigator />
              <AppUpdatePrompt />
              <Stack
                screenOptions={{
                  headerShown: false,
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
              <Stack.Screen name="match/[id]/live" options={{ headerShown: false }} />
              <Stack.Screen name="club/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="(matches)/create-open-match" options={{ headerShown: false }} />
              <Stack.Screen name="(matches)/browse-open-matches" options={{ headerShown: false }} />
              <Stack.Screen name="(matches)/auto-matchmaking" options={{ headerShown: false }} />
              <Stack.Screen name="(matches)/matchmaking" options={{ headerShown: false }} />
              <Stack.Screen name="(account)/availability" options={{ headerShown: false }} />
              <Stack.Screen name="(account)/edit-profile" options={{ headerShown: false }} />
              <Stack.Screen name="(account)/edit-preferences" options={{ headerShown: false }} />
              <Stack.Screen name="(account)/notifications" options={{ headerShown: false }} />
              <Stack.Screen name="player/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="follows/[userId]" options={{ headerShown: false }} />
              <Stack.Screen name="conversation/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="(compete)/tournaments" options={{ headerShown: false }} />
              <Stack.Screen
                name="tournament/[id]/index"
                options={{
                  headerShown: false,
                  presentation: 'transparentModal',
                  animation: 'none',
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
              <Stack.Screen name="tournament/[id]/manage" options={{ headerShown: false }} />
              <Stack.Screen name="tournament/[id]/register" options={{ headerShown: false }} />
              <Stack.Screen name="circuit/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="circuit/[id]/staff" options={{ headerShown: false }} />
              <Stack.Screen name="circuit/[id]/edit" options={{ headerShown: false }} />
              <Stack.Screen name="circuit/[id]/event/[eventId]/index" options={{ headerShown: false }} />
              <Stack.Screen name="circuit/[id]/event/[eventId]/manage" options={{ headerShown: false }} />
              <Stack.Screen name="(club-manager)/manage-clubs" options={{ headerShown: false }} />
              <Stack.Screen name="(club-manager)/clubs" options={{ headerShown: false }} />
              <Stack.Screen name="(account)/change-password" options={{ headerShown: false }} />
              <Stack.Screen name="(account)/badges" options={{ headerShown: false }} />
              <Stack.Screen name="shop/index" options={{ headerShown: false }} />
              <Stack.Screen name="news/index" options={{ headerShown: false }} />
              <Stack.Screen name="news/create" options={{ headerShown: false }} />
              <Stack.Screen name="news/mine" options={{ headerShown: false }} />
              <Stack.Screen name="news/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="(club-manager)/club-billing" options={{ headerShown: false }} />
              <Stack.Screen name="(club-manager)/club-payments" options={{ headerShown: false }} />
              <Stack.Screen name="(club-manager)/club-alerts" options={{ headerShown: false }} />
              <Stack.Screen name="(club-manager)/club-clients" options={{ headerShown: false }} />
              <Stack.Screen name="(account)/onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(compete)/ranking-general" options={{ headerShown: false }} />
              <Stack.Screen name="(matches)/recent-matches" options={{ headerShown: false }} />
              <Stack.Screen name="history/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="(account)/delete-account" options={{ headerShown: false }} />
              <Stack.Screen name="(account)/blocked-users" options={{ headerShown: false }} />
              <Stack.Screen name="(account)/notification-preferences" options={{ headerShown: false }} />
              <Stack.Screen name="challenge/create" options={{ headerShown: false }} />
              <Stack.Screen name="challenge/[id]" options={{ headerShown: false }} />
            </Stack>
              </TourProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
