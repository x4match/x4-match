import Link from 'next/link';
import { SITE } from '@/content/site';

const LEGAL = [
  { href: '/terminos', label: 'Términos jugadores' },
  { href: '/terminos-clubes', label: 'Términos clubes' },
  { href: '/privacidad', label: 'Privacidad' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/eliminar-cuenta', label: 'Eliminar cuenta' },
];

export function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', marginTop: 80, background: 'var(--surface)' }}>
      <div className="container" style={{ padding: '48px 0 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, marginBottom: 32 }}>
          <div>
            <p style={{ fontWeight: 900, fontSize: 18, margin: '0 0 8px' }}>x4 match</p>
            <p style={{ color: 'var(--muted)', margin: 0, fontSize: 14 }}>{SITE.tagline}</p>
          </div>

          <div>
            <p style={{ fontWeight: 700, margin: '0 0 12px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
              Legal
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {LEGAL.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} style={{ color: '#d4d4d4', fontSize: 14 }}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p style={{ fontWeight: 700, margin: '0 0 12px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
              Contacto
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, fontSize: 14, color: '#d4d4d4' }}>
              <li>
                <a href={`mailto:${SITE.emails.hola}`}>{SITE.emails.hola}</a>
              </li>
              <li>
                <a href={`mailto:${SITE.emails.clubes}`}>{SITE.emails.clubes}</a>
              </li>
              <li>
                <a href={`mailto:${SITE.emails.legal}`}>{SITE.emails.legal}</a>
              </li>
            </ul>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          © {new Date().getFullYear()} {SITE.company.legalName}. {SITE.company.address}. Los documentos legales son
          borradores operativos; validar con asesor legal antes de producción.
        </p>
      </div>
    </footer>
  );
}
