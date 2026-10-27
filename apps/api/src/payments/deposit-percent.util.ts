/** Acota el % de seña/confirmación de cancha al rango 0–100. */
export function normalizeDepositPercent(value: unknown, fallback = 100): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Monto a cobrar por jugador para confirmar (share completo × %). */
export function applyDepositPercent(fullShareAmount: number, depositPercent: number): number {
  const share = Number(fullShareAmount);
  if (!Number.isFinite(share) || share <= 0) return 0;
  const percent = normalizeDepositPercent(depositPercent, 100);
  return Math.round(share * (percent / 100) * 100) / 100;
}
