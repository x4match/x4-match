import { Test, TestingModule } from '@nestjs/testing';
import { ClubPointsService, POINTS_MATCH_PLAYED } from './club-points.service';
import { DatabaseService } from '../database/database.service';

describe('ClubPointsService', () => {
  let service: ClubPointsService;
  const query = jest.fn();

  beforeEach(async () => {
    query.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubPointsService,
        { provide: DatabaseService, useValue: { query } },
      ],
    }).compile();

    service = module.get(ClubPointsService);
  });

  it('aplica x1 sin promoción activa', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const result = await service.resolveMatchPoints(
      'club-1',
      new Date('2026-05-18T15:00:00.000Z'),
      POINTS_MATCH_PLAYED,
    );

    expect(result.basePoints).toBe(10);
    expect(result.multiplier).toBe(1);
    expect(result.totalPoints).toBe(10);
    expect(result.inPromotion).toBe(false);
    expect(result.promoBonusPoints).toBe(0);
  });

  it('usa el multiplicador de la promoción (sin mirar plan del club)', async () => {
    query.mockResolvedValueOnce({ rows: [{ bonus_points: 0, points_multiplier: 1.5 }] });

    const result = await service.resolveMatchPoints(
      'club-1',
      new Date('2026-05-18T15:00:00.000Z'),
      POINTS_MATCH_PLAYED,
    );

    expect(result.inPromotion).toBe(true);
    expect(result.multiplier).toBe(1.5);
    expect(result.totalPoints).toBe(15);
    expect(result.promoBonusPoints).toBe(0);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('respeta tope x2.5 de la promoción y lee bonus flat', async () => {
    query.mockResolvedValueOnce({ rows: [{ bonus_points: 20, points_multiplier: 2.5 }] });

    const result = await service.resolveMatchPoints(
      'club-1',
      new Date('2026-05-18T15:00:00.000Z'),
      POINTS_MATCH_PLAYED,
    );

    expect(result.multiplier).toBe(2.5);
    expect(result.totalPoints).toBe(25);
    expect(result.promoBonusPoints).toBe(20);
  });

  it('capa multiplicadores de promo mayores a 2.5', async () => {
    query.mockResolvedValueOnce({ rows: [{ bonus_points: 0, points_multiplier: 5 }] });

    const result = await service.resolveMatchPoints(
      'club-1',
      new Date('2026-05-18T15:00:00.000Z'),
      POINTS_MATCH_PLAYED,
    );

    expect(result.multiplier).toBe(2.5);
    expect(result.totalPoints).toBe(25);
  });

  it('addPoints con affectMonthly=false no escribe ranking mensual', async () => {
    query.mockResolvedValue({ rows: [] });

    await service.addPoints('club-1', 'user-1', 50, 'COUPON_CLAIM', 'coupon-1', {
      monthKey: '2026-09',
      baseAmount: 50,
      multiplier: 1,
      countMatch: false,
      affectMonthly: false,
    });

    const sqlCalls = query.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.some((s) => s.includes('club_member_points'))).toBe(true);
    expect(sqlCalls.some((s) => s.includes('club_member_monthly_points'))).toBe(false);
  });

  it('addPoints con affectMonthly=true escribe ranking mensual', async () => {
    query.mockResolvedValue({ rows: [] });

    await service.addPoints('club-1', 'user-1', 10, 'MATCH_PLAYED', 'match-1', {
      monthKey: '2026-09',
      baseAmount: 10,
      multiplier: 1,
      countMatch: true,
      affectMonthly: true,
    });

    const sqlCalls = query.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.some((s) => s.includes('club_member_monthly_points'))).toBe(true);
  });
});
