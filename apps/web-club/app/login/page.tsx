'use client';

import { FormEvent, useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { api } from '@/lib/api';
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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-4 left-[10%] top-[20%] flex w-14 items-stretch justify-center sm:w-20"
        >
          <svg width="67" height="575" viewBox="0 0 67 575" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M65.0642 495.242V512.666L41.7184 534.673L65.0642 554.385V573.466L32.7861 542.937L1.52673 572.699L1.52673 554.378L23.086 534.156L1.52673 515.075L1.52673 496.633L32.9153 524.616L65.0642 495.234V495.242Z"
              stroke="url(#paint0_linear_106061_999)"
              strokeMiterlimit="10"
            />
            <path
              d="M51.1599 420.004V434.76H65.8317L65.8317 447.607H51.1599L51.1599 493.782H39.4224L1.27563 448.117L1.27563 434.76H39.4224V420.004H51.1599ZM39.4224 447.607H16.1983L39.4224 477.118L39.4224 447.607Z"
              stroke="url(#paint1_linear_106061_999)"
              strokeMiterlimit="10"
            />
            <path
              d="M65.1152 327.693V340.441H19.0445L41.692 367.777L19.0445 395.365H65.1152V407.743H1.48975L1.48975 394.994L25.031 367.777L1.48975 340.189L1.48975 327.676H65.1152V327.693Z"
              stroke="url(#paint2_linear_106061_999)"
              strokeWidth="0.75"
              strokeMiterlimit="10"
            />
            <path
              d="M65.1152 227.323L65.1152 240.932L51.2367 248.909L51.2367 288.639L65.1152 296.244V310.342L1.48975 275.89L1.48975 262.281L65.1152 227.34V227.323ZM39.6684 255.283L13.8337 269.01L39.6684 282.618V255.283Z"
              stroke="url(#paint3_linear_106061_999)"
              strokeWidth="0.75"
              strokeMiterlimit="10"
            />
            <path
              d="M13.0758 165.147L13.0758 192.112H65.133V206.463H13.0758L13.0758 233.309H1.74365L1.74365 165.147H13.0758Z"
              stroke="url(#paint4_linear_106061_999)"
              strokeWidth="0.75"
              strokeMiterlimit="10"
            />
            <path
              d="M48.874 86.9351C54.8099 86.9351 58.8065 88.0144 60.8301 90.1898C62.8706 92.3651 63.8824 96.3449 63.8824 102.146L63.8824 138.554C63.8824 144.355 62.8706 148.335 60.8301 150.51C58.7896 152.669 54.8099 153.765 48.874 153.765H15.4002C9.54862 153.765 5.58574 152.685 3.49468 150.51C1.42049 148.352 0.375 144.355 0.375 138.554L0.375 102.146C0.459317 92.3315 3.98372 87.2724 10.9314 86.952H20.2232V101.168H11.6903L11.6903 139.549H51.9094L51.9094 101.168H42.6177V86.952H48.8572L48.874 86.9351Z"
              stroke="url(#paint5_linear_106061_999)"
              strokeWidth="0.75"
              strokeMiterlimit="10"
            />
            <path
              d="M65.1157 0.374945V14.7256H39.0281L39.0281 57.997H65.1157V72.2129L1.60828 72.2129L1.60828 57.997H26.1782L26.1782 14.7256H1.60828L1.60828 0.374945L65.1157 0.374945Z"
              stroke="url(#paint6_linear_106061_999)"
              strokeWidth="0.75"
              strokeMiterlimit="10"
            />
            <defs>
              <linearGradient
                id="paint0_linear_106061_999"
                x1="33.2954"
                y1="495.234"
                x2="33.2954"
                y2="573.466"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="white" />
                <stop offset="1" stopColor="#2C2A2A" />
              </linearGradient>
              <linearGradient
                id="paint1_linear_106061_999"
                x1="33.5537"
                y1="420.004"
                x2="33.5537"
                y2="493.782"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="white" />
                <stop offset="1" stopColor="#2C2A2A" />
              </linearGradient>
              <linearGradient
                id="paint2_linear_106061_999"
                x1="33.3025"
                y1="407.743"
                x2="33.3025"
                y2="327.676"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#F3FF6D" />
                <stop offset="1" stopColor="#3C4100" />
              </linearGradient>
              <linearGradient
                id="paint3_linear_106061_999"
                x1="33.3025"
                y1="310.342"
                x2="33.3025"
                y2="227.323"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#F3FF6D" />
                <stop offset="1" stopColor="#3C4100" />
              </linearGradient>
              <linearGradient
                id="paint4_linear_106061_999"
                x1="33.4383"
                y1="233.309"
                x2="33.4383"
                y2="165.147"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#F3FF6D" />
                <stop offset="1" stopColor="#3C4100" />
              </linearGradient>
              <linearGradient
                id="paint5_linear_106061_999"
                x1="32.1287"
                y1="153.765"
                x2="32.1287"
                y2="86.9351"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#F3FF6D" />
                <stop offset="1" stopColor="#3C4100" />
              </linearGradient>
              <linearGradient
                id="paint6_linear_106061_999"
                x1="33.362"
                y1="72.2129"
                x2="33.362"
                y2="0.374947"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#F3FF6D" />
                <stop offset="1" stopColor="#3C4100" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-md sm:pl-12">
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
