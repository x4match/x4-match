'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isPlatformAdmin, type AuthUser } from '@/lib/roles';
import { toast } from '@/lib/toast';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const token = res.data.access_token as string;
      const user = res.data.user as AuthUser;
      if (!isPlatformAdmin(user.role)) {
        const msg = 'Solo cuentas SUPER_ADMIN pueden ingresar al backoffice.';
        setError(msg);
        toast.error(msg);
        return;
      }
      login(token, user);
      toast.success('Sesión iniciada.');
      router.replace('/monitor');
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'No se pudo iniciar sesión');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <form onSubmit={onSubmit} className="login-card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <div className="ops-brand-mark" aria-hidden>
            x4
          </div>
          <p
            style={{
              color: 'var(--primary)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.18em',
              margin: 0,
            }}
          >
            X4 MATCH OPS
          </p>
        </div>
        <h1 style={{ margin: '8px 0 4px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Backoffice interno
        </h1>
        <p style={{ color: 'var(--muted-strong)', marginBottom: 20, fontSize: 14 }}>
          Monitoreo, trials, clubes y módulos de la plataforma.
        </p>
        <label className="login-field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="login-field">
          <span>Contraseña</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? (
          <p role="alert" style={{ color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>
            {error}
          </p>
        ) : null}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
