'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { api } from '@/lib/api';

const ACCENT = '#D7FF00';

function AuthTiras() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-4 left-[10%] top-[20%] flex w-14 items-stretch justify-center sm:w-20"
    >
      <svg width="67" height="575" viewBox="0 0 67 575" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M65.0642 495.242V512.666L41.7184 534.673L65.0642 554.385V573.466L32.7861 542.937L1.52673 572.699L1.52673 554.378L23.086 534.156L1.52673 515.075L1.52673 496.633L32.9153 524.616L65.0642 495.234V495.242Z"
          stroke="url(#paint0_linear_forgot)"
          strokeMiterlimit="10"
        />
        <path
          d="M51.1599 420.004V434.76H65.8317L65.8317 447.607H51.1599L51.1599 493.782H39.4224L1.27563 448.117L1.27563 434.76H39.4224V420.004H51.1599ZM39.4224 447.607H16.1983L39.4224 477.118L39.4224 447.607Z"
          stroke="url(#paint1_linear_forgot)"
          strokeMiterlimit="10"
        />
        <path
          d="M65.1152 327.693V340.441H19.0445L41.692 367.777L19.0445 395.365H65.1152V407.743H1.48975L1.48975 394.994L25.031 367.777L1.48975 340.189L1.48975 327.676H65.1152V327.693Z"
          stroke="url(#paint2_linear_forgot)"
          strokeWidth="0.75"
          strokeMiterlimit="10"
        />
        <path
          d="M65.1152 227.323L65.1152 240.932L51.2367 248.909L51.2367 288.639L65.1152 296.244V310.342L1.48975 275.89L1.48975 262.281L65.1152 227.34V227.323ZM39.6684 255.283L13.8337 269.01L39.6684 282.618V255.283Z"
          stroke="url(#paint3_linear_forgot)"
          strokeWidth="0.75"
          strokeMiterlimit="10"
        />
        <path
          d="M13.0758 165.147L13.0758 192.112H65.133V206.463H13.0758L13.0758 233.309H1.74365L1.74365 165.147H13.0758Z"
          stroke="url(#paint4_linear_forgot)"
          strokeWidth="0.75"
          strokeMiterlimit="10"
        />
        <path
          d="M48.874 86.9351C54.8099 86.9351 58.8065 88.0144 60.8301 90.1898C62.8706 92.3651 63.8824 96.3449 63.8824 102.146L63.8824 138.554C63.8824 144.355 62.8706 148.335 60.8301 150.51C58.7896 152.669 54.8099 153.765 48.874 153.765H15.4002C9.54862 153.765 5.58574 152.685 3.49468 150.51C1.42049 148.352 0.375 144.355 0.375 138.554L0.375 102.146C0.459317 92.3315 3.98372 87.2724 10.9314 86.952H20.2232V101.168H11.6903L11.6903 139.549H51.9094L51.9094 101.168H42.6177V86.952H48.8572L48.874 86.9351Z"
          stroke="url(#paint5_linear_forgot)"
          strokeWidth="0.75"
          strokeMiterlimit="10"
        />
        <path
          d="M65.1157 0.374945V14.7256H39.0281L39.0281 57.997H65.1157V72.2129L1.60828 72.2129L1.60828 57.997H26.1782L26.1782 14.7256H1.60828L1.60828 0.374945L65.1157 0.374945Z"
          stroke="url(#paint6_linear_forgot)"
          strokeWidth="0.75"
          strokeMiterlimit="10"
        />
        <defs>
          <linearGradient
            id="paint0_linear_forgot"
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
            id="paint1_linear_forgot"
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
            id="paint2_linear_forgot"
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
            id="paint3_linear_forgot"
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
            id="paint4_linear_forgot"
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
            id="paint5_linear_forgot"
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
            id="paint6_linear_forgot"
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
  );
}

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
        <AuthTiras />

        <div className="relative z-10 mx-auto w-full max-w-md sm:pl-12">
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
