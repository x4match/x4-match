import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import type { DeuceMode, LiveScoreState } from '../../common/utils/live-score.util';

export type LiveScoreRow = {
  match_id: string;
  status: 'LIVE' | 'FINISHED';
  deuce_mode: DeuceMode;
  super_tiebreak: boolean;
  state: LiveScoreState;
  history: LiveScoreState[];
  version: number;
  started_by_user_id: string | null;
  started_by_name: string | null;
  last_updated_by_user_id: string | null;
  last_updated_by_name: string | null;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
};

/** Tope de estados guardados para deshacer (un partido largo ronda los 250 puntos). */
const MAX_HISTORY = 400;

@Injectable()
export class MatchLiveScoreRepository {
  constructor(private readonly db: DatabaseService) {}

  async get(matchId: string): Promise<LiveScoreRow | null> {
    const result = await this.db.query<LiveScoreRow>(
      `SELECT ls.*,
              su.name AS started_by_name,
              lu.name AS last_updated_by_name
       FROM match_live_scores ls
       LEFT JOIN users su ON su.id = ls.started_by_user_id
       LEFT JOIN users lu ON lu.id = ls.last_updated_by_user_id
       WHERE ls.match_id = $1`,
      [matchId],
    );
    return result.rows[0] ?? null;
  }

  async create(
    matchId: string,
    userId: string,
    deuceMode: DeuceMode,
    superTiebreak: boolean,
    state: LiveScoreState,
  ) {
    await this.db.query(
      `INSERT INTO match_live_scores (
         match_id, status, deuce_mode, super_tiebreak, state, history, version,
         started_by_user_id, last_updated_by_user_id, started_at, updated_at, finished_at
       ) VALUES ($1, 'LIVE', $2, $3, $4::jsonb, '[]'::jsonb, 0, $5, $5, NOW(), NOW(), NULL)
       ON CONFLICT (match_id) DO UPDATE SET
         status = 'LIVE',
         deuce_mode = EXCLUDED.deuce_mode,
         super_tiebreak = EXCLUDED.super_tiebreak,
         state = EXCLUDED.state,
         history = '[]'::jsonb,
         version = match_live_scores.version + 1,
         started_by_user_id = EXCLUDED.started_by_user_id,
         last_updated_by_user_id = EXCLUDED.last_updated_by_user_id,
         started_at = NOW(),
         updated_at = NOW(),
         finished_at = NULL`,
      [matchId, deuceMode, superTiebreak, JSON.stringify(state), userId],
    );
  }

  /** Bloquea la fila para aplicar un cambio atómico (punto / deshacer). */
  async lockForUpdate(client: PoolClient, matchId: string): Promise<LiveScoreRow | null> {
    const result = await client.query<LiveScoreRow>(
      `SELECT * FROM match_live_scores WHERE match_id = $1 FOR UPDATE`,
      [matchId],
    );
    return result.rows[0] ?? null;
  }

  async saveState(
    client: PoolClient,
    matchId: string,
    userId: string,
    state: LiveScoreState,
    history: LiveScoreState[],
  ) {
    const finished = state.winner != null;
    await client.query(
      `UPDATE match_live_scores
       SET state = $2::jsonb,
           history = $3::jsonb,
           status = $4,
           version = version + 1,
           last_updated_by_user_id = $5,
           updated_at = NOW(),
           finished_at = CASE WHEN $4 = 'FINISHED' THEN NOW() ELSE NULL END
       WHERE match_id = $1`,
      [
        matchId,
        JSON.stringify(state),
        JSON.stringify(history.slice(-MAX_HISTORY)),
        finished ? 'FINISHED' : 'LIVE',
        userId,
      ],
    );
  }

  async remove(matchId: string) {
    await this.db.query(`DELETE FROM match_live_scores WHERE match_id = $1`, [matchId]);
  }

  transaction<T>(fn: (client: PoolClient) => Promise<T>) {
    return this.db.transaction(fn);
  }
}
