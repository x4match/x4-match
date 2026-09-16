const GSI_SRC = 'https://accounts.google.com/gsi/client';

export type PendingGoogleSignup = {
  idToken: string;
  email: string;
  fullName?: string;
  photo?: string;
};

const PENDING_KEY = 'x4match.pendingGoogleSignup';

type CredentialResponse = { credential?: string; select_by?: string };

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  prompt: (momentListener?: (notification: {
    isNotDisplayed: () => boolean;
    isSkippedMoment: () => boolean;
    isDismissedMoment: () => boolean;
  }) => void) => void;
  renderButton: (
    parent: HTMLElement,
    options: Record<string, string | number>,
  ) => void;
  cancel: () => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

let gsiLoading: Promise<void> | null = null;

function clientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '';
}

export function isGoogleSignInConfigured() {
  return Boolean(clientId());
}

export function setPendingGoogleSignup(value: PendingGoogleSignup | null) {
  if (typeof window === 'undefined') return;
  if (!value) {
    sessionStorage.removeItem(PENDING_KEY);
    return;
  }
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
}

export function getPendingGoogleSignup(): PendingGoogleSignup | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingGoogleSignup;
  } catch {
    return null;
  }
}

function loadGsi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Sign-In solo funciona en el navegador'));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiLoading) return gsiLoading;

  gsiLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('No se pudo cargar Google Sign-In')),
      );
      if (window.google?.accounts?.id) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Sign-In'));
    document.head.appendChild(script);
  });

  return gsiLoading;
}

function mountFallbackButton(
  accounts: GoogleAccountsId,
  onCancel: () => void,
): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.72);padding:16px;';

  const panel = document.createElement('div');
  panel.style.cssText =
    'width:min(100%,320px);border-radius:16px;background:#111;border:1px solid rgba(255,255,255,0.12);padding:20px;text-align:center;color:#fff;font-family:inherit;';

  const title = document.createElement('p');
  title.textContent = 'Continuá con Google';
  title.style.cssText = 'margin:0 0 12px;font-size:15px;font-weight:600;';

  const buttonHost = document.createElement('div');
  buttonHost.style.cssText = 'display:flex;justify-content:center;min-height:44px;';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancelar';
  cancel.style.cssText =
    'margin-top:14px;background:transparent;border:0;color:rgba(255,255,255,0.65);font-size:13px;cursor:pointer;';
  cancel.onclick = () => onCancel();

  panel.append(title, buttonHost, cancel);
  backdrop.append(panel);
  document.body.appendChild(backdrop);

  accounts.renderButton(buttonHost, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    width: 280,
  });

  return backdrop;
}

/**
 * Abre Google Identity Services y resuelve con el ID token (JWT).
 * Misma pieza que consume POST /auth/google en mobile.
 */
export async function signInWithGoogle(): Promise<string> {
  const id = clientId();
  if (!id) {
    throw new Error('Google Sign-In no está configurado en el panel');
  }

  await loadGsi();
  const accounts = window.google?.accounts?.id;
  if (!accounts) {
    throw new Error('Google Sign-In no está disponible');
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let fallback: HTMLElement | null = null;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      fallback?.remove();
      try {
        accounts.cancel();
      } catch {
        // ignore
      }
      fn();
    };

    const timeout = window.setTimeout(() => {
      finish(() => reject(new Error('Inicio de sesión con Google cancelado')));
    }, 120_000);

    accounts.initialize({
      client_id: id,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        if (response.credential) {
          finish(() => resolve(response.credential!));
          return;
        }
        finish(() => reject(new Error('No se recibió el token de Google')));
      },
    });

    const openFallback = () => {
      if (settled || fallback) return;
      fallback = mountFallbackButton(accounts, () => {
        finish(() => reject(new Error('Inicio de sesión cancelado')));
      });
    };

    accounts.prompt((notification) => {
      if (
        notification.isNotDisplayed() ||
        notification.isSkippedMoment() ||
        notification.isDismissedMoment()
      ) {
        openFallback();
      }
    });
  });
}

export function getGoogleSignInErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'No se pudo iniciar sesión con Google';
}
