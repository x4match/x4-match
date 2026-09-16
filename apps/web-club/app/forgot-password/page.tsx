'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Mail } from 'lucide-react';
import { api } from '@/lib/api';

const ACCENT = '#D7FF00';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError('El email es requerido');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setError('Email inválido');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email: trimmed });
      const devCode = response.data?.devCode as string | undefined;
      const params = new URLSearchParams({ email: trimmed });
      if (devCode) params.set('devCode', devCode);
      router.push(`/reset-password?${params.toString()}`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudo solicitar la recuperación';
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
            <KeyRound className="size-7" style={{ color: ACCENT }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">¿Olvidaste tu contraseña?</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/65">
            Ingresá el email de tu cuenta y te enviaremos un código para crear una nueva
            contraseña.
          </p>
        </div>

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
              placeholder="tu@email.com"
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
            {loading ? 'Enviando…' : 'Enviar código'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-white/65">
          Volver a{' '}
          <Link href="/login" className="font-semibold hover:underline" style={{ color: ACCENT }}>
            iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
