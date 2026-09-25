import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageShell({
  kicker = 'Partner',
  title,
  description,
  actions,
  children,
  className,
  narrow,
  variant = 'default',
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  narrow?: boolean;
  variant?: 'default' | 'bento' | 'table' | 'form';
}) {
  return (
    <div
      className={cn(
        'space-y-6',
        narrow && 'max-w-xl',
        variant === 'form' && 'max-w-2xl',
        className,
      )}
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{kicker}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {variant === 'bento' ? <div className="dash-bento">{children}</div> : children}
    </div>
  );
}

export function PanelCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-card p-5 transition-colors duration-150',
        className,
      )}
    >
      {title ? (
        <div className="mb-4">
          <h2 className="text-base font-bold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function ListRow({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 transition-colors duration-150 hover:border-primary/25">
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        {meta ? <div className="mt-0.5 text-sm text-muted-foreground">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-12 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold',
        tone === 'neutral' && 'bg-muted text-muted-foreground',
        tone === 'success' && 'bg-success/15 text-success',
        tone === 'warning' && 'bg-warning/15 text-warning',
        tone === 'danger' && 'bg-destructive/15 text-destructive',
      )}
    >
      {children}
    </span>
  );
}
