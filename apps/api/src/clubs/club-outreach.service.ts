import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { nextPushTimeOutsideQuietHours } from '../notifications/quiet-hours';

/** Tope compartido entre "Avisar jugadores" y el relleno automático, por jugador y club. */
export const MAX_OFFERS_PER_USER_CLUB_DAY = 3;
/** Ventana para juntar varios horarios del mismo club en un solo push. */
export const DIGEST_WINDOW_MS = 3 * 60_000;
const MAX_DIGEST_LINES = 2;

export type ClubOfferType = 'COURT_SLOT_AVAILABLE' | 'COURT_GAP_OFFER' | 'OPEN_MATCH_CREATED';

export type SlotOffer = {
  club: { id: string; name: string };
  slotId: string;
  userIds: string[];
  source: 'manual' | 'auto';
  type: ClubOfferType;
  /** Título y cuerpo cuando el aviso tiene un solo horario. */
  title: string;
  body: string;
  /** Línea corta del horario para el resumen agrupado, ej. "Cancha 1 · vie 24/10 18:00–19:30". */
  slotLabel: string;
  data: Record<string, unknown>;
};

type DigestSlot = { slotId: string; label: string };

type OutreachStatsRow = {
  source: string | null;
  players_reached: number;
  notifications_sent: number;
  notifications_opened: number;
  slots_offered: number;
  slots_booked: number;
};

