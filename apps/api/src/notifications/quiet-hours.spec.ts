import { nextPushTimeOutsideQuietHours } from './quiet-hours';

/** Hora argentina (UTC-3) → Date. */
const ar = (iso: string) => new Date(`${iso}-03:00`);

describe('nextPushTimeOutsideQuietHours', () => {
  it('no cambia horarios diurnos', () => {
    expect(nextPushTimeOutsideQuietHours(ar('2026-10-23T08:00:00'))).toEqual(ar('2026-10-23T08:00:00'));
    expect(nextPushTimeOutsideQuietHours(ar('2026-10-23T22:59:00'))).toEqual(ar('2026-10-23T22:59:00'));
  });

  it('pasa a las 8 del día siguiente desde las 23', () => {
    expect(nextPushTimeOutsideQuietHours(ar('2026-10-23T23:00:00'))).toEqual(ar('2026-10-24T08:00:00'));
    expect(nextPushTimeOutsideQuietHours(ar('2026-10-31T23:45:00'))).toEqual(ar('2026-11-01T08:00:00'));
  });

  it('pasa a las 8 del mismo día en la madrugada', () => {
    expect(nextPushTimeOutsideQuietHours(ar('2026-10-24T00:10:00'))).toEqual(ar('2026-10-24T08:00:00'));
    expect(nextPushTimeOutsideQuietHours(ar('2026-10-24T07:59:00'))).toEqual(ar('2026-10-24T08:00:00'));
  });
});
