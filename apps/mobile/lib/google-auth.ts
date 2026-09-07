import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';

let configured = false;

export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'GoogleSignInCancelledError';
  }
}

export function configureGoogleSignIn() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined,
  });
  configured = true;
}

export async function getGoogleIdToken(): Promise<string> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  if (!webClientId) {
    throw new Error(
      'Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Tiene que ser el Client ID de tipo Web (no Android) de Google Cloud Console.',
    );
  }

  configureGoogleSignIn();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new GoogleSignInCancelledError();
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error(
      'Google no devolvió idToken. Verificá que EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID sea el cliente de tipo Web.',
    );
  }
  return idToken;
}

export async function signOutGoogle() {
  try {
    configureGoogleSignIn();
    await GoogleSignin.signOut();
  } catch {
    // Si nunca hubo sesión de Google, no bloqueamos el logout de la app.
  }
}

export function googleSignInUserMessage(error: unknown): string {
  if (error instanceof GoogleSignInCancelledError) {
    return '';
  }

  const code = isErrorWithCode(error) ? String(error.code) : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  const blob = `${code} ${message}`.toUpperCase();

  if (
    blob.includes('DEVELOPER_ERROR') ||
    code === '10' ||
    blob.includes('CODE: 10') ||
    blob.includes('DEVELOPER CONSOLE IS NOT SET UP CORRECTLY')
  ) {
    return [
      'Google rechazó este APK (DEVELOPER_ERROR).',
      'El package name y el SHA-1 del certificado tienen que coincidir con el cliente OAuth Android en Google Cloud Console.',
      'Package instalado: x4.match.',
      'El webClientId de la app tiene que ser el Client ID de tipo Web, no el de Android.',
    ].join('\n');
  }

  if (blob.includes('NETWORK') || blob.includes('NETWORK_ERROR')) {
    return 'No hay conexión con Google. Probá de nuevo.';
  }

  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  return 'No se pudo iniciar sesión con Google';
}
