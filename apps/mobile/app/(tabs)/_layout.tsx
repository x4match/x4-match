import { Tabs, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isClub, isPlayer } from '@/lib/roles';
import { needsPlayerOnboarding } from '@/lib/auth/onboarding';
import { FloatingTabBar } from '@/components/ui';
import type { TabBarProps } from '@/components/ui/FloatingTabBar';
import { ui } from '@/theme/tokens';

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const redirectedRef = useRef(false);
  const isClubAccount = isClub(user?.role);
  const isPlayerAccount = isPlayer(user?.role);

  useEffect(() => {
    if (loading || !user) return;
    if (!needsPlayerOnboarding(user)) {
      redirectedRef.current = false;
      return;
    }
    // Evitar replace repetido: remonta /onboarding y pierde el step.
    if (redirectedRef.current) return;
    if (segments[0] === 'onboarding') return;
    redirectedRef.current = true;
    router.replace('/onboarding' as any);
  }, [user, loading, router, segments]);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...(props as TabBarProps)} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ui.colors.primary,
        tabBarInactiveTintColor: ui.colors.textMuted,
        sceneStyle: { backgroundColor: ui.colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Inicio' }} />
      <Tabs.Screen
        name="gerente"
        options={{ href: isClubAccount ? undefined : null, title: 'Gerente' }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          href: isPlayerAccount || isClubAccount ? undefined : null,
          title: 'Partidos',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{ href: isPlayerAccount ? undefined : null, title: 'Buscar' }}
      />
      <Tabs.Screen
        name="court-slots"
        options={{ href: isClubAccount ? undefined : null, title: 'Gestión' }}
      />
      <Tabs.Screen
        name="shop"
        options={{ href: isClubAccount ? undefined : null, title: 'Tienda' }}
      />
      <Tabs.Screen
        name="club-ranking"
        options={{ href: isClubAccount ? undefined : null, title: 'Ranking' }}
      />
      <Tabs.Screen name="community" options={{ href: null, title: 'Comunidad' }} />
      <Tabs.Screen
        name="messages"
        options={{ href: isPlayerAccount ? undefined : null, title: 'Mensajes' }}
      />
      <Tabs.Screen name="rankings" options={{ href: null }} />
      {/* Accesible desde Perfil; no ocupa un tab del shell de jugador */}
      <Tabs.Screen name="organizer" options={{ href: null, title: 'Gestión' }} />
      <Tabs.Screen name="history" options={{ href: null, title: 'Historial' }} />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', href: isClubAccount ? null : undefined }}
      />
    </Tabs>
  );
}
