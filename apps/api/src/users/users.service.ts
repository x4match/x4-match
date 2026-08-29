import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import {
  normalizeCategoryStatus,
  PLACEMENT_MATCHES_REQUIRED,
  getMonthKey,
  resolveVisibleLevelCategory,
  getInitialRatingForCategory,
  type PlayerCategory,
} from '../common/utils';
import { ratingToSkillScore, resolvePlayerRating } from '../common/utils/player-rating.util';
import { deleteCloudinaryAsset, uploadImageBuffer } from '../common/cloudinary/cloudinary.util';

type Extras = Record<string, unknown>;

type MatchRow = {
  matchId: string;
  date: Date;
  title: string;
  clubName?: string;
  score: string;
  outcome: 'win' | 'loss' | 'draw';
  opponentNames: string[];
};

function parseScore(score: string): { a: number; b: number } | null {
  const parts = score.split(/[-:]/).map((s) => parseInt(s.trim(), 10));
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return { a: parts[0], b: parts[1] };
  }
  return null;
}

function userTeamFromRank(rnk: number, neededPlayers: number): 'A' | 'B' {
  const half = Math.ceil(Math.max(neededPlayers, 2) / 2);
  return rnk <= half ? 'A' : 'B';
}

function tallyWL(rows: MatchRow[]) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const m of rows) {
    const pts = parseScore(m.score);
    if (pts && pts.a === pts.b) draws += 1;
    else if (m.outcome === 'win') wins += 1;
    else if (m.outcome === 'loss') losses += 1;
  }
  return { wins, losses, draws };
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  private parseExtras(row: { extras?: unknown } | undefined): Extras {
    const raw = row?.extras;
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Extras;
        }
      } catch {
        return {};
      }
      return {};
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Extras;
    }
    return {};
  }

  async getProfile(userId: string) {
    const res = await this.db.query(
      `SELECT u.id, u.name, u.email, u.role,
              p.id AS player_id, p.photo_url, p.city, p.zone, p.level, p.rating, p.position, p.bio, p.nickname,
              p.extras, p.category_status, p.placement_matches_played
       FROM users u
       LEFT JOIN players p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const extras = this.parseExtras(row);
    const prefs = (extras.preferences as Extras) || {};
    const currentRating = resolvePlayerRating(row);
    const currentSkillScore = ratingToSkillScore(currentRating);
    const declaredCategory = (extras.declaredCategory as string) || undefined;
    const categoryStatus =
      row.category_status != null ? normalizeCategoryStatus(row.category_status) : undefined;
    const placementMatchesPlayed =
      row.placement_matches_played != null ? Number(row.placement_matches_played) : undefined;

    const matchStats = await this.getMatchStats(userId);
    const monthKey = getMonthKey();
    const competitiveMonthly = await this.db.query(
      `SELECT points, matches_played FROM player_competitive_monthly_points
       WHERE user_id = $1 AND month_key = $2`,
      [userId, monthKey],
    );
    const competitiveRow = competitiveMonthly.rows[0];

    const mainClubId =
      typeof extras.mainClubId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        extras.mainClubId,
      )
        ? extras.mainClubId
        : undefined;
    let mainClub: { id: string; name: string; zone?: string } | undefined;
    if (mainClubId) {
      const c = await this.db.query(
        `SELECT id, name, zone FROM clubs WHERE id = $1`,
        [mainClubId],
      );
      if (c.rows[0]) {
        mainClub = {
          id: c.rows[0].id,
          name: c.rows[0].name,
          zone: c.rows[0].zone ?? undefined,
        };
      }
    }

    const location =
      (typeof extras.location === 'string' && extras.location.trim()
        ? extras.location.trim()
        : undefined) ||
      [row.zone, row.city].filter(Boolean).join(', ') ||
      undefined;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: (extras.phone as string) || '',
      gender: (extras.gender as string) || '',
      birthDate: (extras.birthDate as string) || undefined,
      description: row.bio || '',
      photo: row.photo_url ?? undefined,
      location,
      city: row.city || undefined,
      zone: row.zone || undefined,
      dni: (extras.dni as string) || undefined,
      fejubaId: (extras.fejubaId as string) || undefined,
      fejubaCategory: (extras.fejubaCategory as string) || undefined,
      fejubaFound: Boolean(extras.fejubaId || extras.fejubaCategory),
      rating: currentRating,
      skillScore: currentSkillScore,
      levelCategory: resolveVisibleLevelCategory({
        rating: currentRating,
        categoryStatus,
        declaredCategory,
      }),
      declaredCategory,
      categoryStatus,
      placementMatchesPlayed,
      placementMatchesRequired: categoryStatus != null ? PLACEMENT_MATCHES_REQUIRED : undefined,
      mainClubId,
      mainClub,
      weeklyRankPosition: null,
      sports: ['Pádel'],
      stats: matchStats,
      competitiveMonthly: {
        monthKey,
        points: competitiveRow?.points ?? 0,
        matchesPlayed: competitiveRow?.matches_played ?? 0,
      },
      preferences: {
        preferredHand: (prefs.preferredHand as string) || undefined,
        courtPosition:
          (prefs.courtPosition as string) || mapPosition(row.position) || undefined,
        matchType: (prefs.matchType as string) || undefined,
        preferredPlayTime: (prefs.preferredPlayTime as string) || undefined,
        availabilityWindows: Array.isArray(prefs.availabilityWindows)
          ? (prefs.availabilityWindows as string[])
          : undefined,
      },
    };
  }

  async getMatchHistory(userId: string, limit?: number) {
    const rows = await this.loadMatchRowsForUser(userId);
    const ordered = [...rows].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let slice = ordered;
    if (limit && limit > 0) {
      slice = ordered.slice(-limit);
    }

    const levelRes = await this.db.query(`SELECT level, rating FROM players WHERE user_id = $1`, [
      userId,
    ]);
    const baseRating = resolvePlayerRating(levelRes.rows[0] ?? {});
    const matchIds = slice.map((m) => m.matchId);
    const ratingHistoryRes =
      matchIds.length > 0
        ? await this.db.query(
            `SELECT match_id, delta, rating_after
             FROM player_rating_history
             WHERE user_id = $1 AND match_id = ANY($2::uuid[])`,
            [userId, matchIds],
          )
        : { rows: [] as Array<{ match_id: string; delta: number; rating_after: number }> };
    const ratingHistory = new Map<
      string,
      { delta: number; ratingAfter: number }
    >(
      ratingHistoryRes.rows.map(
        (row): [string, { delta: number; ratingAfter: number }] => [
          row.match_id,
          {
            delta: Number(row.delta),
            ratingAfter: Number(row.rating_after),
          },
        ],
      ),
    );

    const sumDelta = slice.reduce((acc, m) => {
      const pts = parseScore(m.score);
      const draw = pts != null && pts.a === pts.b;
      const ch = draw ? 0 : m.outcome === 'win' ? 12 : m.outcome === 'loss' ? -10 : 0;
      return acc + ch;
    }, 0);

    let r = baseRating - sumDelta;
    const historyOut = slice.map((m) => {
      const pts = parseScore(m.score);
      const draw = pts != null && pts.a === pts.b;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      if (!draw) {
        result = m.outcome === 'win' ? 'win' : 'loss';
      }
      const legacyRatingChange = draw ? 0 : result === 'win' ? 12 : -10;
      const storedRating = ratingHistory.get(m.matchId);
      const ratingChange = storedRating?.delta ?? legacyRatingChange;
      r = storedRating?.ratingAfter ?? r + ratingChange;
      return {
        matchId: m.matchId,
        date: new Date(m.date).toISOString(),
        title: m.title,
        clubName: m.clubName,
        result,
        score: m.score,
        ratingChange,
        ratingAfter: r,
        opponent: m.opponentNames,
      };
    });

    const wl = tallyWL(ordered);

    return {
      currentRating: baseRating,
      totalMatches: ordered.length,
      wins: wl.wins,
      losses: wl.losses,
      draws: wl.draws,
      history: [...historyOut].reverse(),
    };
  }

  async getMatchStats(userId: string) {
    const matchRows = await this.loadMatchRowsForUser(userId);
    const wl = tallyWL(matchRows);

    const countRes = await this.db.query(
      `SELECT COUNT(DISTINCT m.id)::int AS total,
              COUNT(DISTINCT m.id) FILTER (
                WHERE m.status = 'FINISHED'
                  AND COALESCE(mr.result_status, 'pending') = 'confirmed'
              )::int AS completed,
              COUNT(DISTINCT m.id) FILTER (
                WHERE NOT (
                  m.status = 'FINISHED'
                  AND COALESCE(mr.result_status, 'pending') = 'confirmed'
                )
              )::int AS not_completed
       FROM matches m
       INNER JOIN match_players mp ON mp.match_id = m.id
         AND mp.status IN ('JOINED', 'CONFIRMED')
       INNER JOIN players p ON p.id = mp.player_id AND p.user_id = $1
       LEFT JOIN match_results mr ON mr.match_id = m.id`,
      [userId],
    );

    const row = countRes.rows[0];
    const completed = Number(row?.completed ?? 0);
    const notCompleted = Number(row?.not_completed ?? 0);
    const total = Number(row?.total ?? 0);

    return {
      wins: wl.wins,
      losses: wl.losses,
      draws: wl.draws,
      completed,
      notCompleted,
      total,
      winRate: completed > 0 ? Math.round((wl.wins / completed) * 100) : null,
    };
  }

  private async loadMatchRowsForUser(userId: string): Promise<MatchRow[]> {
    const res = await this.db.query(
      `WITH base AS (
         SELECT m.id AS match_id, m.date, m.title, m.needed_players, mr.score, mr.winner_team,
                c.name AS club_name
         FROM matches m
         LEFT JOIN clubs c ON c.id = m.club_id
         INNER JOIN match_results mr ON mr.match_id = m.id
         INNER JOIN match_players my_mp ON my_mp.match_id = m.id
         INNER JOIN players my_p ON my_p.id = my_mp.player_id AND my_p.user_id = $1
         WHERE m.status = 'FINISHED' AND my_mp.status IN ('JOINED','CONFIRMED')
       ),
       numbered AS (
         SELECT b.match_id, b.date, b.title, b.club_name, b.needed_players, b.score, b.winner_team,
                pl.user_id AS uid, u.name AS player_name,
                ROW_NUMBER() OVER (PARTITION BY mp.match_id ORDER BY mp.created_at) AS rnk
         FROM base b
         INNER JOIN match_players mp ON mp.match_id = b.match_id
           AND mp.status IN ('JOINED','CONFIRMED')
         INNER JOIN players pl ON pl.id = mp.player_id
         INNER JOIN users u ON u.id = pl.user_id
       )
       SELECT * FROM numbered
       ORDER BY date ASC, match_id, rnk`,
      [userId],
    );

    const byMatch = new Map<
      string,
      {
        matchId: string;
        date: Date;
        title: string;
        clubName?: string;
        score: string;
        winnerTeam: string;
        neededPlayers: number;
        players: { userId: string; name: string; rnk: number }[];
      }
    >();

    for (const row of res.rows) {
      const id = row.match_id;
      if (!byMatch.has(id)) {
        byMatch.set(id, {
          matchId: id,
          date: row.date,
          title: row.title || 'Partido',
          clubName: row.club_name ?? undefined,
          score: row.score,
          winnerTeam: String(row.winner_team || '').toUpperCase(),
          neededPlayers: Number(row.needed_players) || 4,
          players: [],
        });
      }
      byMatch.get(id)!.players.push({
        userId: row.uid,
        name: row.player_name,
        rnk: Number(row.rnk),
      });
    }

    const out: MatchRow[] = [];

    for (const m of byMatch.values()) {
      const me = m.players.find((p) => p.userId === userId);
      if (!me) continue;
      const myTeam = userTeamFromRank(me.rnk, m.neededPlayers);
      const pts = parseScore(m.score);
      const draw = pts != null && pts.a === pts.b;
      let outcome: 'win' | 'loss' | 'draw' = 'draw';
      if (!draw) {
        const w = m.winnerTeam === 'A' || m.winnerTeam === 'B' ? m.winnerTeam : 'A';
        outcome = myTeam === w ? 'win' : 'loss';
      }
      const opponentNames = m.players
        .filter((p) => p.userId !== userId)
        .map((p) => p.name);
      out.push({
        matchId: m.matchId,
        date: m.date,
        title: m.title,
        clubName: m.clubName,
        score: m.score,
        outcome,
        opponentNames,
      });
    }

    return out;
  }

  private async ensurePlayerProfile(userId: string) {
    await this.db.query(
      `INSERT INTO players (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.name) {
      await this.db.query(`UPDATE users SET name = $2, updated_at = NOW() WHERE id = $1`, [
        userId,
        dto.name,
      ]);
    }

    await this.ensurePlayerProfile(userId);

    const ures = await this.db.query(
      `SELECT id, bio, city, extras, rating, category_status, placement_matches_played
       FROM players WHERE user_id = $1`,
      [userId],
    );
    const prow = ures.rows[0];
    if (!prow) {
      throw new NotFoundException('No se pudo crear el perfil de jugador');
    }

    const extras = this.parseExtras(prow);
    let seedRating: number | null = null;
    let nickname: string | null | undefined;
    if (dto.nickname !== undefined) {
      const normalized = dto.nickname?.trim().toLowerCase();
      nickname = normalized ? normalized : null;
    }
    if (dto.phone !== undefined) extras.phone = dto.phone;
    if (dto.gender !== undefined) extras.gender = dto.gender;
    if (dto.birthDate !== undefined) extras.birthDate = dto.birthDate;
    if (dto.mainClubId !== undefined) extras.mainClubId = dto.mainClubId;
    if (dto.declaredCategory !== undefined) {
      const hasFederatedCategory = Boolean(extras.fejubaId || extras.fejubaCategory);
      if (hasFederatedCategory) {
        const locked =
          (typeof extras.declaredCategory === 'string' && extras.declaredCategory) ||
          (typeof extras.fejubaCategory === 'string'
            ? String(extras.fejubaCategory).match(/\b(1ra|2da|3ra|4ta|5ta|6ta|7ma|8va)\b/i)?.[1]?.toLowerCase()
            : null);
        if (locked && dto.declaredCategory !== locked) {
          throw new BadRequestException('La categoría federada no se puede modificar');
        }
        // Si manda la misma, no hace falta tocar nada.
        if (dto.declaredCategory != null) {
          extras.declaredCategory = dto.declaredCategory;
        }
      } else if (dto.declaredCategory == null) {
        delete extras.declaredCategory;
      } else {
        extras.declaredCategory = dto.declaredCategory;
        const status = normalizeCategoryStatus(prow.category_status);
        const played = Number(prow.placement_matches_played ?? 0);
        // Al declarar categoría al inicio: piso de la banda (0 puntos de progreso).
        if (status === 'provisional' && played === 0) {
          seedRating = getInitialRatingForCategory(dto.declaredCategory as PlayerCategory);
        }
      }
    }

    const bio = dto.description !== undefined ? dto.description : prow.bio;
    const hasCoords = dto.latitude != null && dto.longitude != null;
    const locationLabel =
      dto.location !== undefined && typeof dto.location === 'string' && dto.location.trim()
        ? dto.location.trim()
        : null;
    // location canónica en extras; zone/city se derivan para listados y compatibilidad.
    if (locationLabel != null) {
      extras.location = locationLabel;
    } else if (dto.location === null) {
      delete extras.location;
    }
    const locationParts = locationLabel
      ? locationLabel.split(',').map((part) => part.trim()).filter(Boolean)
      : [];
    const zoneHint = locationParts[0] || null;
    const cityHint =
      locationParts.length > 1 ? locationParts.slice(1).join(', ') : locationParts[0] || null;
    const city =
      dto.location !== undefined ? cityHint : prow.city;

    await this.db.query(
      `UPDATE players
       SET bio = $2,
           city = $3,
           zone = CASE WHEN $8::text IS NOT NULL THEN $8 ELSE zone END,
           extras = $4::jsonb,
           nickname = COALESCE($10::text, nickname),
           latitude = CASE WHEN $5 THEN $6 ELSE latitude END,
           longitude = CASE WHEN $5 THEN $7 ELSE longitude END,
           location_updated_at = CASE WHEN $5 THEN NOW() ELSE location_updated_at END,
           rating = CASE WHEN $9::int IS NOT NULL THEN $9 ELSE rating END,
           updated_at = NOW()
       WHERE user_id = $1`,
      [
        userId,
        bio,
        city,
        JSON.stringify(extras),
        hasCoords,
        hasCoords ? dto.latitude : null,
        hasCoords ? dto.longitude : null,
        zoneHint,
        seedRating,
        nickname,
      ],
    );

    return this.getProfile(userId);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    await this.ensurePlayerProfile(userId);

    const ures = await this.db.query(`SELECT id, extras FROM players WHERE user_id = $1`, [
      userId,
    ]);
    const row = ures.rows[0];
    if (!row) {
      throw new NotFoundException('Perfil de jugador no encontrado');
    }

    const extras = this.parseExtras(row);
    const preferences: Extras = { ...(extras.preferences as Extras), ...dto };
    extras.preferences = preferences;

    const positionEnum = normalizeCourtPosition(
      dto.courtPosition ?? (preferences.courtPosition as string | null | undefined),
    );

    await this.db.query(
      `UPDATE players
       SET extras = $2::jsonb,
           position = COALESCE($3::player_position, position),
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, JSON.stringify(extras), positionEnum],
    );

    return {
      preferredHand: dto.preferredHand ?? (preferences.preferredHand as string) ?? null,
      courtPosition:
        dto.courtPosition ??
        (preferences.courtPosition as string) ??
        (positionEnum ? mapPosition(positionEnum) : null),
      matchType: dto.matchType ?? (preferences.matchType as string) ?? null,
      preferredPlayTime: dto.preferredPlayTime ?? (preferences.preferredPlayTime as string) ?? null,
      availabilityWindows:
        dto.availabilityWindows ??
        (Array.isArray(preferences.availabilityWindows)
          ? (preferences.availabilityWindows as string[])
          : null),
    };
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no soportado. Usá JPG, PNG o WEBP.');
    }

    const current = await this.db.query(
      `SELECT photo_url FROM players WHERE user_id = $1`,
      [userId],
    );
    const previousPhotoUrl = current.rows[0]?.photo_url as string | undefined;

    const upload = await uploadImageBuffer(file, `playtomic-clone/avatars/${userId}`);

    await this.ensurePlayerProfile(userId);

    await this.db.query(
      `UPDATE players SET photo_url = $2, updated_at = NOW() WHERE user_id = $1`,
      [userId, upload.secure_url],
    );

    if (previousPhotoUrl && previousPhotoUrl !== upload.secure_url) {
      await deleteCloudinaryAsset(previousPhotoUrl);
    }

    return { photo: upload.secure_url };
  }
}

function mapPosition(
  pos: string | null | undefined,
): string | undefined {
  if (!pos) return undefined;
  const m: Record<string, string> = {
    drive: 'Drive',
    reves: 'Revés',
    ambos: 'Ambos',
  };
  return m[pos] ?? pos;
}

function normalizeCourtPosition(
  value?: string | null,
): 'drive' | 'reves' | 'ambos' | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === 'drive') return 'drive';
  if (v === 'reves' || v === 'revés') return 'reves';
  if (v === 'ambos' || v === 'both') return 'ambos';
  return null;
}
