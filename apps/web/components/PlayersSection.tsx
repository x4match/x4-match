import Image from 'next/image';
import cancha from '@/assets/cancha.png';
import pelota from '@/assets/pelota.png';
import { HeroWordmark } from '@/components/HeroWordmark';

const FEATURES = [
  {
    title: 'Partidos abiertos',
    text: 'Unite a partidos cerca tuyo según tu nivel y disponibilidad',
  },
  {
    title: 'Ranking real',
    text: 'Subí de categoría con resultados verificados y historial competitivo.',
  },
  {
    title: 'Matchmaking',
    text: 'Encontrá los 3 jugadores que faltan sin grupos de WhatsApp.',
  },
  {
    title: 'Siempre gratis',
    text: 'La app para jugadores no tiene costo.',
  },
];

export function PlayersSection() {
  return (
    <section id="jugadores" className="players">
      <div className="players-stage">
        <div className="players-banner">
          <div className="players-banner-media" aria-hidden>
            <Image
              className="players-cancha"
              src={cancha}
              alt=""
              width={891}
              height={376}
              sizes="(max-width: 960px) 100vw, 640px"
            />
          </div>
          <div className="players-banner-copy">
            <HeroWordmark className="players-wordmark" gradientId="playersMatchStroke" />
            <h2 className="players-title">Para jugadores</h2>
            <p className="players-subtitle">
              Encontrá partido, medí tu nivel
              <br />
              y competí sin fricción
            </p>
          </div>
        </div>

        <div className="players-grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="players-feature">
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>

        <Image
          className="players-ball"
          src={pelota}
          alt=""
          width={297}
          height={198}
          aria-hidden
        />
      </div>
    </section>
  );
}
