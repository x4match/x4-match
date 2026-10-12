'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Eye,
  EyeOff,
  LineChart,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { Sparkline } from '@/components/charts/Sparkline';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isPlatformAdmin, type AuthUser } from '@/lib/roles';
import { toast } from '@/lib/toast';

const FEATURES = [
  { icon: LineChart, title: 'Monitoreo en vivo', detail: 'Usuarios, partidos y cobros semana a semana.' },
  { icon: BadgeCheck, title: 'Altas de clubes', detail: 'Revisá y aprobá registros en un clic.' },
  { icon: Timer, title: 'Trials y facturación', detail: 'Anticipate a vencimientos y suspensiones.' },
];

const PREVIEW_SERIES = [18, 22, 19, 27, 31, 29, 36, 41, 38, 47, 52, 58];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <section className="login-showcase" aria-hidden>
        <div className="login-showcase-brand">
          <span className="ops-brand-mark">x4</span>
          <span>
            <span className="ops-brand-kicker">X4 MATCH</span>
            <span className="ops-brand-title">Ops Console</span>
          </span>
        </div>

        <div className="login-showcase-copy">
          <h2 className="login-showcase-title">
            Toda la operación de la red de pádel, <span>en un solo lugar.</span>
          </h2>
          <ul className="login-features">
            {FEATURES.map(({ icon: Icon, title, detail }) => (
              <li key={title}>
                <span className="login-feature-icon">
                  <Icon size={16} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="login-preview">
          <div className="login-preview-head">
            <span className="live-dot" />
            <span>Operación en vivo</span>
          </div>
          <div className="login-preview-body">
            <span className="login-preview-value">Tendencias semanales</span>
            <Sparkline values={PREVIEW_SERIES} />
          </div>
        </div>
      </section>

      <main className="login-panel">
        <form onSubmit={onSubmit} className="login-card">
          <div className="login-card-brand">
            <span className="ops-brand-mark" aria-hidden>
              x4
            </span>
            <span className="ops-brand-kicker">X4 MATCH OPS</span>
          </div>

          <h1 className="login-title">Ingresá al backoffice</h1>
          <p className="login-subtitle">Usá tu cuenta de super admin de x4 match.</p>

          <label className="login-field" htmlFor="login-email">
            <span>Email</span>
          </label>
          <div className="input-icon-wrap">
            <Mail size={16} aria-hidden className="input-icon" />
            <input
              id="login-email"
              className="input input--with-icon"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="vos@x4match.com"
              aria-invalid={Boolean(error)}
              required
              autoFocus
            />
          </div>

          <label className="login-field" htmlFor="login-password">
            <span>Contraseña</span>
          </label>
          <div className="input-icon-wrap">
            <Lock size={16} aria-hidden className="input-icon" />
            <input
              id="login-password"
              className="input input--with-icon input--with-action"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-invalid={Boolean(error)}
              required
            />
            <button
              type="button"
              className="input-action"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            </button>
          </div>

          {error ? (
            <p role="alert" className="login-error">
              <AlertCircle size={16} aria-hidden />
              <span>{error}</span>
            </p>
          ) : null}

          <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={16} aria-hidden className="spin" />
                Ingresando…
              </>
            ) : (
              <>
                Ingresar
                <ArrowRight size={16} aria-hidden />
              </>
            )}
          </button>

          <p className="login-footnote">
            <ShieldCheck size={14} aria-hidden />
            Acceso restringido al equipo de operaciones.
          </p>
        </form>
      </main>
    </div>
  );
}
