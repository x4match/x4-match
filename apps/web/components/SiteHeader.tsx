import Image from 'next/image';
import Link from 'next/link';
import logo from '@/assets/x4match-large.svg';
import { SITE } from '@/content/site';

const NAV = [
  { href: '/#jugadores', label: 'Jugadores' },
  { href: '/#clubes', label: 'Clubes' },
  { href: '/#planes', label: 'Planes' },
  { href: '/#contacto', label: 'Contacto' },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" className="site-logo">
          <Image src={logo} alt="X4MATCH" width={174} height={21} priority />
          <p className="site-logo-tag">Jugá. Competí. Subí de nivel.</p>
        </Link>

        <nav className="site-nav">
          <div className="site-nav-links">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
          <Link className="btn btn-primary" href={SITE.links.clubPanel}>
            Panel Club
          </Link>
        </nav>
      </div>
    </header>
  );
}
