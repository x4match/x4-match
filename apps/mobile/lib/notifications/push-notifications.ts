import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/lib/api';

const PUSH_TOKEN_KEY = 'expo_push_token';

/** Debe coincidir con `defaultChannel` del plugin y con el `channelId` del backend. */
export const ANDROID_NOTIFICATION_CHANNEL_ID = 'default';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function expoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;

  // En Android 13+ el prompt de permisos no aparece hasta crear un canal.
  // Tiene que existir antes de requestPermissions / getExpoPushTokenAsync.
  await Notifications.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL_ID, {
    name: 'General',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F5C518',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      // Expo Go en Android (SDK 53+) no soporta push remoto.
      return null;
    }
    if (!Device.isDevice) {
      return null;
    }

    await ensureAndroidNotificationChannel();

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      console.warn('[push] Permiso de notificaciones denegado');
      return null;
    }

    const projectId = expoProjectId();
    if (!projectId) {
      console.warn('[push] Falta EAS projectId en la config de Expo');
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    await api.post('/notifications/push-token', { token, platform });
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    return token;
  } catch (error) {
    // En Android lo más frecuente es FCM sin google-services.json / credenciales EAS.
    console.warn('[push] No se pudo registrar el token', error);
    return null;
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (token) {
      await api.delete('/notifications/push-token', { params: { token } });
    }
  } catch {
    // El logout no debe fallar si Expo o la API no responden.
  } finally {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  }
}
