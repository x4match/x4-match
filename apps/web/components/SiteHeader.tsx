import Link from 'next/link';
import { SITE } from '@/content/site';

const NAV = [
  { href: '/#jugadores', label: 'Jugadores' },
  { href: '/#clubes', label: 'Clubes' },
  { href: '/#planes', label: 'Planes' },
  { href: '/#contacto', label: 'Contacto' },
];

export function SiteHeader() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(5,5,5,0.85)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0' }}>
        <Link href="/" style={{ fontWeight: 900, fontSize: 20, letterSpacing: '-0.04em' }}>
          x4<span style={{ color: 'var(--primary)' }}>match</span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} style={{ color: 'var(--muted)', fontSize: 14, fontWeight: 600 }}>
              {item.label}
            </Link>
          ))}
          <Link className="btn btn-primary" href={SITE.links.clubPanel} style={{ padding: '10px 16px', fontSize: 14 }}>
            Panel club
          </Link>
        </nav>
      </div>
    </header>
  );
}
