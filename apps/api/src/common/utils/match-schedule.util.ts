const AR_TIMEZONE = 'America/Argentina/Buenos_Aires';

export interface MatchScheduleContext {
  dayOfWeek: number;
  hour: number;
  monthKey: string;
}

/**
 * Día (0=domingo) y hora local Argentina para cruzar con club_promotions.
 */
export function getMatchScheduleContext(matchDate: Date): MatchScheduleContext {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: AR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(matchDate);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hourRaw = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const hour = Math.min(23, Math.max(0, parseInt(hourRaw, 10) % 24));

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    dayOfWeek: dayMap[weekday] ?? 0,
    hour,
    monthKey: `${year}-${month}`,
  };
}
