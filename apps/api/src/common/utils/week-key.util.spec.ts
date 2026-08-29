import { getWeekKey, getWeekStart, getWeekEnd } from './week-key.util';

describe('getWeekKey', () => {
  it('debería retornar formato YYYY-WNN', () => {
    const result = getWeekKey(new Date('2026-02-11')); // miércoles 11 feb 2026
    expect(result).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('debería retornar la semana correcta para una fecha conocida', () => {
    // 11 de febrero de 2026 es miércoles, semana ISO 7
    const result = getWeekKey(new Date('2026-02-11'));
    expect(result).toBe('2026-W07');
  });

  it('debería manejar inicio de año (1 de enero)', () => {
    // 1 de enero de 2026 es jueves → ISO week 1
    const result = getWeekKey(new Date('2026-01-01'));
    expect(result).toBe('2026-W01');
  });

  it('debería retornar weekKey del día actual si no se pasa fecha', () => {
    const result = getWeekKey();
    expect(result).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('debería distinguir semanas diferentes', () => {
    const week1 = getWeekKey(new Date('2026-02-09')); // lunes W07
    const week2 = getWeekKey(new Date('2026-02-16')); // lunes W08
    expect(week1).not.toBe(week2);
  });

  it('días de la misma semana ISO deberían tener el mismo weekKey', () => {
    // Usar fechas con hora explícita para evitar problemas de timezone
    const tuesday = getWeekKey(new Date(2026, 1, 10, 12, 0, 0)); // martes 10 feb
    const wednesday = getWeekKey(new Date(2026, 1, 11, 12, 0, 0)); // miércoles 11 feb
    const friday = getWeekKey(new Date(2026, 1, 13, 12, 0, 0)); // viernes 13 feb
    expect(tuesday).toBe(wednesday);
    expect(wednesday).toBe(friday);
  });
});

describe('getWeekStart', () => {
  it('debería retornar un lunes', () => {
    const start = getWeekStart(new Date('2026-02-11'));
    expect(start.getDay()).toBe(1); // 1 = lunes
  });

  it('debería retornar 00:00:00.000', () => {
    const start = getWeekStart(new Date('2026-02-11'));
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it('debería retornar el lunes correcto para un miércoles', () => {
    const start = getWeekStart(new Date('2026-02-11')); // miércoles
    expect(start.getDate()).toBe(9); // lunes 9 feb
  });

  it('debería retornar el lunes correcto para un domingo', () => {
    const start = getWeekStart(new Date('2026-02-15')); // domingo
    expect(start.getDate()).toBe(9); // lunes 9 feb
  });

  it('debería retornar el lunes correcto para un lunes', () => {
    const start = getWeekStart(new Date(2026, 1, 9, 12, 0, 0)); // lunes 9 feb
    expect(start.getDate()).toBe(9);
  });
});

describe('getWeekEnd', () => {
  it('debería retornar un domingo', () => {
    const end = getWeekEnd(new Date('2026-02-11'));
    expect(end.getDay()).toBe(0); // 0 = domingo
  });

  it('debería retornar 23:59:59.999', () => {
    const end = getWeekEnd(new Date('2026-02-11'));
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  it('debería ser exactamente 6 días después del inicio', () => {
    const start = getWeekStart(new Date('2026-02-11'));
    const end = getWeekEnd(new Date('2026-02-11'));
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.floor(diffDays)).toBe(6);
  });
});

