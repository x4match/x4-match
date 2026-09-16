'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

const ACCENT = '#D7FF00';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState(params.get('devCode') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('El email es requerido');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setError('Email inválido');
      return;
    }
    if (!code || code.trim().length !== 6) {
      setError('Ingresá el código de 6 dígitos');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });
      setSuccess(true);
      window.setTimeout(() => router.replace('/login'), 1600);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudo restablecer la contraseña';
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
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
            <ShieldCheck className="size-7" style={{ color: ACCENT }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Creá tu nueva contraseña</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/65">
            Ingresá el código de 6 dígitos y elegí una contraseña nueva.
          </p>
          {params.get('devCode') ? (
            <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
              Modo desarrollo: el código ya está precargado.
            </p>
          ) : (
            <p className="mt-3 text-xs text-white/50">
              Si el email está registrado, te enviamos un código válido por 15 minutos.
            </p>
          )}
        </div>

        {success ? (
          <p
            className="rounded-2xl px-3 py-3 text-center text-sm text-black"
            style={{ backgroundColor: ACCENT }}
          >
            Contraseña actualizada. Redirigiendo al login…
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3.5">
            <label className="relative block">
              <span className="sr-only">Email</span>
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-white/40" />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="h-12 w-full rounded-2xl border border-white/15 bg-transparent pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-(--login-accent)"
                style={{ ['--login-accent' as string]: ACCENT }}
              />
            </label>

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
                className="h-12 w-full rounded-2xl border border-white/15 bg-transparent px-4 text-sm tracking-[0.3em] text-white outline-none placeholder:tracking-normal placeholder:text-white/40 focus:border-(--login-accent)"
                style={{ ['--login-accent' as string]: ACCENT }}
              />
            </label>

            <label className="relative block">
              <span className="sr-only">Nueva contraseña</span>
              <Lock className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-white/40" />
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña"
                className="h-12 w-full rounded-2xl border border-white/15 bg-transparent pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-(--login-accent)"
                style={{ ['--login-accent' as string]: ACCENT }}
              />
            </label>

            <label className="relative block">
              <span className="sr-only">Confirmar contraseña</span>
              <Lock className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-white/40" />
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar contraseña"
                className="h-12 w-full rounded-2xl border border-white/15 bg-transparent pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-(--login-accent)"
                style={{ ['--login-accent' as string]: ACCENT }}
              />
            </label>

            {error ? (
              <p className="rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-extrabold text-black disabled:opacity-60"
              style={{ backgroundColor: ACCENT }}
            >
              {loading ? 'Guardando…' : 'Actualizar contraseña'}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-white/65">
          <Link
            href="/forgot-password"
            className="font-semibold hover:underline"
            style={{ color: ACCENT }}
          >
            Pedir otro código
          </Link>
          {' · '}
          <Link href="/login" className="hover:underline">
            Volver al login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
