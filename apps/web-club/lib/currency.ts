export function formatCurrency(amount: number | string | null | undefined, currency = 'ARS') {
  const value = typeof amount === 'string' ? Number(amount) : amount ?? 0;
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `$${Number(value || 0).toLocaleString('es-AR')}`;
  }
}
