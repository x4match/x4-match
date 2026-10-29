'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthWordmark } from '@/components/auth/AuthWordmark';

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
            Ingresá el email de tu cuenta y te enviamos un código para crear una nueva contraseña
          </p>

          <form
            onSubmit={onSubmit}
            className="mt-9 space-y-3.5"
            style={{ ['--login-accent' as string]: ACCENT }}
          >
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
              />
            </label>

            {error ? (
              <p className="rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-extrabold uppercase tracking-[0.08em] text-black transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
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
