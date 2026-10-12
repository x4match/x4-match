import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { formatRelative, initials } from '@/lib/format';
import type { LabelCategory } from '@/lib/labels';

type RecentItem = {
  id: string;
  href: string;
  name: string;
  secondary?: string | null;
  status: string;
  createdAt: string;
};

export function RecentList({
  title,
  seeAllHref,
  items,
  category,
}: {
  title: string;
  seeAllHref: string;
  items: RecentItem[];
  category: LabelCategory;
}) {
  const titleId = `recent-${seeAllHref.replace('/', '')}`;
  return (
    <section className="bento-tile recent-card" aria-labelledby={titleId}>
      <header className="tile-header">
        <h2 id={titleId} className="tile-title">
          {title}
        </h2>
        <Link href={seeAllHref} className="tile-link">
          Ver todos
          <ArrowUpRight size={14} aria-hidden />
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="chart-empty">Sin registros todavía.</p>
      ) : (
        <ul className="recent-list">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="recent-row">
                <span className="ops-avatar ops-avatar--sm" aria-hidden>
                  {initials(item.name)}
                </span>
                <span className="recent-main">
                  <span className="recent-name">{item.name}</span>
                  <span className="recent-secondary">{item.secondary || '—'}</span>
                </span>
                <span className="recent-meta">
                  <StatusBadge value={item.status} category={category} />
                  <time dateTime={item.createdAt} className="recent-time">
                    {formatRelative(item.createdAt)}
                  </time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
