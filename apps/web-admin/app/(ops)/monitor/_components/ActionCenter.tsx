import Link from 'next/link';
import { ArrowRight, BadgeCheck, CheckCircle2, PlugZap, Timer, type LucideIcon } from 'lucide-react';
import type { MonitorTotals } from './types';

type ActionItem = {
  href: string;
  icon: LucideIcon;
  tone: 'warning' | 'danger' | 'info';
  count: number;
  title: string;
  detail: string;
};

export function ActionCenter({ totals }: { totals: MonitorTotals }) {
  const clubsWithoutMp = Math.max(totals.clubs - totals.mpConnectedClubs, 0);
  const items: ActionItem[] = [
    {
      href: '/club-registrations',
      icon: BadgeCheck,
      tone: 'warning' as const,
      count: totals.pendingClubRegistrations,
      title: totals.pendingClubRegistrations === 1 ? 'Alta de club por revisar' : 'Altas de clubes por revisar',
      detail: 'Aprobá o rechazá para que puedan operar',
    },
    {
      href: '/trials',
      icon: Timer,
      tone: 'danger' as const,
      count: totals.trialsExpiring7d,
      title: totals.trialsExpiring7d === 1 ? 'Trial vence en 7 días' : 'Trials vencen en 7 días',
      detail: 'Contactá al club antes del vencimiento',
    },
    {
      href: '/clubs',
      icon: PlugZap,
      tone: 'info' as const,
      count: clubsWithoutMp,
      title: clubsWithoutMp === 1 ? 'Club sin Mercado Pago' : 'Clubes sin Mercado Pago',
      detail: 'No pueden cobrar turnos online',
    },
  ].filter((item) => item.count > 0);

  if (items.length === 0) {
    return (
      <section className="action-center action-center--clear" aria-label="Pendientes">
        <CheckCircle2 size={18} aria-hidden />
        <p>Todo en orden: no hay altas, vencimientos ni clubes sin cobros pendientes.</p>
      </section>
    );
  }

  return (
    <section className="action-center" aria-label="Pendientes">
      {items.map(({ href, icon: Icon, tone, count, title, detail }) => (
        <Link key={href} href={href} className={`action-item action-item--${tone}`}>
          <span className="action-item-icon" aria-hidden>
            <Icon size={18} />
          </span>
          <span className="action-item-text">
            <span className="action-item-title">
              <strong className="num">{count}</strong> {title}
            </span>
            <span className="action-item-detail">{detail}</span>
          </span>
          <ArrowRight size={16} aria-hidden className="action-item-arrow" />
        </Link>
      ))}
    </section>
  );
}
