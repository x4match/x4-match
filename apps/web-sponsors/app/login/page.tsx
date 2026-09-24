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
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(215,255,0,0.16), transparent 40%), radial-gradient(circle at 80% 10%, rgba(3,172,14,0.12), transparent 35%)',
        }}
      />
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md space-y-5 rounded-2xl border border-border bg-card/90 p-8 shadow-2xl backdrop-blur-md"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground"
            aria-hidden
          >
            x4
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">x4 partners</p>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Panel del partner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestioná tu tienda, productos y pedidos.
          </p>
        </div>
        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            className="min-h-11"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            className="min-h-11"
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
  );
}

export default function PartnerLoginPage() {
  return (
    <Suspense fallback={<div className="dark min-h-screen bg-background p-8 text-muted-foreground">Cargando…</div>}>
      <LoginForm />
    </Suspense>
  );
}
