/**
 * Datos de prueba para la cuenta club Franco Club (42256e53-…).
 * Ejecutar: pnpm db:seed:club-demo
 */
import { Pool } from 'pg';

const CLUB_ADMIN_ID = '42256e53-6b42-40c5-ac69-da342f6b6026';
const PALERMO = 'a0000001-0001-4001-8001-000000000001';
const NORTE = 'a0000001-0001-4001-8001-000000000002';

const DEMO_PREFIX = 'c0de0001-0001-4001-8001-';
const NORTE_DEMO_PREFIX = 'c0de0002-0001-4001-8001-';
const DEMO_ID_LIKE = 'c0de%';

const PLAYERS = [
  {
    playerId: '9bf6bc32-6fd2-4f70-b121-0e9baf2413eb',
    userId: 'b0000001-0001-4001-8001-000000000001',
    name: 'Juan',
    points: 420,
    matches: 8,
  },
  {
    playerId: 'a9aff121-d6c1-460d-8d91-4704f5db1c6c',
    userId: 'b0000001-0001-4001-8001-000000000002',
    name: 'María García',
    points: 385,
    matches: 7,
  },
  {
    playerId: '2bde5673-d384-4894-b29b-626e27e439eb',
    userId: '562e68a4-17bc-4aa4-b870-3f3cdd5f7777',
    name: 'Franco Jugador',
    points: 350,
    matches: 6,
  },
  {
    playerId: 'f353cc75-7afd-4655-a5ce-e836fb3a2321',
    userId: 'f50b14ff-f0f8-4980-ab05-1d0a0f00a4ce',
    name: 'Patricia',
    points: 310,
    matches: 5,
  },
  {
    playerId: '1d959974-0ab2-4baa-952d-5483dd1be780',
    userId: 'ec4a2195-315c-43f5-b57c-fef20fdc80b1',
    name: 'Test',
    points: 260,
    matches: 4,
  },
  {
    playerId: '6a016cb5-8085-40e8-815f-b61699dfa7d7',
    userId: '3c66dfc2-cb47-4cbd-8bd0-4b8702593de5',
    name: 'Test',
    points: 220,
    matches: 4,
  },
  {
    playerId: '5602b950-bc76-4e25-b422-f9a4928ca320',
    userId: '2059b2a7-f99d-4806-ae8d-91d0d70375b7',
    name: 'Test',
    points: 180,
    matches: 3,
  },
  {
    playerId: 'be59293a-fed8-42cc-bf9b-915ddcd17a4b',
    userId: '638928b2-7358-4430-b283-98a61e67f732',
    name: 'Test',
    points: 140,
    matches: 2,
  },
] as const;

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

function monthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function dateOnly(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function timestampDaysAgo(days: number, hour = 18, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function timestampDaysFromNow(days: number, hour = 19, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function cleanupDemoData(pool: Pool) {
  await pool.query(`DELETE FROM dm_messages WHERE conversation_id::text LIKE $1`, [DEMO_ID_LIKE]);
  await pool.query(`DELETE FROM club_reward_redemptions WHERE id::text LIKE $1`, [DEMO_ID_LIKE]);
  await pool.query(`DELETE FROM shop_purchases WHERE id::text LIKE $1`, [DEMO_ID_LIKE]);
  await pool.query(`DELETE FROM match_deposits WHERE id::text LIKE $1`, [DEMO_ID_LIKE]);
  await pool.query(`DELETE FROM match_players WHERE match_id::text LIKE $1`, [DEMO_ID_LIKE]);
  await pool.query(`DELETE FROM matches WHERE id::text LIKE $1`, [DEMO_ID_LIKE]);
  await pool.query(`DELETE FROM court_availability_slots WHERE id::text LIKE $1`, [DEMO_ID_LIKE]);
  await pool.query(`DELETE FROM club_promotions WHERE id::text LIKE $1`, [DEMO_ID_LIKE]);
  await pool.query(`DELETE FROM club_reward_catalog WHERE id::text LIKE $1`, [DEMO_ID_LIKE]);
  await pool.query(`DELETE FROM club_shop_coupons WHERE id::text LIKE $1`, [DEMO_ID_LIKE]);
  await pool.query(`DELETE FROM club_points_ledger WHERE id::text LIKE $1`, [DEMO_ID_LIKE]);
  await pool.query(`DELETE FROM dm_conversations WHERE id::text LIKE $1`, [DEMO_ID_LIKE]);
}

type BillingSeedOptions = {
  clubId: string;
  idPrefix: string;
  zone: string;
  finishedMatchCount?: number;
};

async function seedBillingData(pool: Pool, options: BillingSeedOptions) {
  const { clubId, idPrefix, zone, finishedMatchCount = 6 } = options;

  const products = await pool.query<{ id: string; name: string; price: string }>(
    `SELECT id, name, price FROM club_shop_products WHERE club_id = $1 ORDER BY sort_order, name`,
    [clubId],
  );
  if (!products.rows.length) {
    throw new Error(`No hay productos en el club ${clubId}. Ejecutá pnpm db:seed primero.`);
  }

  await pool.query(
    `UPDATE club_shop_products SET stock_quantity = COALESCE(stock_quantity, 20), active = TRUE WHERE club_id = $1`,
    [clubId],
  );

  for (let i = 0; i < finishedMatchCount; i += 1) {
    const matchId = `${idPrefix}0000000005${String(i).padStart(2, '0')}`;
    const matchDate = timestampDaysAgo(1 + i * 3, 17 + (i % 3), (i % 2) * 30);

    await pool.query(
      `INSERT INTO matches
         (id, club_id, created_by_user_id, title, description, date, zone, level_min, level_max, gender, mode, needed_players, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 2.5, 4.5, 'mixed', 'competitive', 4, 'FINISHED')
       ON CONFLICT (id) DO UPDATE SET status = 'FINISHED', date = EXCLUDED.date`,
      [
        matchId,
        clubId,
        PLAYERS[i % PLAYERS.length].userId,
        `Partido facturación #${i + 1}`,
        'Seña y tienda demo',
        matchDate.toISOString(),
        zone,
      ],
    );

    for (let slot = 0; slot < 4; slot += 1) {
      const p = PLAYERS[(i + slot) % PLAYERS.length];
      await pool.query(
        `INSERT INTO match_players (match_id, player_id, status, slot_order)
         VALUES ($1, $2, 'CONFIRMED', $3)
         ON CONFLICT (match_id, player_id) DO NOTHING`,
        [matchId, p.playerId, slot + 1],
      );
    }
  }

  const activeMatches = [
    { id: `${idPrefix}000000000510`, status: 'OPEN', days: 1, title: 'Busco jugadores' },
    { id: `${idPrefix}000000000511`, status: 'FULL', days: 2, title: 'Partido reservado' },
  ];

  for (const match of activeMatches) {
    const matchDate = timestampDaysFromNow(match.days, 20, 0);
    await pool.query(
      `INSERT INTO matches
         (id, club_id, created_by_user_id, title, date, zone, gender, mode, needed_players, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', 'friendly', 4, $7::match_status)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, date = EXCLUDED.date`,
      [match.id, clubId, PLAYERS[0].userId, match.title, matchDate.toISOString(), zone, match.status],
    );

    const playerCount = match.status === 'OPEN' ? 2 : 4;
    for (let slot = 0; slot < playerCount; slot += 1) {
      const p = PLAYERS[slot];
      await pool.query(
        `INSERT INTO match_players (match_id, player_id, status, slot_order)
         VALUES ($1, $2, 'JOINED', $3)
         ON CONFLICT (match_id, player_id) DO NOTHING`,
        [match.id, p.playerId, slot + 1],
      );
    }
  }

  const depositPlans = [
    { id: `${idPrefix}000000000601`, matchIdx: 0, playerIdx: 0, amount: 3600, status: 'APPROVED', daysAgo: 2 },
    { id: `${idPrefix}000000000602`, matchIdx: 1, playerIdx: 1, amount: 3600, status: 'APPROVED', daysAgo: 4 },
    { id: `${idPrefix}000000000603`, matchIdx: 2, playerIdx: 2, amount: 4200, status: 'APPROVED', daysAgo: 6 },
    { id: `${idPrefix}000000000604`, matchIdx: 3, playerIdx: 3, amount: 3600, status: 'APPROVED', daysAgo: 8 },
    { id: `${idPrefix}000000000605`, matchIdx: finishedMatchCount, playerIdx: 0, amount: 3600, status: 'PENDING', daysAgo: 1 },
    { id: `${idPrefix}000000000606`, matchIdx: finishedMatchCount + 1, playerIdx: 1, amount: 3600, status: 'PENDING', daysAgo: 0 },
  ];

  for (const dep of depositPlans) {
    const matchId =
      dep.matchIdx < finishedMatchCount
        ? `${idPrefix}0000000005${String(dep.matchIdx).padStart(2, '0')}`
        : activeMatches[dep.matchIdx - finishedMatchCount].id;
    const player = PLAYERS[dep.playerIdx];
    const paidAt = dep.status === 'APPROVED' ? timestampDaysAgo(dep.daysAgo, 12) : null;

    await pool.query(
      `INSERT INTO match_deposits
         (id, match_id, player_id, user_id, amount, currency, provider, status, paid_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'ARS', 'MOCK', $6::payment_status, $7, NOW() - ($8 || ' days')::interval, NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, paid_at = EXCLUDED.paid_at, created_at = EXCLUDED.created_at`,
      [dep.id, matchId, player.playerId, player.userId, dep.amount, dep.status, paidAt, String(dep.daysAgo)],
    );
  }

  const shopPlans = [
    { id: `${idPrefix}000000000701`, productIdx: 0, userIdx: 0, qty: 1, status: 'CONFIRMED', daysAgo: 2, matchIdx: 0 },
    { id: `${idPrefix}000000000702`, productIdx: 0, userIdx: 1, qty: 2, status: 'CONFIRMED', daysAgo: 4, matchIdx: 1 },
    { id: `${idPrefix}000000000703`, productIdx: 0, userIdx: 2, qty: 1, status: 'CONFIRMED', daysAgo: 6, matchIdx: null },
    { id: `${idPrefix}000000000704`, productIdx: 0, userIdx: 3, qty: 1, status: 'PENDING', daysAgo: 1, matchIdx: finishedMatchCount },
    { id: `${idPrefix}000000000705`, productIdx: 0, userIdx: 4, qty: 2, status: 'PENDING', daysAgo: 0, matchIdx: null },
  ];

  for (const sale of shopPlans) {
    const product = products.rows[sale.productIdx % products.rows.length];
    const unitPrice = Number(product.price);
    const subtotal = unitPrice * sale.qty;
    const matchId =
      sale.matchIdx == null
        ? null
        : sale.matchIdx < finishedMatchCount
          ? `${idPrefix}0000000005${String(sale.matchIdx).padStart(2, '0')}`
          : activeMatches[sale.matchIdx - finishedMatchCount].id;
    const buyer = PLAYERS[sale.userIdx];

    await pool.query(
      `INSERT INTO shop_purchases
         (id, club_id, user_id, match_id, product_id, quantity, unit_price, subtotal, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::shop_purchase_status, NOW() - ($10 || ' days')::interval, NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, created_at = EXCLUDED.created_at`,
      [
        sale.id,
        clubId,
        buyer.userId,
        matchId,
        product.id,
        sale.qty,
        unitPrice,
        subtotal,
        sale.status,
        String(sale.daysAgo),
      ],
    );
  }
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl() });
  const month = monthKey();

  try {
    const userCheck = await pool.query(`SELECT id, email FROM users WHERE id = $1`, [CLUB_ADMIN_ID]);
    if (!userCheck.rows[0]) {
      throw new Error(`Usuario ${CLUB_ADMIN_ID} no encontrado.`);
    }

    console.log(`🌱 Seed demo club para ${userCheck.rows[0].email}…`);

    await pool.query('BEGIN');
    await cleanupDemoData(pool);

    await pool.query(
      `UPDATE clubs SET
         subscription_plan = 'PRO',
         court_price_per_hour = 12000,
         deposit_percent = 30,
         updated_at = NOW()
       WHERE id = $1`,
      [PALERMO],
    );

    await pool.query(
      `INSERT INTO club_admins (club_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [PALERMO, CLUB_ADMIN_ID],
    );

    await pool.query(
      `INSERT INTO players (
         user_id, nickname, city, zone, level, position,
         category_status, placement_matches_played
       )
       VALUES ($1, 'FrancoClub', 'CABA', 'Palermo', 4.0, 'ambos', 'confirmed', 5)
       ON CONFLICT (user_id) DO UPDATE SET
         nickname = EXCLUDED.nickname,
         city = EXCLUDED.city,
         zone = EXCLUDED.zone,
         category_status = 'confirmed',
         placement_matches_played = GREATEST(players.placement_matches_played, 5),
         updated_at = NOW()`,
      [CLUB_ADMIN_ID],
    );

    const slotPlans = [
      { id: `${DEMO_PREFIX}000000000001`, day: 0, court: 'Cancha 1', start: 8, end: 10, bonus: 10 },
      { id: `${DEMO_PREFIX}000000000002`, day: 0, court: 'Cancha 2', start: 10.5, end: 12.5, bonus: 15 },
      { id: `${DEMO_PREFIX}000000000003`, day: 1, court: 'Cancha 1', start: 18, end: 20, bonus: 20 },
      { id: `${DEMO_PREFIX}000000000004`, day: 2, court: 'Cancha 3', start: 9, end: 11, bonus: 0 },
      { id: `${DEMO_PREFIX}000000000005`, day: 3, court: 'Cancha 1', start: 14, end: 16, bonus: 12 },
      { id: `${DEMO_PREFIX}000000000006`, day: 4, court: 'Cancha 2', start: 20, end: 22, bonus: 25 },
      { id: `${DEMO_PREFIX}000000000007`, day: 5, court: 'Cancha 1', start: 11, end: 13, bonus: 8 },
      { id: `${DEMO_PREFIX}000000000008`, day: 6, court: 'Cancha 2', start: 16.5, end: 18.5, bonus: 18 },
    ];

    for (const slot of slotPlans) {
      await pool.query(
        `INSERT INTO court_availability_slots
           (id, club_id, court_label, slot_date, start_hour, end_hour, created_by_user_id, status, bonus_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8)
         ON CONFLICT (id) DO UPDATE SET
           slot_date = EXCLUDED.slot_date,
           start_hour = EXCLUDED.start_hour,
           end_hour = EXCLUDED.end_hour,
           status = 'OPEN',
           bonus_points = EXCLUDED.bonus_points`,
        [slot.id, PALERMO, slot.court, dateOnly(slot.day), slot.start, slot.end, CLUB_ADMIN_ID, slot.bonus],
      );
    }

    const promos = [
      {
        id: `${DEMO_PREFIX}000000000101`,
        clubId: PALERMO,
        label: 'Horario valle mañana',
        day: 1,
        start: 8,
        end: 12,
        bonus: 15,
      },
      {
        id: `${DEMO_PREFIX}000000000102`,
        clubId: PALERMO,
        label: 'Tarde entre semana',
        day: null,
        start: 14,
        end: 17.5,
        bonus: 10,
      },
      {
        id: `${DEMO_PREFIX}000000000103`,
        clubId: NORTE,
        label: 'Mediodía finde',
        day: 6,
        start: 12,
        end: 15,
        bonus: 20,
      },
    ];

    for (const promo of promos) {
      await pool.query(
        `INSERT INTO club_promotions
           (id, club_id, label, day_of_week, start_hour, end_hour, bonus_points, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
         ON CONFLICT (id) DO UPDATE SET
           label = EXCLUDED.label,
           start_hour = EXCLUDED.start_hour,
           end_hour = EXCLUDED.end_hour,
           bonus_points = EXCLUDED.bonus_points,
           active = TRUE`,
        [promo.id, promo.clubId, promo.label, promo.day, promo.start, promo.end, promo.bonus],
      );
    }

    const rewards = [
      {
        id: `${DEMO_PREFIX}000000000201`,
        title: '1 hora gratis',
        description: 'Canjeá 500 puntos por una hora en horario valle',
        points: 500,
        type: 'FREE_SLOT',
      },
      {
        id: `${DEMO_PREFIX}000000000202`,
        title: '20% en tienda',
        description: 'Descuento en tu próxima compra del club shop',
        points: 300,
        type: 'DISCOUNT',
      },
      {
        id: `${DEMO_PREFIX}000000000203`,
        title: 'Remera del club',
        description: 'Merchandising oficial Palermo Pádel',
        points: 800,
        type: 'MERCH',
      },
      {
        id: `${DEMO_PREFIX}000000000204`,
        title: 'Bebida gratis',
        description: 'Agua o gatorade en recepción',
        points: 150,
        type: 'BENEFIT',
      },
    ];

    for (const reward of rewards) {
      await pool.query(
        `INSERT INTO club_reward_catalog
           (id, club_id, title, description, points_required, reward_type, active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           points_required = EXCLUDED.points_required,
           active = TRUE`,
        [reward.id, PALERMO, reward.title, reward.description, reward.points, reward.type],
      );
    }

    const products = await pool.query<{ id: string; name: string; price: string }>(
      `SELECT id, name, price FROM club_shop_products WHERE club_id = $1 ORDER BY sort_order, name`,
      [PALERMO],
    );
    if (!products.rows.length) {
      throw new Error('No hay productos en Palermo. Ejecutá pnpm db:seed primero.');
    }

    await pool.query(
      `UPDATE club_shop_products SET stock_quantity = 25, active = TRUE WHERE club_id = $1`,
      [PALERMO],
    );

    await pool.query(
      `INSERT INTO club_shop_coupons
         (id, club_id, code, label, discount_percent, points_cost, max_uses, uses_count, active, expires_at)
       VALUES
         ($1, $3, 'VALLE20', '20% horario valle', 20, NULL, 50, 3, TRUE, NOW() + INTERVAL '90 days'),
         ($2, $3, 'PUNTOS100', '100 pts de regalo', NULL, 100, 20, 1, TRUE, NOW() + INTERVAL '60 days')
       ON CONFLICT (club_id, code) DO UPDATE SET active = TRUE`,
      [`${DEMO_PREFIX}000000000301`, `${DEMO_PREFIX}000000000302`, PALERMO],
    );

    for (let i = 0; i < PLAYERS.length; i += 1) {
      const player = PLAYERS[i];
      await pool.query(
        `INSERT INTO club_member_monthly_points (club_id, user_id, month_key, points, matches_played, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (club_id, user_id, month_key) DO UPDATE SET
           points = EXCLUDED.points,
           matches_played = EXCLUDED.matches_played,
           updated_at = NOW()`,
        [PALERMO, player.userId, month, player.points, player.matches],
      );

      await pool.query(
        `INSERT INTO club_member_points (club_id, user_id, points, matches_at_club, last_played_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '2 days', NOW())
         ON CONFLICT (club_id, user_id) DO UPDATE SET
           points = EXCLUDED.points,
           matches_at_club = EXCLUDED.matches_at_club,
           last_played_at = EXCLUDED.last_played_at,
           updated_at = NOW()`,
        [PALERMO, player.userId, player.points + 120, player.matches],
      );

      await pool.query(
        `INSERT INTO club_points_ledger
           (id, club_id, user_id, amount, reason, reference_id, created_at, month_key, base_amount, multiplier)
         VALUES ($1, $2, $3, $4, 'MATCH_WIN', NULL, NOW() - INTERVAL '3 days', $5, $4, 1.5)
         ON CONFLICT (id) DO NOTHING`,
        [`${DEMO_PREFIX}0000000004${String(i).padStart(2, '0')}`, PALERMO, player.userId, Math.round(player.points / 4), month],
      );
    }

    const finishedMatchCount = 10;
    await seedBillingData(pool, {
      clubId: PALERMO,
      idPrefix: DEMO_PREFIX,
      zone: 'Palermo',
      finishedMatchCount,
    });

    await pool.query(
      `UPDATE clubs SET subscription_plan = 'GROWTH', court_price_per_hour = 10000, deposit_percent = 25, updated_at = NOW()
       WHERE id = $1`,
      [NORTE],
    );

    await seedBillingData(pool, {
      clubId: NORTE,
      idPrefix: NORTE_DEMO_PREFIX,
      zone: 'Zona Norte',
      finishedMatchCount: 6,
    });

    await pool.query(
      `INSERT INTO club_reward_redemptions (id, club_id, user_id, reward_id, points_spent, created_at)
       VALUES ($1, $2, $3, $4, 150, NOW() - INTERVAL '5 days')
       ON CONFLICT (id) DO NOTHING`,
      [`${DEMO_PREFIX}000000000801`, PALERMO, PLAYERS[2].userId, rewards[3].id],
    );

    await pool.query(
      `INSERT INTO club_reward_redemptions (id, club_id, user_id, reward_id, points_spent, created_at)
       VALUES ($1, $2, $3, $4, 300, NOW() - INTERVAL '2 days')
       ON CONFLICT (id) DO NOTHING`,
      [`${DEMO_PREFIX}000000000802`, PALERMO, PLAYERS[1].userId, rewards[1].id],
    );

    const dmTargets = [
      { id: `${DEMO_PREFIX}000000000901`, otherUserId: PLAYERS[0].userId, messages: ['Hola, ¿hay cancha libre el sábado?', 'Sí, tenemos de 11 a 13 en cancha 1'] },
      { id: `${DEMO_PREFIX}000000000902`, otherUserId: PLAYERS[2].userId, messages: ['Consulta por torneo interno', 'Te paso info por acá'] },
    ];

    for (const dm of dmTargets) {
      const [userA, userB] = canonicalPair(CLUB_ADMIN_ID, dm.otherUserId);
      await pool.query(
        `INSERT INTO dm_conversations (id, user_a_id, user_b_id, status, requested_by_id, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', $4, NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 hour')
         ON CONFLICT (id) DO UPDATE SET status = 'active', updated_at = NOW()`,
        [dm.id, userA, userB, CLUB_ADMIN_ID],
      );

      for (let i = 0; i < dm.messages.length; i += 1) {
        const senderId = i % 2 === 0 ? CLUB_ADMIN_ID : dm.otherUserId;
        await pool.query(
          `INSERT INTO dm_messages (conversation_id, sender_id, content, created_at)
           VALUES ($1, $2, $3, NOW() - ($4 || ' hours')::interval)
           ON CONFLICT DO NOTHING`,
          [dm.id, senderId, dm.messages[i], String(24 - i * 5)],
        );
      }
    }

    await pool.query('COMMIT');

    console.log('✅ Seed demo club completado');
    console.log(`   Usuario: fclub@gmail.com (${CLUB_ADMIN_ID})`);
    console.log(`   Club principal: Pádel Center Palermo (${PALERMO})`);
    console.log(`   Mes ranking: ${month}`);
    console.log(`   · ${slotPlans.length} horarios OPEN`);
    console.log(`   · ${promos.length} promociones`);
    console.log(`   · ${rewards.length} premios + 2 canjes`);
    console.log(`   · facturación demo en Palermo y Club Deportivo Norte`);
    console.log(`   · ${finishedMatchCount} partidos FINISHED + activos (Palermo)`);
    console.log(`   · ${PLAYERS.length} jugadores en ranking`);
    console.log(`   · ${dmTargets.length} conversaciones DM`);
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
