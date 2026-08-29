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
  });

  it('aplica x1.5 en promo con plan GROWTH', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ subscription_plan: 'GROWTH' }] });

    const result = await service.resolveMatchPoints(
      'club-1',
      new Date('2026-05-18T15:00:00.000Z'),
      POINTS_MATCH_PLAYED,
    );

    expect(result.inPromotion).toBe(true);
    expect(result.multiplier).toBe(1.5);
    expect(result.totalPoints).toBe(15);
  });

  it('aplica x2 en promo con plan PRO', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ subscription_plan: 'PRO' }] });

    const result = await service.resolveMatchPoints(
      'club-1',
      new Date('2026-05-18T15:00:00.000Z'),
      POINTS_MATCH_PLAYED,
    );

    expect(result.multiplier).toBe(2);
    expect(result.totalPoints).toBe(20);
  });
});
