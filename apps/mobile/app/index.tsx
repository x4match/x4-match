import { useCallback, useEffect, useRef, useState } from 'react';
import { View, InteractionManager } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { X4MatchLoading } from '@/components/ui/X4MatchLoading';
import { postAuthRoute } from '@/lib/auth/onboarding';
import { ui } from '@/theme/tokens';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const bootstrappedRef = useRef(false);
  const [introDone, setIntroDone] = useState(false);
  const handleIntroFinish = useCallback(() => setIntroDone(true), []);
  // Tiene que coincidir con `imageWidth` del plugin expo-splash-screen (app.json):
  // assets/splash-logo.png encuadra el mismo viewBox que X4MatchLoading, así el
  // paso del splash nativo a la animación no tiene salto.
  const logoSize = 240;

  useEffect(() => {
    if (loading || !introDone) return;

    // Solo actuar cuando estamos en la ruta índice. Si ya navegamos a
    // /onboarding u otra pantalla, un updateUser no debe volver a hacer
    // replace (remonta onboarding y reinicia el step).
    const atIndex = segments.length === 0 || segments[0] === 'index';
    if (!atIndex) return;

    if (bootstrappedRef.current && user) return;
    bootstrappedRef.current = true;

    const task = InteractionManager.runAfterInteractions(() => {
      router.replace(postAuthRoute(user) as any);
    });

    return () => task.cancel();
  }, [user, loading, introDone, router, segments]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ui.colors.bg }}>
      <X4MatchLoading
        size={logoSize}
        backgroundColor={ui.colors.bg}
        loop={false}
        onFinish={handleIntroFinish}
      />
    </View>
  );
}
