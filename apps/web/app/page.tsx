import Link from 'next/link';
import {
  Calendar,
  CreditCard,
  Trophy,
  Users,
} from 'lucide-react';
import { Hero } from '@/components/Hero';
import { PlansSection } from '@/components/PlansSection';
import { PlayersSection } from '@/components/PlayersSection';
import { SITE } from '@/content/site';

const CLUB_FEATURES = [
  { icon: Calendar, title: 'Turnos y ocupación', text: 'Publicá horarios, reducí huecos muertos y llená canchas.' },
  { icon: CreditCard, title: 'Tu Mercado Pago', text: 'Cobrá señas con la cuenta del club. x4 match no retiene tu dinero.' },
  { icon: Trophy, title: 'Torneos y tienda', text: 'Inscripciones, extras y productos desde el mismo panel.' },
  { icon: Users, title: 'Clientes y ranking', text: 'Conocé quién juega en tu sede y fidelizá con datos reales.' },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      <PlayersSection />

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

      <PlansSection />
    </>
  );
}
