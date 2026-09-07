import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

export type PendingAppleSignup = {
  identityToken: string;
  email: string;
  fullName?: string;
};

let pendingAppleSignup: PendingAppleSignup | null = null;

export function isApplePlatform(): boolean {
  return Platform.OS === 'ios';
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (!isApplePlatform()) return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export function setPendingAppleSignup(value: PendingAppleSignup | null) {
  pendingAppleSignup = value;
}

export function getPendingAppleSignup(): PendingAppleSignup | null {
  return pendingAppleSignup;
}

export async function signInWithApple(): Promise<{
  identityToken: string;
  fullName?: string;
}> {
  if (!isApplePlatform()) {
    throw new Error('Sign in with Apple solo está disponible en iOS');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple no devolvió un token de identidad');
  }

  const parts = [credential.fullName?.givenName, credential.fullName?.familyName]
    .map((part) => part?.trim())
    .filter(Boolean);

  return {
    identityToken: credential.identityToken,
    fullName: parts.length > 0 ? parts.join(' ') : undefined,
  };
}

export function getAppleSignInErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: string }).code);
    if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') {
      return 'Inicio de sesión cancelado';
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'No se pudo iniciar sesión con Apple';
}
