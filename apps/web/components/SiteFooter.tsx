import Image from 'next/image';
import Link from 'next/link';
import logo from '@/assets/x4match-large.svg';
import { SITE } from '@/content/site';

const LEGAL = [
  { href: '/terminos', label: 'Términos jugadores' },
  { href: '/terminos-clubes', label: 'Términos clubes' },
  { href: '/privacidad', label: 'Privacidad' },
  { href: '/cookies', label: 'Cookies' },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="site-footer-cols">
          <p className="site-footer-tagline">Padel competitivo en Argentina</p>

          <div>
            <p className="site-footer-heading">Legal</p>
            <ul className="site-footer-list">
              {LEGAL.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="site-footer-heading">Contacto</p>
            <ul className="site-footer-list">
              <li>
                <a href={`mailto:${SITE.emails.hola}`}>{SITE.emails.hola}</a>
              </li>
              <li>
                <a href={`mailto:${SITE.emails.clubes}`}>{SITE.emails.clubes}</a>
              </li>
              <li>
                <a href={`mailto:${SITE.emails.legal}`}>{SITE.emails.legal}</a>
              </li>
              <li>
                <Link href="/eliminar-cuenta">Eliminar cuenta</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="site-footer-brand">
          <Image src={logo} alt="X4MATCH" width={174} height={21} />
        </div>

        <div className="site-footer-line" aria-hidden />
      </div>
    </footer>
  );
}
