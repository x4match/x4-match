'use client';

import { FormEvent, Suspense, useState } from 'react';
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

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre del responsable es requerido.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        email: email.trim(),
        password,
        name: name.trim(),
        role: 'CLUB_ADMIN',
      });
      const token = response.data.access_token as string;
      const user = response.data.user as AuthUser;
      if (!isClub(user.role)) {
        setError('No se pudo crear una cuenta de club. Probá de nuevo.');
        return;
      }
      login(token, user);
      const next = params.get('next') || '/perfil';
      router.replace(next);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message || 'No se pudo crear la cuenta';
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
            Crear cuenta de club
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Registrate para gestionar turnos, facturación, tienda y más.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del responsable</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-xl"
                placeholder="Ej: María Gómez"
              />
            </div>
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
                placeholder="club@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="rounded-xl"
              />
            </div>
            {error ? (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full rounded-xl" disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tenés cuenta?{' '}
              <Link href="/login" className="text-primary underline-offset-2 hover:underline">
                Iniciar sesión
              </Link>
            </p>
            <p className="text-center text-xs text-muted-foreground">
              <Link href="/" className="underline-offset-2 hover:underline">
                Volver al inicio
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <RegisterForm />
    </Suspense>
  );
}
