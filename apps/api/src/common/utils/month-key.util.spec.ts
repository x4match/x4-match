import { getMonthKey } from './month-key.util';

describe('getMonthKey', () => {
  it('retorna YYYY-MM', () => {
    expect(getMonthKey(new Date('2026-05-18T12:00:00.000Z'))).toMatch(/^\d{4}-\d{2}$/);
  });
});
