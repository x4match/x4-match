const LOCALE = 'es-AR';

function toNumber(amount: number | string): number {
  const n = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Solo el número, con separadores es-AR (ej. 9.600). */
export function formatMoneyNumber(amount: number | string): string {
  return toNumber(amount).toLocaleString(LOCALE, { maximumFractionDigits: 0 });
}

/**
 * Monto con símbolo ASCII estable.
 * Evita el glifo de moneda de Intl que en RN + tipografía custom escala mal.
 */
export function formatCurrency(amount: number | string, _currency = 'ARS'): string {
  return `$ ${formatMoneyNumber(amount)}`;
}

export function currencyParts(amount: number | string): { symbol: string; value: string } {
  return { symbol: '$', value: formatMoneyNumber(amount) };
}

/** Queda solo dígitos (para inputs de pesos enteros). */
export function moneyDigitsOnly(text: string): string {
  return String(text ?? '').replace(/\D/g, '');
}

/**
 * Formatea el valor de un input de dinero mientras se escribe (es-AR).
 * Guarda/recibe dígitos; muestra "30.000".
 */
export function formatMoneyInput(raw: string): string {
  const digits = moneyDigitsOnly(raw);
  if (!digits) return '';
  return formatMoneyNumber(Number(digits));
}

/** Parsea un input de dinero (con o sin puntos) a número entero. */
export function parseMoneyInput(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : 0;
  const digits = moneyDigitsOnly(raw || '');
  if (!digits) return 0;
  return Number(digits);
}
