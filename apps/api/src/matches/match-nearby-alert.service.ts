import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { resolveNearbyMatchCategories } from '../notifications/notification-categories';
import { nextPushTimeOutsideQuietHours } from '../notifications/quiet-hours';
import { categoriesForMatchLevel } from '../common/utils/level-range.util';
import { playerFitsMatchGender, resolvePlayerRating, resolveVisibleLevelCategory } from '../common/utils';

export const NEARBY_MATCH_RADIUS_KM = 5;
const MAX_CANDIDATES = 500;
/** Tope de avisos de partidos cercanos por jugador en 24 h, para que no se vuelva spam. */
const DAILY_LIMIT_PER_PLAYER = 4;
/** Ubicaciones más viejas que esto no sirven para decir "cerca tuyo". */
const LOCATION_MAX_AGE_DAYS = 45;
const AR_TZ = 'America/Argentina/Buenos_Aires';

type MatchRow = {
  id: string;
  status: string;
  mode: string | null;
  gender: string | null;
  level_min: number | null;
  level_max: number | null;
  date: string;
  needed_players: number;
  venue_note: string | null;
  club_id: string | null;
  club_name: string | null;
  lat: number | null;
  lng: number | null;
  joined_count: number;
};

type CandidateRow = {
  user_id: string;
  rating: number | null;
  category_status: string | null;
  extras: Record<string, unknown> | null;
  preferences: unknown;
  distance_km: number;
};

function visibleCategory(row: {
  rating: number | null;
  category_status: string | null;
  extras: Record<string, unknown> | null;
}): string {
  const extras = row.extras && typeof row.extras === 'object' ? row.extras : {};
  return resolveVisibleLevelCategory({
    rating: resolvePlayerRating(row),
    categoryStatus: row.category_status,
    declaredCategory: typeof extras.declaredCategory === 'string' ? extras.declaredCategory : null,
    lockDeclaredCategory: Boolean(extras.fejubaId || extras.fejubaCategory),
  });
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Un jugador';
}

function formatDistance(km: number): string {
  if (km < 1) return 'a menos de 1 km';
  return `a ${Math.round(km)} km`;
}

