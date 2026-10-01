'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Clock, XCircle } from 'lucide-react';

const ACCENT = '#D7FF00';

function PendingVerificationContent() {
  const params = useSearchParams();
  const rejected = params.get('state') === 'rejected';
  const email = params.get('email');

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 py-12 text-white">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto flex size-18 items-center justify-center rounded-3xl"
          style={{ backgroundColor: rejected ? 'rgba(239,68,68,0.15)' : 'rgba(215,255,0,0.15)' }}
        >
          {rejected ? (
            <XCircle className="size-9 text-red-500" aria-hidden />
          ) : (
            <Clock className="size-9" style={{ color: ACCENT }} aria-hidden />
          )}
        </div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.03em]">
          {rejected ? 'Registro no aprobado' : 'Pendiente de verificación'}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-[15px]">
          {rejected
            ? 'No pudimos verificar el registro de tu club. Escribinos a soporte para revisarlo.'
            : 'Recibimos el registro de tu club. El equipo de x4 match lo va a revisar y vas a poder ingresar apenas esté aprobado.'}
        </p>
        {email ? <p className="mt-4 text-sm text-white/50">Cuenta: {email}</p> : null}
        <Link
          href="/login"
          className="mt-9 inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-black"
          style={{ backgroundColor: ACCENT }}
        >
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}

export default function PendingVerificationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <PendingVerificationContent />
    </Suspense>
  );
}