@Injectable()
export class ClubOutreachService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Avisa a jugadores de un horario libre. Si el jugador ya tiene un aviso pendiente del mismo club
   * se suma a ese; si no, se crea uno nuevo respetando el tope diario. El push sale tras la ventana
   * de agrupado y nunca en horario de descanso.
   */
  async sendSlotOffer(offer: SlotOffer): Promise<{ notified: number; pushAt: Date | null }> {
    const userIds = await this.notifications.filterClubOfferRecipients(offer.club.id, [
      ...new Set(offer.userIds),
    ]);
    if (userIds.length === 0) return { notified: 0, pushAt: null };

    const pushAt = nextPushTimeOutsideQuietHours(new Date(Date.now() + DIGEST_WINDOW_MS));

    const history = await this.db.query<{ user_id: string; already: boolean; recent: number }>(
      `SELECT user_id,
              BOOL_OR(slot_id = $2) AS already,
              COUNT(DISTINCT COALESCE(notification_id, id))
                FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS recent
       FROM club_gap_fill_notifications
       WHERE club_id = $1 AND user_id = ANY($3::uuid[])
       GROUP BY user_id`,
      [offer.club.id, offer.slotId, userIds],
    );
    const historyByUser = new Map(history.rows.map((row) => [row.user_id, row]));
    const eligible = userIds.filter((userId) => !historyByUser.get(userId)?.already);
    if (eligible.length === 0) return { notified: 0, pushAt: null };

    const merged = await this.mergeIntoPendingDigests(offer, eligible);

    const fresh = eligible.filter(
      (userId) =>
        !merged.has(userId) &&
        (historyByUser.get(userId)?.recent ?? 0) < MAX_OFFERS_PER_USER_CLUB_DAY,
    );
    const slots: DigestSlot[] = [{ slotId: offer.slotId, label: offer.slotLabel }];
    const created = await this.notifications.createMany(
      fresh.map((userId) => ({
        userId,
        type: offer.type,
        title: offer.title,
        body: offer.body,
        data: { ...offer.data, clubId: offer.club.id, slots },
        pushAfter: pushAt,
      })),
    );

    const recipients = [
      ...[...merged.entries()].map(([userId, notificationId]) => ({ userId, notificationId })),
      ...fresh.map((userId, index) => ({ userId, notificationId: created[index].id })),
    ];
    if (recipients.length === 0) return { notified: 0, pushAt: null };

    await this.db.query(
      `INSERT INTO club_gap_fill_notifications (club_id, slot_id, user_id, source, notification_id)
       SELECT $1, $2, user_id, $3, notification_id
       FROM unnest($4::uuid[], $5::uuid[]) AS t(user_id, notification_id)
       ON CONFLICT (slot_id, user_id) DO NOTHING`,
      [
        offer.club.id,
        offer.slotId,
        offer.source,
        recipients.map((r) => r.userId),
        recipients.map((r) => r.notificationId),
      ],
    );

    return { notified: recipients.length, pushAt };
  }

  /** Devuelve userId → notificationId de los avisos pendientes a los que se sumó el horario. */
  private async mergeIntoPendingDigests(offer: SlotOffer, userIds: string[]) {
    const pending = await this.db.query<{ id: string; user_id: string; data: Record<string, unknown> | null }>(
      `SELECT DISTINCT ON (user_id) id, user_id, data
       FROM notifications
       WHERE user_id = ANY($1::uuid[])
         AND type = $2
         AND data ->> 'clubId' = $3
         AND push_after IS NOT NULL
       ORDER BY user_id, created_at DESC`,
      [userIds, offer.type, offer.club.id],
    );

    // Agrupamos por contenido actual: normalmente todos comparten los mismos horarios, así es un UPDATE por grupo.
    const groups = new Map<string, { slots: DigestSlot[]; data: Record<string, unknown>; ids: string[] }>();
    for (const row of pending.rows) {
      const data = row.data ?? {};
      const existing = Array.isArray(data.slots) ? (data.slots as DigestSlot[]) : [];
      if (existing.some((slot) => slot.slotId === offer.slotId)) continue;
      const slots = [...existing, { slotId: offer.slotId, label: offer.slotLabel }];
      const key = JSON.stringify(slots);
      const group = groups.get(key) ?? { slots, data, ids: [] };
      group.ids.push(row.id);
      groups.set(key, group);
    }

    const merged = new Map<string, string>();
    for (const group of groups.values()) {
      const { title, body } = buildDigestText(offer, group.slots);
      const updated = await this.db.query<{ id: string; user_id: string }>(
        `UPDATE notifications
         SET title = $1, body = $2, data = $3::jsonb, read = FALSE
         WHERE id = ANY($4::uuid[]) AND push_after IS NOT NULL
         RETURNING id, user_id`,
        [title, body, JSON.stringify({ ...group.data, slots: group.slots }), group.ids],
      );
      for (const row of updated.rows) merged.set(row.user_id, row.id);
    }
    return merged;
  }

  async getStats(clubId: string, days: number) {
    const result = await this.db.query<OutreachStatsRow>(
      `WITH outreach AS (
         SELECT o.*,
                EXISTS (
                  SELECT 1
                  FROM matches m
                  INNER JOIN match_players mp ON mp.match_id = m.id
                  INNER JOIN players p ON p.id = mp.player_id
                  WHERE m.court_slot_id = o.slot_id
                    AND p.user_id = o.user_id
                    AND mp.status IN ('JOINED', 'CONFIRMED')
                    AND m.status <> 'CANCELLED'
                ) AS booked
         FROM club_gap_fill_notifications o
         WHERE o.club_id = $1
           AND o.created_at >= NOW() - make_interval(days => $2::int)
       )
       SELECT o.source,
              COUNT(DISTINCT o.user_id)::int AS players_reached,
              COUNT(DISTINCT COALESCE(o.notification_id, o.id))::int AS notifications_sent,
              COUNT(DISTINCT o.notification_id) FILTER (WHERE n.read)::int AS notifications_opened,
              COUNT(DISTINCT o.slot_id)::int AS slots_offered,
              COUNT(DISTINCT o.slot_id) FILTER (WHERE o.booked)::int AS slots_booked
       FROM outreach o
       LEFT JOIN notifications n ON n.id = o.notification_id
       GROUP BY ROLLUP (o.source)`,
      [clubId, days],
    );

    const toStats = (row?: OutreachStatsRow) => ({
      playersReached: row?.players_reached ?? 0,
      notificationsSent: row?.notifications_sent ?? 0,
      notificationsOpened: row?.notifications_opened ?? 0,
      slotsOffered: row?.slots_offered ?? 0,
      slotsBooked: row?.slots_booked ?? 0,
    });
    // ROLLUP agrega una fila de total con source NULL; sin datos no devuelve ninguna.
    const total = result.rows.find((row) => row.source === null);
    return {
      days,
      ...toStats(total),
      manual: toStats(result.rows.find((row) => row.source === 'manual')),
      auto: toStats(result.rows.find((row) => row.source === 'auto')),
    };
  }
}

function buildDigestText(offer: SlotOffer, slots: DigestSlot[]) {
  if (slots.length <= 1) return { title: offer.title, body: offer.body };
  const noun = offer.type === 'OPEN_MATCH_CREATED' ? 'partidos abiertos' : 'horarios libres';
  const lines = slots.slice(0, MAX_DIGEST_LINES).map((slot) => slot.label);
  const rest = slots.length - lines.length;
  return {
    title: `${slots.length} ${noun} en ${offer.club.name}`,
    body: `${lines.join(' | ')}${rest > 0 ? ` y ${rest} más` : ''}`,
  };
}
