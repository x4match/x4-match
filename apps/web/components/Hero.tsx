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
      <div className="hero-glow" aria-hidden />
      <SiteHeader />
      <div className="hero-stage">
        <div className="hero-visual">
          <div className="hero-brand" aria-hidden>
            <span className="hero-brand-line hero-brand-line--top" />
            <HeroWordmark className="hero-wordmark" />
            <span className="hero-brand-line hero-brand-line--bottom" />
            <p className="hero-caption">
              Conectá con jugadores.
              <br />
              Encontrá partidos
            </p>
          </div>
          <Image
            className="hero-player"
            src={jugadorHero}
            alt="Jugador de pádel en acción"
            width={424}
            height={636}
            priority
            sizes="(max-width: 960px) 340px, 460px"
          />
        </div>

        <div className="container hero-foreground">
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

          <div className="hero-cards">
            {HERO_CARDS.map((card) => (
              <article key={card.title} className={`hero-card hero-card--${card.variant}`}>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
