import { Test, TestingModule } from '@nestjs/testing';
import {
  ClubPointsService,
  MAX_CLUB_POINT_MATCHES_PER_DAY,
  MIN_REAL_PLAYERS_FOR_CLUB_POINTS,
  POINTS_MATCH_PLAYED,
} from './club-points.service';
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

  describe('anti-farm eligibility', () => {
    it('rechaza partidos sin cancha BOOKED', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'm1',
            club_id: 'club-1',
            date: new Date(Date.now() - 3600_000),
            needed_players: 4,
            court_slot_id: null,
            court_booking: 'none',
            slot_status: null,
          },
        ],
      });

      const result = await service.awardForFinishedMatch('m1', 'A');
      expect(result).toEqual({ awarded: false, reason: 'NO_BOOKED_COURT' });
    });

    it('rechaza si hay menos de 4 jugadores reales', async () => {
      query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'm1',
              club_id: 'club-1',
              date: new Date(Date.now() - 3600_000),
              needed_players: 4,
              court_slot_id: 'slot-1',
              court_booking: 'in_app',
              slot_status: 'BOOKED',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { user_id: 'u1', rnk: 1 },
            { user_id: 'u2', rnk: 2 },
          ],
        });

      const result = await service.awardForFinishedMatch('m1', 'A');
      expect(result).toEqual({ awarded: false, reason: 'TOO_FEW_REAL_PLAYERS' });
      expect(MIN_REAL_PLAYERS_FOR_CLUB_POINTS).toBe(4);
    });

    it('rechaza partidos con fecha futura', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'm1',
            club_id: 'club-1',
            date: new Date(Date.now() + 3 * 3600_000),
            needed_players: 4,
            court_slot_id: 'slot-1',
            court_booking: 'in_app',
            slot_status: 'BOOKED',
          },
        ],
      });

      const result = await service.awardForFinishedMatch('m1', 'A');
      expect(result).toEqual({ awarded: false, reason: 'MATCH_NOT_STARTED' });
    });
  });

  it('addPoints es idempotente: si el ledger ya existe no suma wallet', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // ON CONFLICT DO NOTHING → sin row

    const result = await service.addPoints('club-1', 'user-1', 10, 'MATCH_PLAYED', 'match-1', {
      monthKey: '2026-09',
      baseAmount: 10,
      multiplier: 1,
      countMatch: true,
      affectMonthly: true,
    });

    expect(result).toEqual({ inserted: false });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT');
  });

  it('addPoints con affectMonthly=false no escribe ranking mensual', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] })
      .mockResolvedValue({ rows: [] });

    await service.addPoints('club-1', 'user-1', 50, 'COUPON_CLAIM', 'coupon-1', {
      monthKey: '2026-09',
      baseAmount: 50,
      multiplier: 1,
      countMatch: false,
      affectMonthly: false,
    });

    const sqlCalls = query.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(sqlCalls.some((s) => s.includes('club_member_points'))).toBe(true);
    expect(sqlCalls.some((s) => s.includes('club_member_monthly_points'))).toBe(false);
  });

  it('addPoints con affectMonthly=true escribe ranking mensual', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] })
      .mockResolvedValue({ rows: [] });

    await service.addPoints('club-1', 'user-1', 10, 'MATCH_PLAYED', 'match-1', {
      monthKey: '2026-09',
      baseAmount: 10,
      multiplier: 1,
      countMatch: true,
      affectMonthly: true,
    });

    const sqlCalls = query.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(sqlCalls.some((s) => s.includes('club_member_monthly_points'))).toBe(true);
  });

  it('expone tope diario de partidos con puntos', () => {
    expect(MAX_CLUB_POINT_MATCHES_PER_DAY).toBe(4);
  });
});
