'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { isClub } from '@/lib/roles';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthUser } from '@/lib/types';

const ACCENT = '#D7FF00';
const RESEND_COOLDOWN_SECONDS = 60;

function apiErrorMessage(err: unknown, fallback: string) {
  const message =
    (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ||
    fallback;
  return Array.isArray(message) ? message.join(', ') : message;
}

function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const email = params.get('email') || '';
  const nextPath = params.get('next') || '/panel';

  const [devCode, setDevCode] = useState(params.get('devCode') || '');
  const [code, setCode] = useState(devCode);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (code.length !== 6) {
      setError('Ingresá el código de 6 dígitos');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/verify-email', { email, code });
      if (response.data?.pendingVerification) {
        router.replace(`/pendiente-verificacion?email=${encodeURIComponent(email)}`);
        return;
      }
      const user = response.data.user as AuthUser;
      if (!isClub(user.role)) {
        setError('Email verificado. Esta cuenta no es de club: ingresá desde la app.');
        return;
      }
      login(response.data.access_token as string, user);
      router.replace(nextPath);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'No se pudo verificar el código'));
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (cooldown > 0 || resending) return;
    setError(null);
    setResending(true);
    try {
      const response = await api.post('/auth/resend-verification', { email });
      const nextDevCode = response.data?.devCode as string | undefined;
      if (nextDevCode) {
        setDevCode(nextDevCode);
        setCode(nextDevCode);
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setInfo('Te enviamos un código nuevo. Revisá también la carpeta de spam.');
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'No se pudo reenviar el código'));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-4 flex size-16 items-center justify-center rounded-[22px]"
            style={{ backgroundColor: 'rgba(215,255,0,0.15)' }}
          >
            <MailCheck className="size-7" style={{ color: ACCENT }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Verificá tu email</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/65">
            Te enviamos un código de 6 dígitos a <span className="text-white">{email}</span>.
            Ingresalo para activar tu cuenta.
          </p>
          {devCode ? (
            <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
              Modo desarrollo: el código ya está precargado.
            </p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5">
          <label className="relative block">
            <span className="sr-only">Código</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Código de 6 dígitos"
              className="h-12 w-full rounded-2xl border border-white/15 bg-transparent px-4 text-center text-lg tracking-[0.5em] text-white outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-white/40 focus:border-(--login-accent)"
              style={{ ['--login-accent' as string]: ACCENT }}
            />
          </label>

          {error ? (
            <p className="rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          ) : null}
          {info ? (
            <p className="rounded-2xl bg-white/5 px-3 py-2 text-sm text-white/75">{info}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-extrabold text-black disabled:opacity-60"
            style={{ backgroundColor: ACCENT }}
          >
            {loading ? 'Verificando…' : 'Verificar'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-white/65">
          <button
            type="button"
            onClick={onResend}
            disabled={cooldown > 0 || resending}
            className="font-semibold hover:underline disabled:cursor-not-allowed disabled:text-white/40 disabled:no-underline"
            style={cooldown > 0 || resending ? undefined : { color: ACCENT }}
          >
            {cooldown > 0 ? `Reenviar código en ${cooldown}s` : 'Reenviar código'}
          </button>
          {' · '}
          <Link href="/login" className="hover:underline">
            Volver al login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
