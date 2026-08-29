/**
 * Utilidades para manejar semanas ISO (weekKey) en timezone America/Argentina/Buenos_Aires.
 *
 * Formato weekKey: "YYYY-WNN" (ej: "2026-W07")
 */

/**
 * Retorna la semana ISO de una fecha dada.
 * ISO 8601: la semana 1 es la que contiene el primer jueves del año.
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 1=Mon, 7=Sun
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}

/**
 * Retorna el año ISO de una fecha. Puede diferir del año calendario
 * para fechas al inicio/final del año.
 */
function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

/**
 * Genera el weekKey (formato "YYYY-WNN") para una fecha.
 * Usa la fecha local (no UTC) para mantener consistencia con Argentina/Buenos_Aires.
 */
export function getWeekKey(date: Date = new Date()): string {
  const weekNumber = getISOWeekNumber(date);
  const weekYear = getISOWeekYear(date);
  return `${weekYear}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Retorna el inicio de la semana ISO (lunes 00:00:00) para una fecha dada.
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  // ISO week starts on Monday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Retorna el fin de la semana ISO (domingo 23:59:59) para una fecha dada.
 */
export function getWeekEnd(date: Date = new Date()): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

