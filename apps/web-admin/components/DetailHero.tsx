import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

export function initials(name?: string | null) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DetailBack({ href, label }: { href: string; label: string }) {
  return (
    <div className="detail-back">
      <Link href={href} className="tile-link">
        <ArrowLeft size={14} aria-hidden /> {label}
      </Link>
    </div>
  );
}

type DetailHeroProps = {
  title: string;
  avatar: ReactNode;
  handle?: ReactNode;
  meta?: ReactNode[];
  badges?: ReactNode;
};

export function DetailHero({ title, avatar, handle, meta = [], badges }: DetailHeroProps) {
  const items = meta.filter(Boolean);
  return (
    <section className="card detail-hero">
      <span className="ops-avatar detail-avatar">{avatar}</span>
      <div className="detail-hero-main">
        <h1 className="detail-hero-title">{title}</h1>
        {handle ? <p className="detail-hero-handle">{handle}</p> : null}
        {items.length > 0 ? (
          <ul className="detail-meta">
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {badges ? <div className="detail-hero-badges">{badges}</div> : null}
    </section>
  );
}
