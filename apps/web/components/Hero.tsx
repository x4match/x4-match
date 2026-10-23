import Image from 'next/image';
import Link from 'next/link';
import jugadorHero from '@/assets/jugador-hero.png';
import { HeroWordmark } from '@/components/HeroWordmark';
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
      <div className="hero-floor" aria-hidden />
      <SiteHeader />
      <div className="hero-stage">
        <div className="hero-glow" aria-hidden />

        <div className="hero-visual">
          <div className="hero-band" aria-hidden>
            <HeroWordmark className="hero-wordmark" />
          </div>
          <p className="hero-caption">Conectá con jugadores. Encontrá partidos</p>
          <Image
            className="hero-player"
            src={jugadorHero}
            alt="Jugador de pádel en acción"
            width={424}
            height={636}
            priority
            sizes="(max-width: 960px) 300px, 420px"
          />
        </div>

        <div className="hero-copy">
          <p className="hero-eyebrow">Padel competitivo en Argentina</p>
          <h1 className="hero-title">
            Jugá más,
            <br />
            gestioná mejor.
          </h1>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="#registro">
              Quiero jugar
            </Link>
            <a className="btn btn-outline" href={SITE.links.clubRegister}>
              Tengo un Club
            </a>
          </div>
          <p className="hero-login">
            ¿Ya tenés cuenta? <Link href={SITE.links.clubPanel}>Ingresá</Link>
          </p>
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
