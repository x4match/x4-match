const LOCALE = 'es-AR';

function toNumber(amount: number | string): number {
  const n = typeof amount === 'number' ? amount : parseFloat(amount);
  return Number.isFinite(n) ? n : 0;
}

/** Solo el número, con separadores es-AR (ej. 9.600). */
export function formatMoneyNumber(amount: number | string): string {
  return toNumber(amount).toLocaleString(LOCALE, { maximumFractionDigits: 0 });
}

/**
 * Monto con símbolo ASCII estable.
 * Evita el glifo de moneda de Intl que en RN + Geist escala mal.
 */
export function formatCurrency(amount: number | string): string {
  return `$ ${formatMoneyNumber(amount)}`;
}

export function currencyParts(amount: number | string): { symbol: string; value: string } {
  return { symbol: '$', value: formatMoneyNumber(amount) };
}
