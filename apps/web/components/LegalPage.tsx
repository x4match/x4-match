import Link from 'next/link';
import type { LegalDocument } from '@/lib/legal-types';

type LegalPageProps = {
  doc: LegalDocument;
};

export function LegalPage({ doc }: LegalPageProps) {
  return (
    <article className="section" style={{ paddingTop: 48 }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 8px' }}>
          Actualizado: {doc.updated}
        </p>
        <h1 className="section-title" style={{ marginBottom: 16 }}>
          {doc.title}
        </h1>
        <p style={{ color: 'var(--muted)', margin: '0 0 32px' }}>{doc.summary}</p>

        <div className="card legal-content">
          {doc.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>

        <p style={{ marginTop: 24, fontSize: 14, color: 'var(--muted)' }}>
          ¿Consultas? Escribinos a{' '}
          <a href="mailto:legal@x4match.com" style={{ color: 'var(--primary)' }}>
            legal@x4match.com
          </a>
          . También podés revisar la{' '}
          <Link href="/privacidad" style={{ color: 'var(--primary)' }}>
            Política de Privacidad
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
