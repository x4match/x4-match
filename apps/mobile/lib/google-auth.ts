import Constants, { ExecutionEnvironment } from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();

let configured = false;

type GoogleSignInPkg = typeof import('@react-native-google-signin/google-signin');

/**
 * Google Sign-In requiere development build / EAS (no Expo Go).
 * Nunca importar el paquete nativo si el módulo no está en el binario.
 */
export function isGoogleSignInNativeAvailable(): boolean {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return false;
  }

  try {
    return Boolean(NativeModules.RNGoogleSignin);
  } catch {
    return false;
  }
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(webClientId);
}

export function isGoogleSignInAvailable(): boolean {
  return isGoogleSignInConfigured() && isGoogleSignInNativeAvailable();
}

function loadGoogleSignIn(): GoogleSignInPkg {
  if (!isGoogleSignInNativeAvailable()) {
    throw new Error(
      'Google Sign-In necesita un development build. En Android: pnpm android. En iOS: npx expo run:ios. No uses Expo Go.',
    );
  }

  // require dinámico: evita crash al evaluar rutas en Expo Go / binarios viejos
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin') as GoogleSignInPkg;
}

export function configureGoogleSignIn() {
  if (!webClientId || configured || !isGoogleSignInNativeAvailable()) return;

  const { GoogleSignin } = loadGoogleSignIn();
  GoogleSignin.configure({
    webClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined,
    offlineAccess: false,
  });
  configured = true;
}

export async function signOutFromGoogle(): Promise<void> {
  if (!webClientId || !isGoogleSignInNativeAvailable()) return;

  configureGoogleSignIn();

  try {
    const { GoogleSignin } = loadGoogleSignIn();
    if (GoogleSignin.hasPreviousSignIn()) {
      await GoogleSignin.signOut();
    }
  } catch {
    // Si Google no tiene sesión, no bloqueamos el flujo de la app.
  }
}

export async function signInWithGoogle(): Promise<string> {
  if (!webClientId) {
    throw new Error('Google Sign-In no está configurado en la app');
  }

  configureGoogleSignIn();

  const { GoogleSignin, isSuccessResponse } = loadGoogleSignIn();

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  // Sin esto, Google reutiliza la última cuenta y no muestra el selector.
  await signOutFromGoogle();

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new Error('Inicio de sesión con Google cancelado');
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error('No se recibió el token de Google');
  }

  return idToken;
}

export function getGoogleSignInErrorMessage(error: unknown): string {
  if (!isGoogleSignInNativeAvailable()) {
    return 'Google Sign-In requiere development build (no Expo Go). Corré pnpm android o eas build.';
  }

  try {
    const { isErrorWithCode, statusCodes } = loadGoogleSignIn();
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return 'Inicio de sesión cancelado';
      }
      if (error.code === statusCodes.IN_PROGRESS) {
        return 'Ya hay un inicio de sesión en curso';
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return 'Google Play Services no está disponible en este dispositivo';
      }
      if (error.code === statusCodes.DEVELOPER_ERROR) {
        return 'Google rechazó la app (DEVELOPER_ERROR): el cliente Android en Google Cloud debe usar el package x4.match y el SHA-1 de esa firma (EAS upload y/o Play App Signing). El Web Client ID no se cambia.';
      }
    }
  } catch {
    // fallback abajo
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'No se pudo iniciar sesión con Google';
}
