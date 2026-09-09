/** Convierte hora API (18 o 18.5) a minutos desde medianoche. */
export function hourToMinutes(hour: string | number): number {
  if (typeof hour === 'number') {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    return h * 60 + m;
  }
  const raw = String(hour).trim();
  if (raw.includes(':')) {
    const [h, m = '0'] = raw.split(':');
    return Number(h) * 60 + Number(m);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return h * 60 + m;
}

/** Minutos → hora API decimal (18.5). */
export function minutesToHour(minutes: number): number {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h + (m >= 30 ? 0.5 : 0);
}

export function formatHourLabel(hour: number): string {
  const h = Math.floor(hour);
  const m = hour % 1 >= 0.5 ? '30' : '00';
  return `${String(h).padStart(2, '0')}:${m}`;
}

export function slotDateKey(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export const AGENDA_START_HOUR = 8;
export const AGENDA_END_HOUR = 24;
export const AGENDA_STEP_MINUTES = 30;
