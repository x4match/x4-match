import type { TimeSlot } from './types';
import { formatCurrency as formatCurrencyAscii } from './currency';

const LOCALE = 'es-AR';

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function toDate(date: string | Date): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatTime(date: string | Date): string {
  return toDate(date).toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateRange(start: string | Date, end?: string | Date | null): string {
  const startDate = toDate(start);
  if (!end) {
    return startDate.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
  }
  const endDate = toDate(end);
  const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
  if (sameMonth) {
    const month = startDate.toLocaleDateString(LOCALE, { month: 'short' });
    return `${startDate.getDate()} - ${endDate.getDate()} ${month}`;
  }
  const startLabel = startDate.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
  const endLabel = endDate.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
  return `${startLabel} - ${endLabel}`;
}

export function formatShortDate(date: string | Date): string {
  const d = toDate(date);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(d, now)) return 'Hoy';
  if (isSameDay(d, tomorrow)) return 'Mañana';
  return d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatMatchDate(date: string | Date): string {
  const d = toDate(date);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = formatTime(d);
  if (isSameDay(d, now)) return `Hoy ${time}`;
  if (isSameDay(d, tomorrow)) return `Mañana ${time}`;
  if (isSameDay(d, yesterday)) return `Ayer ${time}`;
  return d.toLocaleString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFullDate(date: string | Date): string {
  return toDate(date).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

export function getTimeSlotLabel(slot: TimeSlot): string {
  const labels: Record<TimeSlot, string> = {
    morning: 'Mañana (9-12)',
    noon: 'Mediodía (12-15)',
    afternoon: 'Tarde (15-18)',
    night: 'Noche (18-22)',
  };
  return labels[slot];
}

export const TIME_SLOTS: { slot: TimeSlot; hour: number }[] = [
  { slot: 'morning', hour: 9 },
  { slot: 'noon', hour: 12 },
  { slot: 'afternoon', hour: 15 },
  { slot: 'night', hour: 20 },
];

/** Rangos simplificados para buscar / crear partido */
export type PlayPeriod = 'morning' | 'afternoon' | 'night';

export const PLAY_PERIODS: {
  id: PlayPeriod;
  label: string;
  hint: string;
  startHour: number;
  endHour: number;
}[] = [
  { id: 'morning', label: 'Mañana', hint: '9 a 13 hs', startHour: 9, endHour: 13 },
  { id: 'afternoon', label: 'Tarde', hint: '13 a 18 hs', startHour: 13, endHour: 18 },
  { id: 'night', label: 'Noche', hint: '18 a 24 hs', startHour: 18, endHour: 24 },
];

export function getPlayPeriod(id: PlayPeriod) {
  return PLAY_PERIODS.find((p) => p.id === id)!;
}

/** Ventana concreta (inicio / fin) para una fecha + franja. */
export function getPlayPeriodWindow(date: Date, periodId: PlayPeriod): { startsAt: Date; endsAt: Date } {
  const period = getPlayPeriod(periodId);
  const day = startOfDay(date);

  const startsAt = new Date(day);
  startsAt.setHours(period.startHour, 0, 0, 0);

  const endsAt = new Date(day);
  if (period.endHour >= 24) {
    endsAt.setDate(endsAt.getDate() + 1);
    endsAt.setHours(0, 0, 0, 0);
  } else {
    endsAt.setHours(period.endHour, 0, 0, 0);
  }

  return { startsAt, endsAt };
}

/** Etiqueta corta de franja a partir de hora de inicio (y fin opcional). */
export function formatPlayPeriodLabel(start: string | Date, end?: string | Date | null): string {
  const startDate = toDate(start);
  const hour = startDate.getHours();
  const period =
    PLAY_PERIODS.find((p) => hour >= p.startHour && hour < (p.endHour >= 24 ? 24 : p.endHour)) ??
    null;
  if (!period) return formatTime(startDate);
  if (!end) return `${period.label} · ${period.hint}`;
  return `${period.label} · ${period.hint}`;
}

/** True when the match already has a concrete court/slot time (not just a search period). */
export function matchHasExactCourtTime(match: {
  date: string | Date;
  endsAt?: string | Date | null;
  courtBooking?: string | null;
  courtSlotId?: string | null;
  courtInfo?: {
    label?: string | null;
    durationMinutes?: number;
    startHour?: number;
    endHour?: number;
  } | null;
}): boolean {
  if (match.courtBooking === 'in_app') return true;
  if (match.courtSlotId) return true;
  if (match.courtInfo?.label) return true;
  if (match.courtInfo?.startHour != null && match.courtInfo?.endHour != null) return true;
  if (match.endsAt) {
    const mins = (toDate(match.endsAt).getTime() - toDate(match.date).getTime()) / 60000;
    if (mins > 0 && mins <= 180) return true;
  }
  return false;
}

function formatClockFromDecimalHour(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  return `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Hora exacta de cancha (inicio - fin), o franja de búsqueda si todavía no hay turno. */
export function formatMatchCourtWhen(
  match: {
    date: string | Date;
    endsAt?: string | Date | null;
    courtBooking?: string | null;
    courtSlotId?: string | null;
    courtInfo?: {
      label?: string | null;
      durationMinutes?: number;
      startHour?: number;
      endHour?: number;
    } | null;
  },
  dayLabel?: string,
): string {
  const day = dayLabel ?? formatShortDate(match.date);

  if (matchHasExactCourtTime(match)) {
    const slotStart = match.courtInfo?.startHour;
    const slotEnd = match.courtInfo?.endHour;
    if (slotStart != null && slotEnd != null && slotEnd > slotStart) {
      return `${day} · ${formatClockFromDecimalHour(slotStart)} - ${formatClockFromDecimalHour(slotEnd)}`;
    }

    const start = formatTime(match.date);
    const duration = match.courtInfo?.durationMinutes;
    if (duration && duration > 0 && duration <= 180) {
      const end = new Date(toDate(match.date).getTime() + duration * 60000);
      return `${day} · ${start} - ${formatTime(end)}`;
    }
    if (match.endsAt) {
      const mins = (toDate(match.endsAt).getTime() - toDate(match.date).getTime()) / 60000;
      if (mins > 0 && mins <= 180) {
        return `${day} · ${start} - ${formatTime(match.endsAt)}`;
      }
    }
    // Cancha reservada sin fin explícito: turno típico de 90 min.
    const fallbackEnd = new Date(toDate(match.date).getTime() + 90 * 60000);
    return `${day} · ${start} - ${formatTime(fallbackEnd)}`;
  }

  return `${day} · ${formatPlayPeriodLabel(match.date, match.endsAt)}`;
}

/** Fecha + franja horaria del partido (rango corto = hora de cancha; largo = franja de búsqueda). */
export function formatMatchSchedule(start: string | Date, end?: string | Date | null): string {
  if (!end) return formatMatchDate(start);
  return formatMatchCourtWhen({ date: start, endsAt: end });
}

/** Horas jugables típicas (6:00–22:00) */
export const PLAY_HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

export function formatCurrency(amount: number | string, currency = 'ARS'): string {
  return formatCurrencyAscii(amount, currency);
}

export function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isHourDisabledForDate(date: Date, hour: number, now = new Date()): boolean {
  const day = startOfDay(date);
  const today = startOfDay(now);
  if (day.getTime() < today.getTime()) return true;
  if (day.getTime() > today.getTime()) return false;
  return hour < now.getHours();
}

export function isPlayPeriodDisabledForDate(
  date: Date,
  period: PlayPeriod,
  now = new Date(),
): boolean {
  const range = getPlayPeriod(period);
  return isHourDisabledForDate(date, range.endHour - 1, now);
}
