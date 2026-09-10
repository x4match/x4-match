import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getMonthKey, getLevelCategory, resolvePlayerRating } from '../common/utils';
import { isCategoryWithinSearchSteps } from '../common/utils/level-range.util';
import { userTeamFromRank } from '../common/utils/match-result.util';
import { ClubPointsService } from '../clubs/club-points.service';
import { DatabaseService } from '../database/database.service';
import {
  CHALLENGE_COOLDOWN_DAYS,
  CHALLENGE_EXPIRY_HOURS,
  INTERCLUB_PLAY_POINTS,
  INTERCLUB_WIN_POINTS,
  PARTNER_CANDIDATE_LIMIT,
  oppositePosition,
  positionsAreCompatible,
} from './challenge.util';
import { AcceptChallengeDto, CreateChallengeDto } from './dto/challenge.dto';

type RankRow = {
  user_id: string;
  name: string;
  nickname: string | null;
  photo_url: string | null;
  points: number;
  rank: number;
  position?: string | null;
  rating?: number | null;
  level?: number | null;
};

@Injectable()
export class ChallengesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly clubPointsService: ClubPointsService,
  ) {}

  async getEligibility(clubId: string, userId: string) {
    await this.assertClubExists(clubId);
    const monthKey = getMonthKey();
    const top = await this.getClubRankOne(clubId, monthKey);
    const isNumberOne = top?.user_id === userId;
    const me = await this.getPlayerProfile(userId);
    const partners = isNumberOne
      ? await this.listPartnerCandidates(clubId, userId, me?.position ?? null)
      : [];

    return {
      clubId,
      monthKey,
      isNumberOne,
      anchor: top
        ? {
            userId: top.user_id,
            name: top.name,
            nickname: top.nickname,
            photo: top.photo_url,
            points: top.points,
            rank: Number(top.rank),
            position: top.position ?? null,
          }
        : null,
      myPosition: me?.position ?? null,
      preferredPartnerSide: oppositePosition(me?.position ?? null),
      partners,
    };
  }

  async listChallengeableClubs(clubId: string, userId: string) {
    const eligibility = await this.getEligibility(clubId, userId);
    if (!eligibility.isNumberOne) {
      throw new ForbiddenException('Solo el #1 del ranking mensual del club puede desafiar');
    }

    const monthKey = getMonthKey();
    const myCat = await this.getUserCategory(userId);
    const clubs = await this.db.query(
      `SELECT c.id, c.name, c.city, c.zone, c.logo_url, c.interclub_wins
       FROM clubs c
       WHERE c.id <> $1
       ORDER BY c.name ASC
       LIMIT 100`,
      [clubId],
    );

    const rows = [];
    for (const club of clubs.rows) {
      const rankOne = await this.getClubRankOne(club.id, monthKey);
      if (!rankOne) continue;
      const theirCat = getLevelCategory(
        resolvePlayerRating({ rating: rankOne.rating, level: rankOne.level }),
      );
      if (myCat && theirCat && !isCategoryWithinSearchSteps(myCat, theirCat)) continue;

      const cooldown = await this.hasCooldown(clubId, club.id);
      rows.push({
        clubId: club.id,
        name: club.name,
        city: club.city,
        zone: club.zone,
        logoUrl: club.logo_url,
        interclubWins: Number(club.interclub_wins ?? 0),
        cooldownActive: cooldown,
        numberOne: {
          userId: rankOne.user_id,
          name: rankOne.name,
          nickname: rankOne.nickname,
          photo: rankOne.photo_url,
          points: rankOne.points,
          position: rankOne.position ?? null,
          levelCategory: theirCat,
        },
      });
    }

    return { monthKey, clubs: rows };
  }

  async create(userId: string, dto: CreateChallengeDto) {
    if (dto.challengerClubId === dto.challengedClubId) {
      throw new BadRequestException('No podés desafiar a tu propio club');
    }
    if (dto.partnerUserId === userId) {
      throw new BadRequestException('Elegí un compañero distinto a vos');
    }

    const monthKey = getMonthKey();
    const myRank = await this.getClubRankOne(dto.challengerClubId, monthKey);
    if (!myRank || myRank.user_id !== userId) {
      throw new ForbiddenException('Solo el #1 del ranking mensual puede crear el desafío');
    }

    const theirRank = await this.getClubRankOne(dto.challengedClubId, monthKey);
    if (!theirRank) {
      throw new BadRequestException('El club rival no tiene #1 este mes');
    }
    if (theirRank.user_id === userId) {
      throw new BadRequestException('El #1 rival no puede ser el mismo jugador');
    }

    const myCat = await this.getUserCategory(userId);
    const theirCat = await this.getUserCategory(theirRank.user_id);
    if (myCat && theirCat && !isCategoryWithinSearchSteps(myCat, theirCat)) {
      throw new BadRequestException('Los #1 deben estar a lo sumo 2 categorías de diferencia');
    }

    if (await this.hasCooldown(dto.challengerClubId, dto.challengedClubId)) {
      throw new BadRequestException(
        `Debés esperar ${CHALLENGE_COOLDOWN_DAYS} días para volver a desafiar a este club`,
      );
    }

    const active = await this.db.query(
      `SELECT id FROM club_challenges
       WHERE challenger_anchor_user_id = $1
         AND status IN ('PENDING_OPPONENT', 'PENDING_PARTNER', 'SCHEDULED')
       LIMIT 1`,
      [userId],
    );
    if (active.rows[0]) {
      throw new BadRequestException('Ya tenés un desafío activo');
    }

    await this.assertValidPartner(dto.challengerClubId, userId, dto.partnerUserId);

    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_HOURS * 60 * 60 * 1000);
    const proposedDate = dto.proposedDate ? new Date(dto.proposedDate) : null;

    const insert = await this.db.query(
      `INSERT INTO club_challenges (
         challenger_club_id, challenged_club_id,
         challenger_anchor_user_id, challenger_partner_user_id,
         challenged_anchor_user_id,
         month_key, challenger_rank_snapshot, challenged_rank_snapshot,
         status, proposed_date, expires_at
       ) VALUES ($1,$2,$3,$4,$5,$6,1,1,'PENDING_OPPONENT',$7,$8)
       RETURNING *`,
      [
        dto.challengerClubId,
        dto.challengedClubId,
        userId,
        dto.partnerUserId,
        theirRank.user_id,
        monthKey,
        proposedDate,
        expiresAt,
      ],
    );

    const challenge = insert.rows[0];
    await this.notify(
      theirRank.user_id,
      'CLUB_CHALLENGE',
      '¡Te desafiaron!',
      'El #1 de otro club te desafió a un 2v2 interclub. Aceptá y elegí compañero.',
      { challengeId: challenge.id },
    );

    return this.getChallenge(challenge.id, userId);
  }

  async accept(challengeId: string, userId: string, dto: AcceptChallengeDto) {
    const challenge = await this.requireChallenge(challengeId);
    if (challenge.status === 'EXPIRED' || new Date(challenge.expires_at) < new Date()) {
      await this.db.query(
        `UPDATE club_challenges SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`,
        [challengeId],
      );
      throw new BadRequestException('Este desafío expiró');
    }
    if (challenge.status !== 'PENDING_OPPONENT') {
      throw new BadRequestException('Este desafío ya no está pendiente de aceptación');
    }
    if (challenge.challenged_anchor_user_id !== userId) {
      throw new ForbiddenException('Solo el #1 desafiado puede aceptar');
    }
    if (dto.partnerUserId === userId) {
      throw new BadRequestException('Elegí un compañero distinto a vos');
    }

    await this.assertValidPartner(challenge.challenged_club_id, userId, dto.partnerUserId);

    const matchDate = dto.proposedDate
      ? new Date(dto.proposedDate)
      : challenge.proposed_date
        ? new Date(challenge.proposed_date)
        : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const matchId = await this.createChallengeMatch(
      challenge,
      userId,
      dto.partnerUserId,
      matchDate,
    );

    await this.db.query(
      `UPDATE club_challenges
       SET challenged_partner_user_id = $2,
           status = 'SCHEDULED',
           match_id = $3,
           proposed_date = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [challengeId, dto.partnerUserId, matchId, matchDate],
    );

    for (const uid of [
      challenge.challenger_anchor_user_id,
      challenge.challenger_partner_user_id,
      dto.partnerUserId,
    ]) {
      await this.notify(
        uid,
        'CLUB_CHALLENGE',
        'Desafío aceptado',
        'El 2v2 interclub ya está armado. ¡A jugar!',
        { challengeId, matchId },
      );
    }

    return this.getChallenge(challengeId, userId);
  }

  async decline(challengeId: string, userId: string) {
    const challenge = await this.requireChallenge(challengeId);
    if (challenge.challenged_anchor_user_id !== userId) {
      throw new ForbiddenException('Solo el #1 desafiado puede rechazar');
    }
    if (challenge.status !== 'PENDING_OPPONENT') {
      throw new BadRequestException('Este desafío ya no se puede rechazar');
    }

    await this.db.query(
      `UPDATE club_challenges
       SET status = 'DECLINED', updated_at = NOW()
       WHERE id = $1`,
      [challengeId],
    );

    await this.notify(
      challenge.challenger_anchor_user_id,
      'CLUB_CHALLENGE',
      'Desafío rechazado',
      'El #1 rival rechazó el desafío interclub.',
      { challengeId },
    );

    return this.getChallenge(challengeId, userId);
  }

  async listMine(userId: string) {
    const result = await this.db.query(
      `SELECT c.*,
              cc.name AS challenger_club_name,
              cd.name AS challenged_club_name
       FROM club_challenges c
       INNER JOIN clubs cc ON cc.id = c.challenger_club_id
       INNER JOIN clubs cd ON cd.id = c.challenged_club_id
       WHERE $1 IN (
         c.challenger_anchor_user_id,
         c.challenger_partner_user_id,
         c.challenged_anchor_user_id,
         c.challenged_partner_user_id
       )
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [userId],
    );
    return Promise.all(result.rows.map((row) => this.mapChallenge(row)));
  }

  async getChallenge(challengeId: string, viewerUserId?: string) {
    const challenge = await this.requireChallenge(challengeId);
    const mapped = await this.mapChallenge(challenge);
    return {
      ...mapped,
      viewerRole: viewerUserId ? this.viewerRole(challenge, viewerUserId) : null,
    };
  }

  async completeFromMatch(matchId: string) {
    const challengeRes = await this.db.query(
      `SELECT * FROM club_challenges WHERE match_id = $1 AND status = 'SCHEDULED' LIMIT 1`,
      [matchId],
    );
    const challenge = challengeRes.rows[0];
    if (!challenge) return null;

    const matchRes = await this.db.query(
      `SELECT m.id, m.needed_players, mr.winner_team, mr.score, mr.sets
       FROM matches m
       INNER JOIN match_results mr ON mr.match_id = m.id
       WHERE m.id = $1 AND mr.result_status = 'confirmed'`,
      [matchId],
    );
    const match = matchRes.rows[0];
    if (!match) return null;

    const playersRes = await this.db.query(
      `SELECT p.user_id,
              ROW_NUMBER() OVER (ORDER BY mp.created_at) AS rnk
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND mp.status IN ('JOINED', 'CONFIRMED')`,
      [matchId],
    );

    const neededPlayers = Number(match.needed_players) || 4;
    const winnerTeam = String(match.winner_team || '')
      .toUpperCase()
      .trim();
    if (winnerTeam !== 'A' && winnerTeam !== 'B') return null;

    const challengerIds = new Set([
      challenge.challenger_anchor_user_id,
      challenge.challenger_partner_user_id,
    ]);

    let challengerTeam: 'A' | 'B' | null = null;
    for (const row of playersRes.rows) {
      if (challengerIds.has(row.user_id)) {
        challengerTeam = userTeamFromRank(Number(row.rnk), neededPlayers);
        break;
      }
    }
    if (!challengerTeam) return null;

    const winnerClubId =
      winnerTeam === challengerTeam
        ? challenge.challenger_club_id
        : challenge.challenged_club_id;
    const loserClubId =
      winnerClubId === challenge.challenger_club_id
        ? challenge.challenged_club_id
        : challenge.challenger_club_id;

    const winnerUserIds =
      winnerClubId === challenge.challenger_club_id
        ? [challenge.challenger_anchor_user_id, challenge.challenger_partner_user_id]
        : [challenge.challenged_anchor_user_id, challenge.challenged_partner_user_id];
    const loserUserIds =
      winnerClubId === challenge.challenger_club_id
        ? [challenge.challenged_anchor_user_id, challenge.challenged_partner_user_id]
        : [challenge.challenger_anchor_user_id, challenge.challenger_partner_user_id];

    await this.db.query(
      `UPDATE club_challenges
       SET status = 'COMPLETED', winner_club_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [challenge.id, winnerClubId],
    );
    await this.db.query(
      `UPDATE clubs SET interclub_wins = interclub_wins + 1 WHERE id = $1`,
      [winnerClubId],
    );

    const monthKey = getMonthKey();
    for (const uid of winnerUserIds.filter(Boolean)) {
      await this.clubPointsService.addPoints(
        winnerClubId,
        uid,
        INTERCLUB_WIN_POINTS,
        'INTERCLUB_WIN',
        challenge.id,
        { monthKey, baseAmount: INTERCLUB_WIN_POINTS, multiplier: 1, countMatch: false },
      );
      await this.awardBadge(uid, 'interclub_champion', matchId);
      await this.awardBadge(uid, 'interclub_challenger', matchId);
    }
    for (const uid of loserUserIds.filter(Boolean)) {
      await this.clubPointsService.addPoints(
        loserClubId,
        uid,
        INTERCLUB_PLAY_POINTS,
        'INTERCLUB_PLAY',
        challenge.id,
        { monthKey, baseAmount: INTERCLUB_PLAY_POINTS, multiplier: 1, countMatch: false },
      );
      await this.awardBadge(uid, 'interclub_challenger', matchId);
    }

    for (const uid of [...winnerUserIds, ...loserUserIds].filter(Boolean)) {
      await this.notify(
        uid,
        'CLUB_CHALLENGE',
        'Desafío finalizado',
        'El 2v2 interclub terminó. ¡Compartí el resultado!',
        { challengeId: challenge.id, matchId, winnerClubId },
      );
    }

    return { challengeId: challenge.id, winnerClubId, matchId };
  }

  async expireStale() {
    const result = await this.db.query(
      `UPDATE club_challenges
       SET status = 'EXPIRED', updated_at = NOW()
       WHERE status = 'PENDING_OPPONENT' AND expires_at < NOW()
       RETURNING id`,
    );
    return result.rowCount ?? 0;
  }

  private async createChallengeMatch(
    challenge: Record<string, any>,
    challengedAnchorUserId: string,
    challengedPartnerUserId: string,
    matchDate: Date,
  ) {
    // Order: Team A = challenger anchor + partner; Team B = challenged anchor + partner
    const userIds = [
      challenge.challenger_anchor_user_id,
      challenge.challenger_partner_user_id,
      challengedAnchorUserId,
      challengedPartnerUserId,
    ];

    const clubs = await this.db.query(
      `SELECT id, name FROM clubs WHERE id = ANY($1)`,
      [[challenge.challenger_club_id, challenge.challenged_club_id]],
    );
    const nameById = new Map(clubs.rows.map((c) => [c.id, c.name]));
    const title = `Desafío interclub: ${nameById.get(challenge.challenger_club_id) ?? 'Club A'} vs ${nameById.get(challenge.challenged_club_id) ?? 'Club B'}`;

    const endsAt = new Date(matchDate.getTime() + 90 * 60 * 1000);
    const matchInsert = await this.db.query(
      `INSERT INTO matches (
         club_id, created_by_user_id, title, description, date, ends_at, zone,
         gender, mode, needed_players, court_booking, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'open','competitive',4,'none','CONFIRMED')
       RETURNING id`,
      [
        challenge.challenged_club_id,
        challenge.challenger_anchor_user_id,
        title,
        'Desafío interclub 2v2 entre #1 de cada club.',
        matchDate,
        endsAt,
        null,
      ],
    );
    const matchId = matchInsert.rows[0].id as string;

    for (let i = 0; i < userIds.length; i += 1) {
      const playerRes = await this.db.query(`SELECT id FROM players WHERE user_id = $1`, [
        userIds[i],
      ]);
      const playerId = playerRes.rows[0]?.id;
      if (!playerId) continue;
      await this.db.query(
        `INSERT INTO match_players (match_id, player_id, status, slot_order)
         VALUES ($1, $2, 'CONFIRMED', $3)
         ON CONFLICT (match_id, player_id) DO UPDATE SET status = 'CONFIRMED', slot_order = $3`,
        [matchId, playerId, i + 1],
      );
    }

    await this.db.query(
      `INSERT INTO chats (match_id, type) VALUES ($1, 'MATCH') ON CONFLICT (match_id) DO NOTHING`,
      [matchId],
    );

    return matchId;
  }

  private async listPartnerCandidates(
    clubId: string,
    anchorUserId: string,
    anchorPosition: string | null,
  ) {
    const monthKey = getMonthKey();
    const result = await this.db.query(
      `SELECT cmmp.user_id, u.name, p.nickname, p.photo_url, p.position,
              cmmp.points, cmmp.matches_played,
              RANK() OVER (ORDER BY cmmp.points DESC, cmmp.matches_played DESC) AS rank
       FROM club_member_monthly_points cmmp
       INNER JOIN users u ON u.id = cmmp.user_id
       INNER JOIN players p ON p.user_id = cmmp.user_id
       WHERE cmmp.club_id = $1 AND cmmp.month_key = $2 AND cmmp.user_id <> $3 AND cmmp.points > 0
       ORDER BY cmmp.points DESC
       LIMIT $4`,
      [clubId, monthKey, anchorUserId, PARTNER_CANDIDATE_LIMIT],
    );

    return result.rows
      .filter((row) => positionsAreCompatible(anchorPosition as any, row.position))
      .map((row) => ({
        userId: row.user_id,
        name: row.name,
        nickname: row.nickname,
        photo: row.photo_url,
        position: row.position,
        points: row.points,
        rank: Number(row.rank),
        compatibleSide: positionsAreCompatible(anchorPosition as any, row.position),
      }));
  }

  private async assertValidPartner(clubId: string, anchorUserId: string, partnerUserId: string) {
    const monthKey = getMonthKey();
    const partner = await this.db.query(
      `SELECT cmmp.user_id, p.position
       FROM club_member_monthly_points cmmp
       INNER JOIN players p ON p.user_id = cmmp.user_id
       WHERE cmmp.club_id = $1 AND cmmp.month_key = $2 AND cmmp.user_id = $3`,
      [clubId, monthKey, partnerUserId],
    );
    if (!partner.rows[0]) {
      throw new BadRequestException('El compañero debe figurar en el ranking mensual de tu club');
    }
    const anchor = await this.getPlayerProfile(anchorUserId);
    if (!positionsAreCompatible(anchor?.position as any, partner.rows[0].position)) {
      throw new BadRequestException(
        'El compañero debe jugar el lado opuesto (drive/revés). Evitá dos drives o dos revés.',
      );
    }
  }

  private async getClubRankOne(clubId: string, monthKey: string): Promise<RankRow | null> {
    const result = await this.db.query(
      `SELECT cmmp.user_id, u.name, p.nickname, p.photo_url, p.position, p.rating, p.level,
              cmmp.points,
              RANK() OVER (ORDER BY cmmp.points DESC, cmmp.matches_played DESC) AS rank
       FROM club_member_monthly_points cmmp
       INNER JOIN users u ON u.id = cmmp.user_id
       LEFT JOIN players p ON p.user_id = cmmp.user_id
       WHERE cmmp.club_id = $1 AND cmmp.month_key = $2 AND cmmp.points > 0
       ORDER BY cmmp.points DESC, cmmp.matches_played DESC
       LIMIT 1`,
      [clubId, monthKey],
    );
    return result.rows[0] ?? null;
  }

  private async hasCooldown(clubA: string, clubB: string) {
    const result = await this.db.query(
      `SELECT 1 FROM club_challenges
       WHERE (
           (challenger_club_id = $1 AND challenged_club_id = $2)
           OR (challenger_club_id = $2 AND challenged_club_id = $1)
         )
         AND created_at >= NOW() - ($3::text || ' days')::interval
         AND status NOT IN ('DECLINED', 'CANCELLED', 'EXPIRED')
       LIMIT 1`,
      [clubA, clubB, CHALLENGE_COOLDOWN_DAYS],
    );
    return Boolean(result.rows[0]);
  }

  private async getUserCategory(userId: string) {
    const result = await this.db.query(
      `SELECT rating, level FROM players WHERE user_id = $1`,
      [userId],
    );
    if (!result.rows[0]) return null;
    return getLevelCategory(resolvePlayerRating(result.rows[0]));
  }

  private async getPlayerProfile(userId: string) {
    const result = await this.db.query(
      `SELECT user_id, position, rating, level, nickname, photo_url FROM players WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  private async requireChallenge(id: string) {
    const result = await this.db.query(`SELECT * FROM club_challenges WHERE id = $1`, [id]);
    if (!result.rows[0]) throw new NotFoundException('Desafío no encontrado');
    return result.rows[0];
  }

  private async assertClubExists(clubId: string) {
    const result = await this.db.query(`SELECT id FROM clubs WHERE id = $1`, [clubId]);
    if (!result.rows[0]) throw new NotFoundException('Club no encontrado');
  }

  private viewerRole(challenge: Record<string, any>, userId: string) {
    if (challenge.challenger_anchor_user_id === userId) return 'challenger_anchor';
    if (challenge.challenger_partner_user_id === userId) return 'challenger_partner';
    if (challenge.challenged_anchor_user_id === userId) return 'challenged_anchor';
    if (challenge.challenged_partner_user_id === userId) return 'challenged_partner';
    return null;
  }

  private async mapChallenge(row: Record<string, any>) {
    const clubIds = [row.challenger_club_id, row.challenged_club_id];
    const clubs = await this.db.query(
      `SELECT id, name, logo_url, interclub_wins FROM clubs WHERE id = ANY($1)`,
      [clubIds],
    );
    const clubMap = new Map(clubs.rows.map((c) => [c.id, c]));

    const userIds = [
      row.challenger_anchor_user_id,
      row.challenger_partner_user_id,
      row.challenged_anchor_user_id,
      row.challenged_partner_user_id,
    ].filter(Boolean);
    const users = await this.db.query(
      `SELECT u.id, u.name, p.nickname, p.photo_url, p.position
       FROM users u
       LEFT JOIN players p ON p.user_id = u.id
       WHERE u.id = ANY($1)`,
      [userIds],
    );
    const userMap = new Map(users.rows.map((u) => [u.id, u]));

    const mapUser = (id: string | null) => {
      if (!id) return null;
      const u = userMap.get(id);
      return u
        ? {
            userId: u.id,
            name: u.name,
            nickname: u.nickname,
            photo: u.photo_url,
            position: u.position,
          }
        : { userId: id, name: null, nickname: null, photo: null, position: null };
    };

    const challengerClub = clubMap.get(row.challenger_club_id);
    const challengedClub = clubMap.get(row.challenged_club_id);

    return {
      id: row.id,
      status: row.status,
      monthKey: row.month_key,
      matchId: row.match_id,
      winnerClubId: row.winner_club_id,
      proposedDate: row.proposed_date,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      challengerClub: challengerClub
        ? {
            id: challengerClub.id,
            name: challengerClub.name,
            logoUrl: challengerClub.logo_url,
            interclubWins: Number(challengerClub.interclub_wins ?? 0),
          }
        : null,
      challengedClub: challengedClub
        ? {
            id: challengedClub.id,
            name: challengedClub.name,
            logoUrl: challengedClub.logo_url,
            interclubWins: Number(challengedClub.interclub_wins ?? 0),
          }
        : null,
      challengerAnchor: mapUser(row.challenger_anchor_user_id),
      challengerPartner: mapUser(row.challenger_partner_user_id),
      challengedAnchor: mapUser(row.challenged_anchor_user_id),
      challengedPartner: mapUser(row.challenged_partner_user_id),
      sharePath: `/challenge/${row.id}`,
    };
  }

  private async awardBadge(userId: string, code: string, matchId: string) {
    const badge = await this.db.query(`SELECT id FROM badges WHERE code = $1`, [code]);
    if (!badge.rows[0]) return;
    await this.db.query(
      `INSERT INTO user_badges (user_id, badge_id, match_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, badge_id) DO NOTHING`,
      [userId, badge.rows[0].id, matchId],
    );
  }

  private async notify(
    userId: string,
    type: string,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ) {
    await this.db.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [userId, type, title, body, JSON.stringify(data)],
    );
  }
}
