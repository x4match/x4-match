import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getNotificationRoute } from './notification-route';

/**
 * Abre la pantalla de una notificación cuando el usuario toca el push.
 * Espera a que haya sesión y a que `index` termine su redirección inicial:
 * si navega antes, ese `replace` pisa la pantalla abierta desde el push.
 */
export function PushNotificationNavigator() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const queryClient = useQueryClient();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledIdRef = useRef<string | null>(null);

  const firstSegment = segments[0] as string | undefined;
  const navigationReady =
    !loading &&
    !!user &&
    !!firstSegment &&
    firstSegment !== 'index' &&
    firstSegment !== '(auth)' &&
    !(segments as string[]).includes('onboarding');

  useEffect(() => {
    if (!navigationReady || !lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const { request } = lastResponse.notification;
    if (handledIdRef.current === request.identifier) return;
    handledIdRef.current = request.identifier;
    Notifications.clearLastNotificationResponse();

    const data = (request.content.data ?? {}) as Record<string, unknown>;
    const type = typeof data.type === 'string' ? data.type : '';

    if (typeof data.notificationId === 'string') {
      void api
        .post(`/notifications/${data.notificationId}/read`)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        })
        .catch(() => undefined);
    }

    router.push((getNotificationRoute(type, data) ?? '/(account)/notifications') as any);
  }, [navigationReady, lastResponse, router, queryClient]);

  return null;
}