function formatWhen(date: Date): string {
  const now = new Date();
  const day = (d: Date) => d.toLocaleDateString('es-AR', { timeZone: AR_TZ });
  const time = date.toLocaleTimeString('es-AR', {
    timeZone: AR_TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
  if (day(date) === day(now)) return `hoy ${time}`;
  if (day(date) === day(new Date(now.getTime() + 86_400_000))) return `mañana ${time}`;
  const weekday = date.toLocaleDateString('es-AR', {
    timeZone: AR_TZ,
    weekday: 'short',
    day: 'numeric',
  });
  return `${weekday} ${time}`;
}

function categoryRangeLabel(categories: string[]): string {
  if (categories.length === 0 || categories.length === 8) return 'todas las categorías';
  if (categories.length === 1) return categories[0];
  return `${categories[categories.length - 1]} a ${categories[0]}`;
}

@Injectable()
export class MatchNearbyAlertService {
  private readonly logger = new Logger(MatchNearbyAlertService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Avisa a jugadores a menos de 5 km que tengan activado "Partidos cerca tuyo" y cuyas
   * categorías elegidas (por defecto, la propia) coincidan con el nivel del partido.
   */
  async notifyNearbyPlayers(matchId: string, creatorUserId: string): Promise<number> {
    const match = await this.loadMatch(matchId);
    if (!match || match.status !== 'OPEN' || match.lat == null || match.lng == null) return 0;
    const spotsLeft = Math.max(0, Number(match.needed_players) - Number(match.joined_count));
    const startsAt = new Date(match.date);
    if (spotsLeft === 0 || startsAt.getTime() < Date.now()) return 0;

    const creator = await this.db.query<{
      name: string;
      rating: number | null;
      category_status: string | null;
      extras: Record<string, unknown> | null;
    }>(
      `SELECT u.name, p.rating, p.category_status, p.extras
       FROM users u LEFT JOIN players p ON p.user_id = u.id
       WHERE u.id = $1`,
      [creatorUserId],
    );
    const creatorRow = creator.rows[0];
    if (!creatorRow) return 0;
    const creatorCategory = visibleCategory(creatorRow);

    const hasLevel = match.mode === 'competitive' && (match.level_min != null || match.level_max != null);
    const matchCategories: string[] = hasLevel
      ? categoriesForMatchLevel(match.level_min, match.level_max)
      : [creatorCategory];

    const candidates = await this.findCandidates(match, creatorUserId);
    const pushAfter = nextPushTimeOutsideQuietHours(new Date());
    // Si el aviso quedaría para después del inicio (horario de descanso), no tiene sentido.
    if (pushAfter.getTime() >= startsAt.getTime()) return 0;

    const recipients = candidates.filter((candidate) => {
      if (!playerFitsMatchGender(match.gender, candidate.extras?.gender as string | undefined).ok) {
        return false;
      }
      const chosen = resolveNearbyMatchCategories(candidate.preferences);
      const wanted = chosen.length ? chosen : [visibleCategory(candidate)];
      return wanted.some((category) => matchCategories.includes(category));
    });
    if (recipients.length === 0) return 0;

    const name = firstName(creatorRow.name);
    const when = formatWhen(startsAt);
    const where = match.club_name || match.venue_note || null;
    const level = hasLevel ? categoryRangeLabel(matchCategories) : `nivel ${creatorCategory}`;
    const spots = spotsLeft === 1 ? 'Falta 1 jugador' : `Faltan ${spotsLeft} jugadores`;

    await this.notifications.createMany(
      recipients.map((candidate) => ({
        userId: candidate.user_id,
        type: 'NEARBY_MATCH_CREATED',
        title: `${name} arma partido ${formatDistance(candidate.distance_km)}`,
        body: `${when}${where ? ` · ${where}` : ''} · ${level}. ${spots}, ¿te sumás?`,
        data: {
          matchId,
          clubId: match.club_id,
          distanceKm: Math.round(candidate.distance_km * 10) / 10,
        },
        pushAfter,
      })),
    );
    this.logger.log(`Partido ${matchId}: aviso de partido cercano a ${recipients.length} jugador(es)`);
    return recipients.length;
  }

  private async loadMatch(matchId: string): Promise<MatchRow | null> {
    const result = await this.db.query<MatchRow>(
      `SELECT m.id, m.status, m.mode, m.gender, m.level_min, m.level_max, m.date,
              m.needed_players, m.venue_note, m.club_id, c.name AS club_name,
              COALESCE(c.latitude::float8, creator.latitude::float8) AS lat,
              COALESCE(c.longitude::float8, creator.longitude::float8) AS lng,
              (
                (SELECT COUNT(*)::int FROM match_players mp
                  WHERE mp.match_id = m.id AND mp.status IN ('JOINED', 'CONFIRMED'))
                + (SELECT COUNT(*)::int FROM match_guests mg WHERE mg.match_id = m.id)
              ) AS joined_count
       FROM matches m
       LEFT JOIN clubs c ON c.id = m.club_id
       LEFT JOIN players creator ON creator.user_id = m.created_by_user_id
       WHERE m.id = $1`,
      [matchId],
    );
    return result.rows[0] ?? null;
  }

  private async findCandidates(match: MatchRow, creatorUserId: string): Promise<CandidateRow[]> {
    const result = await this.db.query<CandidateRow>(
      `WITH nearby AS (
         SELECT p.user_id, p.rating, p.category_status, p.extras,
                6371 * acos(LEAST(1, GREATEST(-1,
                  cos(radians($2)) * cos(radians(p.latitude::float8))
                  * cos(radians(p.longitude::float8) - radians($3))
                  + sin(radians($2)) * sin(radians(p.latitude::float8))
                ))) AS distance_km
         FROM players p
         INNER JOIN users u ON u.id = p.user_id AND u.role = 'PLAYER'
         WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
           AND p.location_updated_at > NOW() - make_interval(days => $6::int)
           AND p.user_id <> $4
           -- Prefiltro rápido por caja (~1° lat = 111 km) antes de la distancia exacta.
           AND p.latitude::float8 BETWEEN $2 - ($5 / 111.0) AND $2 + ($5 / 111.0)
       )
       SELECT n.user_id, n.rating, n.category_status, n.extras, n.distance_km,
              np.preferences
       FROM nearby n
       LEFT JOIN user_notification_preferences np ON np.user_id = n.user_id
       WHERE n.distance_km <= $5
         AND COALESCE(np.preferences ->> 'nearby_matches', 'true') <> 'false'
         AND NOT EXISTS (
           SELECT 1 FROM match_players mp
           INNER JOIN players mpp ON mpp.id = mp.player_id
           WHERE mp.match_id = $1 AND mpp.user_id = n.user_id
         )
         AND NOT EXISTS (
           SELECT 1 FROM blocked_users b
           WHERE (b.blocker_id = n.user_id AND b.blocked_id = $4)
              OR (b.blocker_id = $4 AND b.blocked_id = n.user_id)
         )
         AND (
           SELECT COUNT(*) FROM notifications nt
           WHERE nt.user_id = n.user_id AND nt.type = 'NEARBY_MATCH_CREATED'
             AND nt.created_at > NOW() - INTERVAL '24 hours'
         ) < $7
       ORDER BY n.distance_km ASC
       LIMIT $8`,
      [
        match.id,
        match.lat,
        match.lng,
        creatorUserId,
        NEARBY_MATCH_RADIUS_KM,
        LOCATION_MAX_AGE_DAYS,
        DAILY_LIMIT_PER_PLAYER,
        MAX_CANDIDATES,
      ],
    );
    return result.rows.map((row) => ({ ...row, distance_km: Number(row.distance_km) }));
  }
}
