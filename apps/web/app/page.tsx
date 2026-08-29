import Link from 'next/link';
import {
  Calendar,
  CreditCard,
  Smartphone,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { CLUB_PLANS, SITE } from '@/content/site';

const PLAYER_FEATURES = [
  { icon: Users, title: 'Partidos abiertos', text: 'Unite a partidos cerca tuyo según tu nivel y disponibilidad.' },
  { icon: Trophy, title: 'Ranking real', text: 'Subí de categoría con resultados verificados y historial competitivo.' },
  { icon: Zap, title: 'Matchmaking', text: 'Encontrá los 3 jugadores que faltan sin grupos eternos de WhatsApp.' },
  { icon: Smartphone, title: 'Siempre gratis', text: 'La app para jugadores no tiene costo. Pagás solo lo que acuerdes con el club.' },
];

const CLUB_FEATURES = [
  { icon: Calendar, title: 'Turnos y ocupación', text: 'Publicá horarios, reducí huecos muertos y llená canchas.' },
  { icon: CreditCard, title: 'Tu Mercado Pago', text: 'Cobrá señas con la cuenta del club. x4 match no retiene tu dinero.' },
  { icon: Trophy, title: 'Torneos y tienda', text: 'Inscripciones, extras y productos desde el mismo panel.' },
  { icon: Users, title: 'Clientes y ranking', text: 'Conocé quién juega en tu sede y fidelizá con datos reales.' },
];

export default function HomePage() {
  return (
    <>
      <section style={{ position: 'relative', overflow: 'hidden', padding: '96px 0 72px' }}>
        <div className="hero-glow" />
        <div className="container" style={{ position: 'relative' }}>
          <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 16px' }}>
            Pádel competitivo en Argentina
          </p>
          <h1 className="section-title" style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', maxWidth: 720, lineHeight: 1.05 }}>
            Jugá más. <span className="gradient-text">Gestioná mejor.</span>
          </h1>
          <p className="section-subtitle" style={{ fontSize: '1.2rem', marginTop: 20 }}>
            {SITE.description}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32 }}>
            <Link className="btn btn-primary" href="#jugadores">
              Soy jugador
            </Link>
            <Link className="btn btn-outline" href="#clubes">
              Tengo un club
            </Link>
          </div>
        </div>
      </section>

      <section id="jugadores" className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <h2 className="section-title">Para jugadores</h2>
          <p className="section-subtitle">Encontrá partido, medí tu nivel y competí sin fricción.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {PLAYER_FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card">
                <Icon size={22} color="var(--primary)" style={{ marginBottom: 12 }} />
                <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{title}</h3>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15 }}>{text}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 24, color: 'var(--muted)', fontSize: 14 }}>
            Próximamente en App Store y Google Play. Mientras tanto, pedí acceso anticipado a{' '}
            <a href={`mailto:${SITE.emails.hola}`} style={{ color: 'var(--primary)' }}>
              {SITE.emails.hola}
            </a>
            .
          </p>
        </div>
      </section>

      <section id="clubes" className="section" style={{ background: 'var(--surface)' }}>
        <div className="container">
          <h2 className="section-title">Para clubes</h2>
          <p className="section-subtitle">
            Panel de gestión, trial de 90 días y cobros con tu propia cuenta de Mercado Pago.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {CLUB_FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card" style={{ background: 'var(--surface2)' }}>
                <Icon size={22} color="var(--primary)" style={{ marginBottom: 12 }} />
                <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{title}</h3>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15 }}>{text}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 28 }}>
            <Link className="btn btn-primary" href={SITE.links.clubPanel}>
              Entrar al panel club
            </Link>
          </div>
        </div>
      </section>

      <section id="planes" className="section">
        <div className="container">
          <h2 className="section-title">Planes para clubes</h2>
          <p className="section-subtitle">Empezá gratis 90 días. Sin comisión sobre señas de jugadores.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {CLUB_PLANS.map((plan) => (
              <div
                key={plan.name}
                className="card"
                style={{
                  borderColor: plan.highlighted ? 'rgba(245,197,24,0.45)' : undefined,
                  boxShadow: plan.highlighted ? '0 0 0 1px rgba(245,197,24,0.2)' : undefined,
                }}
              >
                {plan.highlighted ? (
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#111', background: 'var(--primary)', padding: '4px 10px', borderRadius: 999, display: 'inline-block', marginBottom: 12 }}>
                    Más elegido
                  </span>
                ) : null}
                <h3 style={{ margin: '0 0 4px', fontSize: 22 }}>{plan.name}</h3>
                <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 14 }}>{plan.description}</p>
                <p style={{ margin: '0 0 16px' }}>
                  <strong style={{ fontSize: 28 }}>{plan.price}</strong>
                  {plan.period ? <span style={{ color: 'var(--muted)', marginLeft: 6 }}>{plan.period}</span> : null}
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, color: '#d4d4d4', fontSize: 14, display: 'grid', gap: 8 }}>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 20, fontSize: 13, color: 'var(--muted)' }}>
            Precios en ARS + IVA. Plan anual con ~2 meses bonificados. Consultá descuento fundador escribiendo a{' '}
            <a href={`mailto:${SITE.emails.clubes}`} style={{ color: 'var(--primary)' }}>
              {SITE.emails.clubes}
            </a>
            .
          </p>
        </div>
      </section>

      <section id="contacto" className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <h2 className="section-title" style={{ marginBottom: 12 }}>
              ¿Listo para sumarte?
            </h2>
            <p style={{ color: 'var(--muted)', maxWidth: 520, margin: '0 auto 24px' }}>
              Jugadores: pedí acceso a la app. Clubes: agendá una demo y empezá tu trial de 90 días.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
              <a className="btn btn-primary" href={`mailto:${SITE.emails.hola}?subject=Quiero%20probar%20x4%20match`}>
                Contactar jugadores
              </a>
              <a className="btn btn-outline" href={`mailto:${SITE.emails.clubes}?subject=Demo%20panel%20club`}>
                Demo para mi club
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
