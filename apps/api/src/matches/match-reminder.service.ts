import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

type ReminderKind = '24h' | '2h';

type ReminderMatch = {
  id: string;
  title: string;
  date: Date;
  zone: string | null;
};

@Injectable()
export class MatchReminderService {
  private readonly logger = new Logger(MatchReminderService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('*/15 * * * *')
  async handleReminders() {
    const sent24h = await this.sendReminders('24h');
    const sent2h = await this.sendReminders('2h');
    if (sent24h + sent2h > 0) {
      this.logger.log(`Recordatorios pre-partido: 24h=${sent24h}, 2h=${sent2h}`);
    }
  }

  private async sendReminders(kind: ReminderKind): Promise<number> {
    const matches = await this.findDueMatches(kind);
    let sent = 0;
    for (const match of matches) {
      const claimed = await this.claimReminder(match.id, kind);
      if (!claimed) continue;

      const recipients = await this.listParticipantUserIds(match.id);
      if (recipients.length === 0) continue;

      const whenLabel = this.formatMatchWhen(match.date);
      const place = match.zone?.trim() ? ` · ${match.zone.trim()}` : '';
      const isSoon = kind === '2h';

      await this.notifications.createMany(
        recipients.map((userId) => ({
          userId,
          type: 'MATCH_REMINDER',
          title: isSoon ? 'Partido en 2 horas' : 'Partido mañana',
          body: `"${match.title}" · ${whenLabel}${place}`,
          data: {
            matchId: match.id,
            kind,
            hoursBefore: isSoon ? 2 : 24,
          },
        })),
      );
      sent += 1;
    }
    return sent;
  }

  private async findDueMatches(kind: ReminderKind): Promise<ReminderMatch[]> {
    const windowSql =
      kind === '24h'
        ? `m.date <= NOW() + INTERVAL '24 hours' AND m.date > NOW() + INTERVAL '2 hours'`
        : `m.date <= NOW() + INTERVAL '2 hours' AND m.date > NOW()`;

    const result = await this.db.query<ReminderMatch>(
      `SELECT m.id, m.title, m.date, m.zone
       FROM matches m
       WHERE m.status IN ('OPEN', 'FULL', 'CONFIRMED')
         AND ${windowSql}
         AND NOT EXISTS (
           SELECT 1 FROM match_reminders r
           WHERE r.match_id = m.id AND r.kind = $1
         )
       ORDER BY m.date ASC
       LIMIT 100`,
      [kind],
    );
    return result.rows;
  }

  private async claimReminder(matchId: string, kind: ReminderKind): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO match_reminders (match_id, kind)
       VALUES ($1, $2)
       ON CONFLICT (match_id, kind) DO NOTHING
       RETURNING match_id`,
      [matchId, kind],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async listParticipantUserIds(matchId: string): Promise<string[]> {
    const result = await this.db.query<{ user_id: string }>(
      `SELECT DISTINCT p.user_id
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND mp.status IN ('JOINED', 'CONFIRMED')`,
      [matchId],
    );
    return result.rows.map((row) => String(row.user_id));
  }

  private formatMatchWhen(date: Date): string {
    const d = new Date(date);
    return d.toLocaleString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
