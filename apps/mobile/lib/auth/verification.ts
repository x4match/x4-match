export type AccountVerificationState = 'pending' | 'rejected';

export const PENDING_VERIFICATION_ROUTE = '/(auth)/pending-verification';

export function getAccountVerificationState(error: unknown): AccountVerificationState | null {
  const code = (error as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  if (code === 'ACCOUNT_PENDING_VERIFICATION') return 'pending';
  if (code === 'ACCOUNT_VERIFICATION_REJECTED') return 'rejected';
  return null;
}

export const VERIFY_EMAIL_ROUTE = '/(auth)/verify-email';

/** Login con contraseña de una cuenta cuyo email todavía no se validó. */
export function getEmailNotVerified(error: unknown): { email?: string; devCode?: string } | null {
  const data = (error as { response?: { data?: { code?: unknown; email?: unknown; devCode?: unknown } } })
    ?.response?.data;
  if (data?.code !== 'EMAIL_NOT_VERIFIED') return null;
  return {
    email: typeof data.email === 'string' ? data.email : undefined,
    devCode: typeof data.devCode === 'string' ? data.devCode : undefined,
  };
}

export function verifyEmailHref(params: { email: string; devCode?: string; from: 'register' | 'login' }) {
  return {
    pathname: VERIFY_EMAIL_ROUTE,
    params: {
      email: params.email,
      from: params.from,
      ...(params.devCode ? { devCode: params.devCode } : {}),
    },
  } as const;
}

export function pendingVerificationHref(state: AccountVerificationState, email?: string) {
  return {
    pathname: PENDING_VERIFICATION_ROUTE,
    params: { state, ...(email ? { email } : {}) },
  } as const;
}
