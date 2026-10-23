/** Argentina no tiene horario de verano: UTC-3 fijo. */
const AR_UTC_OFFSET_HOURS = -3;
export const QUIET_START_HOUR = 23;
export const QUIET_END_HOUR = 8;

const HOUR_MS = 3_600_000;

/** Devuelve `at` si está fuera del horario de descanso; si no, las 8:00 (hora AR) siguientes. */
export function nextPushTimeOutsideQuietHours(at: Date): Date {
  const local = new Date(at.getTime() + AR_UTC_OFFSET_HOURS * HOUR_MS);
  const hour = local.getUTCHours();
  if (hour < QUIET_START_HOUR && hour >= QUIET_END_HOUR) return at;

  const resume = new Date(local);
  resume.setUTCHours(QUIET_END_HOUR, 0, 0, 0);
  if (hour >= QUIET_START_HOUR) resume.setUTCDate(resume.getUTCDate() + 1);
  return new Date(resume.getTime() - AR_UTC_OFFSET_HOURS * HOUR_MS);
}
