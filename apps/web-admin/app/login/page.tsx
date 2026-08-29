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
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form onSubmit={onSubmit} className="card" style={{ width: '100%', maxWidth: 420 }}>
        <p style={{ color: 'var(--primary)', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em' }}>
          X4 MATCH OPS
        </p>
        <h1 style={{ margin: '8px 0 4px', fontSize: 28 }}>Backoffice interno</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 14 }}>
          Monitoreo, trials, clubes y módulos de la plataforma.
        </p>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Email</span>
          <input className="input" style={{ marginTop: 6 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Contraseña</span>
          <input className="input" style={{ marginTop: 6 }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error ? <p style={{ color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>{error}</p> : null}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
