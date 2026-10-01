import { Monitor, Smartphone } from 'lucide-react';
import { SITE } from '@/content/site';

export function SignupSection() {
  return (
    <section id="registro" className="signup">
      <div className="container signup-inner">
        <h2 className="signup-title">
          ¿Listo para <span>sumarte?</span>
        </h2>
        <p className="signup-subtitle">Elegí cómo querés usar x4 match</p>

        <div className="signup-grid">
          <article className="signup-card">
            <span className="signup-icon" aria-hidden>
              <Smartphone size={22} />
            </span>
            <p className="signup-eyebrow">Jugadores</p>
            <h3 className="signup-card-title">Descargá la app</h3>
            <p className="signup-card-text">
              Creá tu cuenta gratis desde el celular y empezá a encontrar partidos.
            </p>
            <div className="signup-actions">
              <a className="btn btn-primary" href={SITE.links.appStore}>
                App Store
              </a>
              <a className="btn btn-outline" href={SITE.links.playStore}>
                Google Play
              </a>
            </div>
          </article>

          <article className="signup-card">
            <span className="signup-icon" aria-hidden>
              <Monitor size={22} />
            </span>
            <p className="signup-eyebrow">Clubes</p>
            <h3 className="signup-card-title">Visitá el panel web</h3>
            <p className="signup-card-text">
              Registrá tu club y gestioná canchas, turnos y cobros desde la computadora.
            </p>
            <div className="signup-actions">
              <a className="btn btn-primary" href={SITE.links.clubRegister}>
                Registrar mi club
              </a>
              <a className="btn btn-outline" href={SITE.links.clubPanel}>
                Ya tengo cuenta
              </a>
            </div>
          </article>
        </div>

        <div className="signup-glow-line" aria-hidden />
      </div>
    </section>
  );
}
