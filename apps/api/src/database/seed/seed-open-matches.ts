/**
 * Partidos abiertos de prueba para la home del jugador.
 * Ejecutar: pnpm db:seed:open-matches
 */
import { Pool } from 'pg';
import { getCategoryLevelRange } from '../../common/utils/level-range.util';

const PALERMO = 'a0000001-0001-4001-8001-000000000001';
const NORTE = 'a0000001-0001-4001-8001-000000000002';
const JUAN_USER = 'b0000001-0001-4001-8001-000000000001';
const MARIA_USER = 'b0000001-0001-4001-8001-000000000002';
const JUAN_PLAYER = '9bf6bc32-6fd2-4f70-b121-0e9baf2413eb';
const MARIA_PLAYER = 'a9aff121-d6c1-460d-8d91-4704f5db1c6c';

const ID_PREFIX = 'feed0001-0001-4001-8001-';
const ID_LIKE = 'feed%';

type OpenMatchSeed = {
  id: string;
  clubId: string;
  creatorUserId: string;
  title: string;
  description: string;
  daysFromNow: number;
  hour: number;
  minute?: number;
  zone: string;
  category: string;
  mode: 'friendly' | 'competitive';
  gender: 'open' | 'mixed' | 'male' | 'female';
  joinedPlayerIds?: string[];
};

const OPEN_MATCHES: OpenMatchSeed[] = [
  {
    id: `${ID_PREFIX}000000000001`,
    clubId: PALERMO,
    creatorUserId: JUAN_USER,
    title: '6ta · buscamos 2 más',
    description: 'Partido amistoso en Palermo. Sumate si sos 6ta.',
    daysFromNow: 0,
    hour: 20,
    zone: 'Palermo',
    category: '6ta',
    mode: 'friendly',
    gender: 'open',
    joinedPlayerIds: [JUAN_PLAYER],
  },
  {
    id: `${ID_PREFIX}000000000002`,
    clubId: PALERMO,
    creatorUserId: MARIA_USER,
    title: '6ta tarde entre semana',
    description: 'Faltan 3 jugadores de nivel similar.',
    daysFromNow: 1,
    hour: 18,
    minute: 30,
    zone: 'Palermo',
    category: '6ta',
    mode: 'competitive',
    gender: 'mixed',
    joinedPlayerIds: [MARIA_PLAYER],
  },
  {
    id: `${ID_PREFIX}000000000003`,
    clubId: NORTE,
    creatorUserId: JUAN_USER,
    title: '5ta zona norte',
    description: 'Competitivo en Club Deportivo Norte.',
    daysFromNow: 1,
    hour: 21,
    zone: 'Zona Norte',
    category: '5ta',
    mode: 'competitive',
    gender: 'open',
  },
  {
    id: `${ID_PREFIX}000000000004`,
    clubId: PALERMO,
    creatorUserId: MARIA_USER,
    title: '5ta · falta 1',
    description: 'Ya somos 3, buscamos el cuarto.',
    daysFromNow: 2,
    hour: 19,
    zone: 'Palermo',
    category: '5ta',
    mode: 'friendly',
    gender: 'open',
    joinedPlayerIds: [MARIA_PLAYER, JUAN_PLAYER],
  },
  {
    id: `${ID_PREFIX}000000000005`,
    clubId: NORTE,
    creatorUserId: JUAN_USER,
    title: '7ma mañana',
    description: 'Partido relajado para arrancar el finde.',
    daysFromNow: 2,
    hour: 10,
    zone: 'Zona Norte',
    category: '7ma',
    mode: 'friendly',
    gender: 'open',
    joinedPlayerIds: [JUAN_PLAYER],
  },
  {
    id: `${ID_PREFIX}000000000006`,
    clubId: PALERMO,
    creatorUserId: MARIA_USER,
    title: '4ta competitiva',
    description: 'Buscamos jugadores de 4ta para partido exigente.',
    daysFromNow: 3,
    hour: 20,
    zone: 'Palermo',
    category: '4ta',
    mode: 'competitive',
    gender: 'male',
  },
  {
    id: `${ID_PREFIX}000000000007`,
    clubId: NORTE,
    creatorUserId: JUAN_USER,
    title: '8va · principiantes',
    description: 'Ideal si estás empezando. Ambiente tranqui.',
    daysFromNow: 0,
    hour: 17,
    zone: 'Zona Norte',
    category: '8va',
    mode: 'friendly',
    gender: 'open',
  },
  {
    id: `${ID_PREFIX}000000000008`,
    clubId: PALERMO,
    creatorUserId: MARIA_USER,
    title: '3ra · alto nivel',
    description: 'Partido intenso para jugadores avanzados.',
    daysFromNow: 4,
    hour: 21,
    zone: 'Palermo',
    category: '3ra',
    mode: 'competitive',
    gender: 'open',
    joinedPlayerIds: [MARIA_PLAYER],
  },
];

function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL no está definida.');
  try {
    const url = new URL(raw);
    url.searchParams.delete('schema');
    return url.toString();
  } catch {
    return raw;
  }
}

function timestampDaysFromNow(days: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

async function cleanup(pool: Pool) {
  await pool.query(`DELETE FROM match_players WHERE match_id::text LIKE $1`, [ID_LIKE]);
  await pool.query(`DELETE FROM matches WHERE id::text LIKE $1`, [ID_LIKE]);
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl() });

  try {
    console.log('🌱 Seed partidos abiertos de prueba…');
    await pool.query('BEGIN');
    await cleanup(pool);

    for (const match of OPEN_MATCHES) {
      const range = getCategoryLevelRange(match.category);
      const matchDate = timestampDaysFromNow(match.daysFromNow, match.hour, match.minute ?? 0);

      await pool.query(
        `INSERT INTO matches
           (id, club_id, created_by_user_id, title, description, date, zone,
            level_min, level_max, gender, mode, needed_players, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 4, 'OPEN')
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           date = EXCLUDED.date,
           zone = EXCLUDED.zone,
           level_min = EXCLUDED.level_min,
           level_max = EXCLUDED.level_max,
           gender = EXCLUDED.gender,
           mode = EXCLUDED.mode,
           status = 'OPEN',
           updated_at = NOW()`,
        [
          match.id,
          match.clubId,
          match.creatorUserId,
          match.title,
          match.description,
          matchDate.toISOString(),
          match.zone,
          range.min,
          range.max,
          match.gender,
          match.mode,
        ],
      );

      const joined = match.joinedPlayerIds ?? [];
      for (let slot = 0; slot < joined.length; slot += 1) {
        await pool.query(
          `INSERT INTO match_players (match_id, player_id, status, slot_order)
           VALUES ($1, $2, 'JOINED', $3)
           ON CONFLICT (match_id, player_id) DO UPDATE SET status = 'JOINED', slot_order = EXCLUDED.slot_order`,
          [match.id, joined[slot], slot + 1],
        );
      }
    }

    await pool.query('COMMIT');
    console.log(`✅ ${OPEN_MATCHES.length} partidos abiertos creados`);
    for (const match of OPEN_MATCHES) {
      const joined = match.joinedPlayerIds?.length ?? 0;
      console.log(`   · ${match.title} (${match.category}) — ${joined}/4 jugadores`);
    }
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
