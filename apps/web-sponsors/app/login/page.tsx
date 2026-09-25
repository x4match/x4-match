'use client';

import { Suspense, FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isPartner } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { access_token, user } = res.data;
      if (!isPartner(user.role)) {
        setError('Esta cuenta no es partner. Usá web-admin si sos operador, o pedí acceso PARTNER.');
        return;
      }
      login(access_token, user);
      router.replace(search.get('next') || '/dashboard/resumen');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudo iniciar sesión';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background:
                'radial-gradient(circle at 20% 20%, rgba(215,255,0,0.2), transparent 42%), radial-gradient(circle at 80% 70%, rgba(3,172,14,0.14), transparent 40%)',
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground">
                x4
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">x4 match</p>
            </div>
            <h1 className="mt-16 max-w-md text-4xl font-extrabold tracking-tight text-white xl:text-5xl">
              Commerce OS para partners
            </h1>
            <p className="mt-4 max-w-sm text-base text-zinc-300">
              Productos, pedidos, pagos y tu tienda pública — en un solo panel.
            </p>
          </div>
          <ul className="relative space-y-3 text-sm text-zinc-300">
            <li className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              Catálogo y descuentos
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              Mercado Pago + WhatsApp
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              Dominio propio
            </li>
          </ul>
        </aside>

        <div className="relative flex items-center justify-center bg-zinc-950 p-6">
          <div
            className="pointer-events-none absolute inset-0 lg:hidden"
            aria-hidden
            style={{
              background:
                'radial-gradient(circle at 50% 0%, rgba(215,255,0,0.12), transparent 50%)',
            }}
          />
          <form
            onSubmit={onSubmit}
            className="relative w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-zinc-900 p-8 text-white shadow-2xl"
          >
            <div className="lg:hidden">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">x4 partners</p>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white">Ingresá al panel</h2>
              <p className="mt-1 text-sm text-zinc-400">Gestioná tu tienda y pedidos.</p>
            </div>
            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              >
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-200">
                Email
              </Label>
              <Input
                id="email"
                className="min-h-11 border-white/15 bg-zinc-950 text-white placeholder:text-zinc-500"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-200">
                Contraseña
              </Label>
              <Input
                id="password"
                className="min-h-11 border-white/15 bg-zinc-950 text-white placeholder:text-zinc-500"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="min-h-11 w-full font-bold">
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function PartnerLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="dark flex min-h-screen items-center justify-center bg-background text-zinc-300">
          Cargando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
