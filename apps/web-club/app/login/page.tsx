'use client';

import { FormEvent, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { isClub } from '@/lib/roles';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    params.get('error') === 'role' ? 'Solo cuentas de club pueden ingresar.' : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const token = response.data.access_token as string;
      const user = response.data.user as AuthUser;
      if (!isClub(user.role)) {
        setError('Solo cuentas de club pueden ingresar a este panel.');
        return;
      }
      login(token, user);
      const next = params.get('next') || '/panel';
      router.replace(next);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudo iniciar sesión';
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,197,24,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(255,229,102,0.06),_transparent_50%)]" />
      <Card className="relative z-10 w-full max-w-md border-border/60 bg-card/95 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            x4 match
          </p>
          <CardTitle className="text-2xl font-extrabold tracking-tight">
            Panel de Clubes
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Gestioná tu club: Smart Fill, facturación, tienda y más.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            {error ? (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full rounded-xl" disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿No tenés cuenta?{' '}
              <Link href="/register" className="text-primary underline-offset-2 hover:underline">
                Registrarse
              </Link>
            </p>
            <p className="text-center text-xs text-muted-foreground">
              ¿Todavía no conocés el producto?{' '}
              <Link href="/" className="text-primary underline-offset-2 hover:underline">
                Volver al inicio
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  );
}
