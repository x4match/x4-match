import { DatabaseService } from '../database/database.service';
import {
  buildMatchupKeyFromParticipants,
  buildTeamMatchupKey,
  RATING_REPEAT_WINDOW_DAYS,
} from './engine';

type RecentMatchParticipant = {
  userId: string;
  rank: number;
};

export async function countRecentTeamMatchups(
  db: DatabaseService,
  matchId: string,
  teamAUserIds: string[],
  teamBUserIds: string[],
  windowDays = RATING_REPEAT_WINDOW_DAYS,
): Promise<number> {
  const targetKey = buildTeamMatchupKey(teamAUserIds, teamBUserIds);

  const result = await db.query(
    `SELECT m.id,
            m.needed_players,
            p.user_id,
            COALESCE(mp.slot_order, ROW_NUMBER() OVER (
              PARTITION BY m.id ORDER BY mp.created_at
            )) AS rnk
     FROM matches m
     INNER JOIN match_results mr ON mr.match_id = m.id AND mr.result_status = 'confirmed'
     INNER JOIN match_players mp ON mp.match_id = m.id AND mp.status IN ('JOINED', 'CONFIRMED')
     INNER JOIN players p ON p.id = mp.player_id
     WHERE m.id <> $1
       AND m.status = 'FINISHED'
       AND m.date >= NOW() - ($2::text || ' days')::interval`,
    [matchId, String(windowDays)],
  );

  const byMatch = new Map<string, { neededPlayers: number; participants: RecentMatchParticipant[] }>();

  for (const row of result.rows) {
    const currentMatchId = row.id as string;
    const bucket = byMatch.get(currentMatchId) ?? {
      neededPlayers: Number(row.needed_players) || 4,
      participants: [],
    };
    bucket.participants.push({
      userId: row.user_id as string,
      rank: Number(row.rnk),
    });
    byMatch.set(currentMatchId, bucket);
  }

  let encounters = 0;
  for (const { neededPlayers, participants } of byMatch.values()) {
    const matchupKey = buildMatchupKeyFromParticipants(participants, neededPlayers);
    if (matchupKey === targetKey) encounters += 1;
  }

  return encounters;
}
