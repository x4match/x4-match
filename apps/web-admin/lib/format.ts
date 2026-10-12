const numberFormatter = new Intl.NumberFormat('es-AR');
const compactFormatter = new Intl.NumberFormat('es-AR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const relativeFormatter = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatCompact(value: number) {
  return Math.abs(value) >= 100_000 ? compactFormatter.format(value) : numberFormatter.format(value);
}

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatCurrencyCompact(value: number) {
  return Math.abs(value) >= 1_000 ? `$${compactFormatter.format(value)}` : currencyFormatter.format(value);
}

export function formatWeekLabel(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export function formatRelative(iso?: string | null) {
  if (!iso) return '—';
  const diffSeconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return relativeFormatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return 'recién';
}

export function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').concat(parts.length > 1 ? parts[parts.length - 1][0] : '').toUpperCase();
}
