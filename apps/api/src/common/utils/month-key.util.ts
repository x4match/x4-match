const AR_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Clave de mes calendario en timezone Argentina: "YYYY-MM".
 */
export function getMonthKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}
