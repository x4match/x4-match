'use client';

import { FormEvent, useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthWordmark } from '@/components/auth/AuthWordmark';
import { isClub } from '@/lib/roles';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthUser } from '@/lib/types';
import {
  getGoogleSignInErrorMessage,
  isGoogleSignInConfigured,
  setPendingGoogleSignup,
  signInWithGoogle,
} from '@/lib/google-auth';
import {
  getAppleSignInErrorMessage,
  isAppleSignInConfigured,
  setPendingAppleSignup,
  signInWithApple,
} from '@/lib/apple-auth';

const ACCENT = '#D7FF00';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 12.23c-.025-2.492 2.035-3.69 2.127-3.746-1.16-1.696-2.965-1.93-3.605-1.956-1.534-.156-2.995.905-3.772.905-.79 0-1.992-.887-3.28-.863-1.688.025-3.246.99-4.113 2.514-1.76 3.053-.448 7.56 1.262 10.03.84 1.21 1.835 2.57 3.145 2.52 1.27-.05 1.75-.825 3.287-.825 1.52 0 1.96.825 3.3.8 1.365-.025 2.225-1.225 3.055-2.445.97-1.41 1.37-2.78 1.39-2.85-.03-.015-2.66-1.02-2.696-4.084zm-2.52-7.44c.69-.84 1.155-2.01 1.028-3.18-.994.04-2.2.665-2.91 1.5-.64.74-1.2 1.93-1.05 3.06 1.11.086 2.24-.565 2.932-1.38z" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get('error') === 'role' ? 'Solo cuentas de club pueden ingresar.' : null,
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const busy = loading || googleLoading || appleLoading;
  const nextPath = params.get('next') || '/panel';

  function redirectIfUnverified(err: unknown, accountEmail?: string) {
    const data = (err as { response?: { data?: { code?: string; email?: string; devCode?: string } } })
      ?.response?.data;
    const code = data?.code;
    if (code === 'EMAIL_NOT_VERIFIED') {
      const query = new URLSearchParams({ email: data?.email || accountEmail || '', next: nextPath });
      if (data?.devCode) query.set('devCode', data.devCode);
      router.push(`/verificar-email?${query}`);
      return true;
    }
    if (code !== 'ACCOUNT_PENDING_VERIFICATION' && code !== 'ACCOUNT_VERIFICATION_REJECTED') {
      return false;
    }
    const query = new URLSearchParams();
    if (code === 'ACCOUNT_VERIFICATION_REJECTED') query.set('state', 'rejected');
    if (accountEmail) query.set('email', accountEmail);
    router.push(`/pendiente-verificacion${query.size ? `?${query}` : ''}`);
    return true;
  }

  function finishClubLogin(token: string, user: AuthUser) {
    if (!isClub(user.role)) {
      setError('Solo cuentas de club pueden ingresar a este panel.');
      return false;
    }
    login(token, user);
    router.replace(nextPath);
    return true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const token = response.data.access_token as string;
      const user = response.data.user as AuthUser;
      finishClubLogin(token, user);
    } catch (err: unknown) {
      if (redirectIfUnverified(err, email.trim())) return;
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudo iniciar sesión';
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleLogin() {
    setError(null);
    if (!isGoogleSignInConfigured()) {
      setError('Google Sign-In no está configurado. Definí NEXT_PUBLIC_GOOGLE_CLIENT_ID.');
      return;
    }
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const response = await api.post('/auth/google', { idToken });
      if (response.data?.needsRegistration) {
        setPendingGoogleSignup({
          idToken,
          email: response.data.email,
          fullName: response.data.fullName,
          photo: response.data.photo,
        });
        router.push('/register');
        return;
      }
      finishClubLogin(response.data.access_token as string, response.data.user as AuthUser);
    } catch (err: unknown) {
      if (redirectIfUnverified(err)) return;
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      const message =
        typeof apiMessage === 'string' ? apiMessage : getGoogleSignInErrorMessage(err);
      if (message !== 'Inicio de sesión cancelado') {
        setError(message);
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function onAppleLogin() {
    setError(null);
    if (!isAppleSignInConfigured()) {
      setError('Sign in with Apple no está configurado. Definí NEXT_PUBLIC_APPLE_CLIENT_ID.');
      return;
    }
    setAppleLoading(true);
    try {
      const { identityToken, fullName, email: appleEmail } = await signInWithApple();
      const response = await api.post('/auth/apple', { identityToken, fullName });
      if (response.data?.needsRegistration) {
        setPendingAppleSignup({
          identityToken,
          email: response.data.email || appleEmail || '',
          fullName: response.data.fullName || fullName,
        });
        router.push('/register');
        return;
      }
      finishClubLogin(response.data.access_token as string, response.data.user as AuthUser);
    } catch (err: unknown) {
      if (redirectIfUnverified(err)) return;
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      const message =
        typeof apiMessage === 'string' ? apiMessage : getAppleSignInErrorMessage(err);
      if (message !== 'Inicio de sesión cancelado') {
        setError(message);
      }
    } finally {
      setAppleLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      <section className="relative flex w-full flex-col justify-center overflow-hidden px-6 py-12 sm:px-10 lg:w-1/2 lg:px-14 xl:px-20">
        <div className="relative z-10 mx-auto w-full max-w-md">
          <AuthWordmark className="mb-10" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90 sm:text-xs">
            Padel competitivo en Argentina
          </p>
          <h1 className="mt-4 text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.04em]">
            <span className="text-white">TODO EN </span>
            <span style={{ color: ACCENT }}>X4MATCH</span>
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70 sm:text-[15px]">
            Ingresá a tu cuenta para seguir jugando y gestionando tu club
          </p>

          <form onSubmit={onSubmit} className="mt-9 space-y-3.5">
            <label className="relative block">
              <span className="sr-only">Correo electrónico</span>
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-white/40" />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                className="h-12 w-full rounded-2xl border border-white/15 bg-transparent pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-(--login-accent)"
                style={{ ['--login-accent' as string]: ACCENT }}
              />
            </label>

            <label className="relative block">
              <span className="sr-only">Contraseña</span>
              <Lock className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-white/40" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="h-12 w-full rounded-2xl border border-white/15 bg-transparent pl-11 pr-12 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-(--login-accent)"
                style={{ ['--login-accent' as string]: ACCENT }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/45 transition-colors hover:text-white/80"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </label>

            <div className="flex justify-end pt-0.5">
              <Link
                href="/forgot-password"
                className="text-sm font-medium hover:underline"
                style={{ color: ACCENT }}
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {error ? (
              <p className="rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-extrabold uppercase tracking-[0.08em] text-black transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              style={{ backgroundColor: ACCENT }}
            >
              {loading ? 'Ingresando…' : 'Iniciar sesión'}
            </button>

            <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onGoogleLogin()}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-transparent text-[13px] font-medium text-white transition-colors hover:bg-white/5 disabled:opacity-60"
              >
                <GoogleIcon className="size-4 shrink-0" />
                {googleLoading ? 'Conectando…' : 'Continuar con Google'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onAppleLogin()}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-transparent text-[13px] font-medium text-white transition-colors hover:bg-white/5 disabled:opacity-60"
              >
                <AppleIcon className="size-4 shrink-0" />
                {appleLoading ? 'Conectando…' : 'Continuar con Apple'}
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-white/65">
            ¿No tenés una cuenta?{' '}
            <Link href="/register" className="font-semibold hover:underline" style={{ color: ACCENT }}>
              Registrate
            </Link>
          </p>
        </div>
      </section>

      <aside className="relative hidden min-h-screen w-1/2 overflow-hidden lg:block">
        <Image
          src="/login-hero.png"
          alt="Jugadores de pádel con indumentaria x4 match en el club"
          fill
          priority
          quality={95}
          sizes="(min-width: 1024px) 50vw, 0px"
          className="object-cover object-center"
        />
      </aside>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <LoginForm />
    </Suspense>
  );
}
