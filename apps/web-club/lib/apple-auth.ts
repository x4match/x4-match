const APPLE_SRC =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

export type PendingAppleSignup = {
  identityToken: string;
  email: string;
  fullName?: string;
};

const PENDING_KEY = 'x4match.pendingAppleSignup';

type AppleSignInSuccess = {
  authorization: { id_token: string; code?: string; state?: string };
  user?: {
    email?: string;
    name?: { firstName?: string; lastName?: string };
  };
};

type AppleIDAuth = {
  init: (config: {
    clientId: string;
    scope: string;
    redirectURI: string;
    state?: string;
    usePopup?: boolean;
  }) => void;
  signIn: (config?: { redirectURI?: string }) => Promise<AppleSignInSuccess>;
};

declare global {
  interface Window {
    AppleID?: { auth: AppleIDAuth };
  }
}

let appleLoading: Promise<void> | null = null;
let appleInitialized = false;

function clientId() {
  return process.env.NEXT_PUBLIC_APPLE_CLIENT_ID?.trim() || '';
}

function redirectUri() {
  const fromEnv = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/login`;
}

export function isAppleSignInConfigured() {
  return Boolean(clientId());
}

export function setPendingAppleSignup(value: PendingAppleSignup | null) {
  if (typeof window === 'undefined') return;
  if (!value) {
    sessionStorage.removeItem(PENDING_KEY);
    return;
  }
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
}

export function getPendingAppleSignup(): PendingAppleSignup | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingAppleSignup;
  } catch {
    return null;
  }
}

function loadAppleSdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Sign in with Apple solo funciona en el navegador'));
  }
  if (window.AppleID?.auth) return Promise.resolve();
  if (appleLoading) return appleLoading;

  appleLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${APPLE_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('No se pudo cargar Sign in with Apple')),
      );
      if (window.AppleID?.auth) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = APPLE_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Sign in with Apple'));
    document.head.appendChild(script);
  });

  return appleLoading;
}

async function ensureAppleInit() {
  const id = clientId();
  if (!id) {
    throw new Error('Sign in with Apple no está configurado en el panel');
  }
  await loadAppleSdk();
  const auth = window.AppleID?.auth;
  if (!auth) {
    throw new Error('Sign in with Apple no está disponible');
  }
  if (!appleInitialized) {
    auth.init({
      clientId: id,
      scope: 'name email',
      redirectURI: redirectUri(),
      usePopup: true,
    });
    appleInitialized = true;
  }
  return auth;
}

export async function signInWithApple(): Promise<{
  identityToken: string;
  fullName?: string;
  email?: string;
}> {
  const auth = await ensureAppleInit();
  try {
    const result = await auth.signIn();
    const identityToken = result.authorization?.id_token;
    if (!identityToken) {
      throw new Error('Apple no devolvió un token de identidad');
    }
    const parts = [result.user?.name?.firstName, result.user?.name?.lastName]
      .map((part) => part?.trim())
      .filter(Boolean);
    return {
      identityToken,
      fullName: parts.length > 0 ? parts.join(' ') : undefined,
      email: result.user?.email?.trim() || undefined,
    };
  } catch (error) {
    const message = getAppleSignInErrorMessage(error);
    throw new Error(message);
  }
}

export function getAppleSignInErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const err = error as { error?: string; message?: string };
    if (err.error === 'popup_closed_by_user' || err.error === 'user_cancelled') {
      return 'Inicio de sesión cancelado';
    }
    if (typeof err.message === 'string' && err.message) return err.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'No se pudo iniciar sesión con Apple';
}
