import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MatchesService } from '../matches/matches.service';

type NearbyOptions = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
};

const DEFAULT_RADIUS_KM = 30;
const MAX_RADIUS_KM = 100;

@Injectable()
export class CommunityService {
  constructor(
    private readonly db: DatabaseService,
    private readonly matchesService: MatchesService,
  ) {}

  async feed(userId: string) {
    await this.matchesService.expirePastCourtWindowMatches();

    const openMatches = await this.db.query(
      `SELECT m.id,
              m.title,
              m.date,
              m.zone,
              m.needed_players,
              m.status,
              m.level_min,
              m.level_max,
              c.id AS club_id,
              c.name AS club_name,
              (
                SELECT COUNT(*)::int
                FROM match_players mp
                WHERE mp.match_id = m.id AND mp.status IN ('JOINED', 'CONFIRMED')
              ) AS joined_count
       FROM matches m
       LEFT JOIN clubs c ON c.id = m.club_id
       WHERE m.status IN ('OPEN', 'FULL')
       ORDER BY m.date ASC
       LIMIT 20`,
    );

    const recentResults = await this.db.query(
      `SELECT mr.match_id, mr.score, mr.winner_team, mr.created_at
       FROM match_results mr
       ORDER BY mr.created_at DESC
       LIMIT 10`,
    );

    return {
      openMatches: openMatches.rows,
      recentResults: recentResults.rows,
    };
  }

  async recentMatches(limit = 30) {
    const result = await this.db.query(
      `SELECT mr.match_id,
              mr.score,
              mr.winner_team,
              mr.created_at,
              m.title,
              m.date,
              m.mode,
              m.needed_players,
              c.id AS club_id,
              c.name AS club_name
       FROM match_results mr
       INNER JOIN matches m ON m.id = mr.match_id
       LEFT JOIN clubs c ON c.id = m.club_id
       ORDER BY mr.created_at DESC
       LIMIT $1`,
      [limit],
    );

    return result.rows;
  }

  async nearbyPlayers(viewerUserId: string, opts: NearbyOptions = {}) {
    const radiusKm = this.normalizeRadius(opts.radiusKm);
    let lat = this.normalizeCoord(opts.lat);
    let lng = this.normalizeCoord(opts.lng);

    if (lat != null && lng != null) {
      await this.saveViewerCoordinates(viewerUserId, lat, lng);
    } else {
      const stored = await this.db.query(
        `SELECT latitude, longitude FROM players WHERE user_id = $1`,
        [viewerUserId],
      );
      const row = stored.rows[0];
      lat = this.normalizeCoord(row?.latitude);
      lng = this.normalizeCoord(row?.longitude);
    }

    if (lat != null && lng != null) {
      return this.queryPlayersByDistance(viewerUserId, lat, lng, radiusKm);
    }

    return this.queryPlayersByZoneFallback(viewerUserId);
  }

  private normalizeRadius(radiusKm?: number): number {
    if (radiusKm == null || !Number.isFinite(radiusKm) || radiusKm <= 0) {
      return DEFAULT_RADIUS_KM;
    }
    return Math.min(radiusKm, MAX_RADIUS_KM);
  }

  private normalizeCoord(value: unknown): number | null {
    if (value == null) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private async saveViewerCoordinates(viewerUserId: string, lat: number, lng: number) {
    await this.db.query(
      `UPDATE players
       SET latitude = $2,
           longitude = $3,
           location_updated_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1`,
      [viewerUserId, lat, lng],
    );
  }

  private async queryPlayersByDistance(
    viewerUserId: string,
    lat: number,
    lng: number,
    radiusKm: number,
  ) {
    const result = await this.db.query(
      `SELECT p.id,
              p.nickname,
              p.city,
              p.zone,
              p.level,
              p.rating,
              p.position,
              p.photo_url,
              u.name,
              u.id AS user_id,
              ROUND(
                (
                  6371 * acos(
                    LEAST(
                      1,
                      GREATEST(
                        -1,
                        cos(radians($2::float8)) * cos(radians(p.latitude::float8))
                        * cos(radians(p.longitude::float8) - radians($3::float8))
                        + sin(radians($2::float8)) * sin(radians(p.latitude::float8))
                      )
                    )
                  )
                )::numeric,
                1
              ) AS distance_km
       FROM players p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.user_id != $1
         AND p.latitude IS NOT NULL
         AND p.longitude IS NOT NULL
         AND u.role = 'PLAYER'
         AND (
           6371 * acos(
             LEAST(
               1,
               GREATEST(
                 -1,
                 cos(radians($2::float8)) * cos(radians(p.latitude::float8))
                 * cos(radians(p.longitude::float8) - radians($3::float8))
                 + sin(radians($2::float8)) * sin(radians(p.latitude::float8))
               )
             )
           )
         ) <= $4
       ORDER BY distance_km ASC
       LIMIT 20`,
      [viewerUserId, lat, lng, radiusKm],
    );

    return result.rows;
  }

  private async queryPlayersByZoneFallback(viewerUserId: string) {
    const viewerProfile = await this.db.query(
      `SELECT zone, city FROM players WHERE user_id = $1`,
      [viewerUserId],
    );
    const zone = viewerProfile.rows[0]?.zone ?? null;
    const city = viewerProfile.rows[0]?.city ?? null;

    if (!zone && !city) {
      return [];
    }

    const result = await this.db.query(
      `SELECT p.id,
              p.nickname,
              p.city,
              p.zone,
              p.level,
              p.rating,
              p.position,
              p.photo_url,
              u.name,
              u.id AS user_id,
              NULL::numeric AS distance_km
       FROM players p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.user_id != $1
         AND u.role = 'PLAYER'
         AND (
           ($2::text IS NOT NULL AND p.zone ILIKE $2)
           OR ($3::text IS NOT NULL AND p.city ILIKE $3)
         )
       ORDER BY p.updated_at DESC
       LIMIT 20`,
      [viewerUserId, zone, city],
    );

    return result.rows;
  }
}
