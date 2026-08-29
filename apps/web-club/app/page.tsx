'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="dark min-h-screen bg-black text-[#FAFAFA]">
      {/* Full-bleed atmosphere — court + light */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,rgba(245,197,24,0.28),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_50%_at_100%_100%,rgba(255,229,102,0.1),transparent_45%)]" />
        {/* Court lines — edge to edge */}
        <div className="absolute inset-0 opacity-[0.12]">
          <div className="absolute left-[8%] right-[8%] top-[22%] h-px bg-[#F5C518]" />
          <div className="absolute bottom-[18%] left-[8%] right-[8%] h-px bg-[#F5C518]" />
          <div className="absolute bottom-[18%] left-[8%] top-[22%] w-px bg-[#F5C518]" />
          <div className="absolute bottom-[18%] right-[8%] top-[22%] w-px bg-[#F5C518]" />
          <div className="absolute left-1/2 top-[22%] h-[60%] w-px -translate-x-1/2 bg-[#F5C518]" />
          <div className="absolute left-[8%] top-1/2 h-px w-[84%] -translate-y-1/2 bg-[#F5C518]/70" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />
      </div>

      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <p className="text-sm font-extrabold tracking-tight text-[#F5C518] sm:text-base">
          x4 match
        </p>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/precios"
            className="rounded-full px-3 py-2 text-sm text-[#A3A3A3] transition-colors hover:text-[#FAFAFA]"
          >
            Precios
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-[#FAFAFA] transition-colors hover:border-white/30 hover:bg-white/5"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-[#FFE566] px-4 py-2 text-sm font-bold text-[#0A0A0A] transition-transform hover:scale-[1.03] active:scale-[0.97]"
          >
            Registrarse
          </Link>
        </nav>
      </header>

      <main className="relative z-10">
        {/* Hero — brand first, one job */}
        <section className="relative mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-6xl flex-col justify-center px-5 pb-20 pt-6 sm:px-8">
          <div className="max-w-4xl">
            <h1 className="animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both">
              <span className="block text-[clamp(3.25rem,12vw,7rem)] font-extrabold leading-[0.88] tracking-[-0.045em] text-[#F5C518]">
                x4 match
              </span>
              <span className="mt-4 block max-w-2xl text-[clamp(1.5rem,4.5vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[#FAFAFA]">
                La cancha vacía ya es plata.
              </span>
            </h1>
            <p className="mt-7 max-w-lg animate-in fade-in slide-in-from-bottom-3 fill-mode-both text-base leading-relaxed text-[#A3A3A3] duration-700 sm:text-lg [animation-delay:120ms]">
              Smart Fill llena turnos solos. Cobrá, medí y hacé comunidad — sin perseguir
              jugadores por WhatsApp.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-700 [animation-delay:220ms]">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-full bg-[#FFE566] px-7 py-3.5 text-sm font-bold text-[#0A0A0A] shadow-[0_0_40px_rgba(245,197,24,0.25)] transition-transform hover:scale-[1.03] active:scale-[0.97]"
              >
                Empezar ahora
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/precios"
                className="inline-flex items-center rounded-full px-5 py-3.5 text-sm font-semibold text-[#A3A3A3] transition-colors hover:text-[#FAFAFA]"
              >
                Ver planes
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-white/8 bg-[#0A0A0A]/80 backdrop-blur-sm">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-3">
            {[
              {
                title: 'Ocupación automática',
                body: 'Si el turno valle sigue vacío, se publica el partido y se avisa sola.',
              },
              {
                title: 'Cobro sin persecución',
                body: 'Señas online, movimientos claros y confirmación en recepción.',
              },
              {
                title: 'Más que reservas',
                body: 'Tienda, ranking, campañas a inactivos y un gerente que te dice qué hacer hoy.',
              },
            ].map((item, i) => (
              <div key={item.title}>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F5C518]">
                  0{i + 1}
                </p>
                <h2 className="mt-3 text-xl font-bold tracking-tight">{item.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/8">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-16 sm:flex-row sm:items-center sm:px-8">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Menos planillas. Más partidos jugados.
              </h2>
              <p className="mt-2 text-sm text-[#A3A3A3]">
                Creá tu cuenta de club o iniciá sesión para entrar al panel.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-[#F5C518] px-6 py-3.5 text-sm font-bold text-[#0A0A0A] transition-transform hover:scale-[1.02] active:scale-[0.97]"
              >
                Registrarse
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-[#FAFAFA] transition-colors hover:border-white/30 hover:bg-white/5"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/8 px-5 py-8 text-center text-xs text-[#737373] sm:px-8">
          © {new Date().getFullYear()} x4 match · Panel de clubes
        </footer>
      </main>
    </div>
  );
}
