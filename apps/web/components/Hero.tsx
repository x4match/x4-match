import Image from 'next/image';
import Link from 'next/link';
import jugadorHero from '@/assets/jugador-hero.png';
import wordmark from '@/assets/x4match-wordmark.svg';
import { SiteHeader } from '@/components/SiteHeader';
import { SITE } from '@/content/site';

const HERO_CARDS = [
  {
    title: 'Encontrá partidos',
    text: 'Creá tu cuenta gratis y empezá a encontrar partidos, competir y subir de nivel.',
    variant: 'bone' as const,
  },
  {
    title: 'Medí tu nivel',
    text: 'Conocé tu nivel, comparate y superá tus propios límites.',
    variant: 'ghost' as const,
  },
  {
    title: 'Competí sin fricción',
    text: 'Todo lo que necesitás para jugar y competir, en un solo lugar.',
    variant: 'volt' as const,
  },
];

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-glow" aria-hidden />
      <SiteHeader />
      <div className="container">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="hero-eyebrow">Padel competitivo en Argentina</p>
            <h1 className="hero-title">
              Jugá más,
              <br />
              gestioná mejor.
            </h1>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="#jugadores">
                Quiero jugar
              </Link>
              <Link className="btn btn-outline" href="#clubes">
                Tengo un Club
              </Link>
            </div>
            <p className="hero-login">
              ¿Ya tenés cuenta?{' '}
              <Link href={SITE.links.clubPanel}>Ingresá</Link>
            </p>
          </div>

          <div className="hero-visual">
            <Image
              className="hero-wordmark"
              src={wordmark}
              alt=""
              width={174}
              height={21}
              aria-hidden
              priority
            />
            <Image
              className="hero-player"
              src={jugadorHero}
              alt="Jugador de pádel en acción"
              width={424}
              height={636}
              priority
              sizes="(max-width: 960px) 340px, 460px"
            />
            <p className="hero-caption">
              Conectá con jugadores.
              <br />
              Encontrá partidos
            </p>
          </div>
        </div>

        <div className="hero-cards">
          {HERO_CARDS.map((card) => (
            <article key={card.title} className={`hero-card hero-card--${card.variant}`}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
