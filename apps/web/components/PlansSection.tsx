import Image from 'next/image';
import Link from 'next/link';
import { Check } from 'lucide-react';
import logo from '@/assets/x4match-large.svg';
import { CLUB_PLANS, SITE } from '@/content/site';

export function PlansSection() {
  return (
    <section id="planes" className="plans">
      <div className="container plans-inner">
        <div className="plans-header">
          <h2 className="plans-title">Planes para clubes</h2>
          <p className="plans-subtitle">
            90 días gratis. Después $49.900 + IVA/mes. Sin comisión por reserva.
          </p>
        </div>

        <div className="plans-stage">
          <Image
            className="plans-watermark"
            src={logo}
            alt=""
            width={174}
            height={21}
            aria-hidden
          />

          <div className="plans-grid">
            {CLUB_PLANS.map((plan) => (
              <article
                key={plan.name}
                className={`plan-card${plan.highlighted ? ' plan-card--featured' : ''}`}
              >
                <div className="plan-card-top">
                  <div className="plan-heading">
                    <h3 className="plan-name">{plan.name}</h3>
                    {plan.period ? <span className="plan-period">{plan.period}</span> : null}
                  </div>
                  <span className={`plan-badge${plan.highlighted ? ' plan-badge--volt' : ''}`}>
                    {plan.badge}
                  </span>
                </div>

                <p className="plan-desc">{plan.description}</p>

                <ul className="plan-features">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <span className="plan-check" aria-hidden>
                        <Check size={12} strokeWidth={3} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>

        <div id="contacto" className="plans-cta">
          <h2 className="plans-cta-title">
            ¿Listo para <span>sumarte?</span>
          </h2>
          <div className="plans-cta-actions">
            <a
              className="btn btn-primary"
              href={`mailto:${SITE.emails.hola}?subject=Quiero%20probar%20x4%20match`}
            >
              Conectar jugadores
            </a>
            <Link className="btn btn-outline" href={SITE.links.clubPanel}>
              Tengo un Club
            </Link>
          </div>
          <div className="plans-glow-line" aria-hidden />
        </div>
      </div>
    </section>
  );
}
