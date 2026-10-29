import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { DatabaseService } from '../database/database.service';

const APP_SCHEME = 'x4match';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=x4.match';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMatchDate(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date);
}

type SharePreview = {
  title: string;
  description: string;
  image: string | null;
};

const SHARE_KINDS = ['match', 'club', 'tournament', 'player', 'slot'] as const;
type ShareKind = (typeof SHARE_KINDS)[number];

function formatSlotDate(slotDate: string | Date): string {
  const iso = typeof slotDate === 'string' ? slotDate.slice(0, 10) : slotDate.toISOString().slice(0, 10);
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
}

function formatHour(hour: number): string {
  const h = Math.floor(Number(hour));
  const m = Math.round((Number(hour) - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

@Controller('share')
export class ShareController {
  constructor(private readonly db: DatabaseService) {}

  /** Datos públicos para la vista previa (Open Graph) de los links de x4match.com. */
  @Get('preview/:kind/:id')
  async preview(
    @Param('kind') kind: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('slot') slotId?: string,
  ): Promise<SharePreview> {
    if (!SHARE_KINDS.includes(kind as ShareKind)) throw new NotFoundException();
    const preview = await this.loadPreview(kind as ShareKind, id, slotId);
    if (!preview) throw new NotFoundException();
    return preview;
  }

  private async loadPreview(kind: ShareKind, id: string, slotId?: string): Promise<SharePreview | null> {
    switch (kind) {
      case 'match': {
        const r = await this.db.query(
          `SELECT m.title, m.date, m.needed_players, c.name AS club_name, c.cover_url,
                  (SELECT COUNT(*)::int FROM match_players mp
                    WHERE mp.match_id = m.id AND mp.status IN ('JOINED', 'CONFIRMED'))
                  + (SELECT COUNT(*)::int FROM match_guests mg WHERE mg.match_id = m.id) AS joined
           FROM matches m LEFT JOIN clubs c ON c.id = m.club_id
           WHERE m.id = $1`,
          [id],
        );
        const row = r.rows[0];
        if (!row) return null;
        const missing = Math.max(0, Number(row.needed_players) - Number(row.joined));
        return {
          title: `Sumate: ${row.title || 'Partido de pádel'}`,
          description: [
            formatMatchDate(new Date(row.date)),
            row.club_name,
            missing > 0 ? `Falta${missing === 1 ? '' : 'n'} ${missing}` : 'Partido completo',
          ]
            .filter(Boolean)
            .join(' · '),
          image: row.cover_url ?? null,
        };
      }
      case 'club': {
        const r = await this.db.query(
          `SELECT name, city, address, cover_url, logo_url FROM clubs WHERE id = $1`,
          [id],
        );
        const row = r.rows[0];
        if (!row) return null;
        return {
          title: row.name,
          description: [row.city, row.address].filter(Boolean).join(' · ') || 'Club en x4 match',
          image: row.cover_url || row.logo_url || null,
        };
      }
      case 'tournament': {
        const r = await this.db.query(
          `SELECT t.name, t.start_date, t.category, c.name AS club_name, c.cover_url
           FROM tournaments t LEFT JOIN clubs c ON c.id = t.club_id
           WHERE t.id = $1`,
          [id],
        );
        const row = r.rows[0];
        if (!row) return null;
        return {
          title: row.name,
          description: [
            row.start_date ? formatMatchDate(new Date(row.start_date)) : null,
            row.category,
            row.club_name,
          ]
            .filter(Boolean)
            .join(' · '),
          image: row.cover_url ?? null,
        };
      }
      case 'player': {
        const r = await this.db.query(
          `SELECT u.name, p.photo_url, p.city FROM users u
           LEFT JOIN players p ON p.user_id = u.id
           WHERE u.id = $1 AND u.role = 'PLAYER'`,
          [id],
        );
        const row = r.rows[0];
        if (!row) return null;
        return {
          title: `${row.name} en x4 match`,
          description: row.city ? `Jugador de pádel · ${row.city}` : 'Jugador de pádel',
          image: row.photo_url ?? null,
        };
      }
      case 'slot': {
        if (!slotId) return null;
        const r = await this.db.query(
          `SELECT s.court_label, s.slot_date, s.start_hour, s.end_hour, s.status,
                  c.name AS club_name, c.cover_url
           FROM court_availability_slots s
           INNER JOIN clubs c ON c.id = s.club_id
           WHERE s.id = $1 AND s.club_id = $2`,
          [slotId, id],
        );
        const row = r.rows[0];
        if (!row) return null;
        return {
          title: `Horario libre en ${row.club_name}`,
          description: [
            `${formatSlotDate(row.slot_date)} ${formatHour(row.start_hour)}–${formatHour(row.end_hour)}`,
            row.court_label,
            row.status === 'OPEN' ? '¿Armamos partido?' : 'Ya no está disponible',
          ].join(' · '),
          image: row.cover_url ?? null,
        };
      }
    }
  }

  @Get('match/:id')
  async match(@Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    const result = await this.db.query(
      `SELECT m.title, m.date, c.name AS club_name
       FROM matches m
       LEFT JOIN clubs c ON c.id = m.club_id
       WHERE m.id = $1`,
      [id],
    );
    const row = result.rows[0] as
      | { title: string; date: Date | string; club_name: string | null }
      | undefined;

    const title = row?.title || 'Partido en x4 match';
    const when = row ? formatMatchDate(new Date(row.date)) : null;
    const description = row
      ? [when, row.club_name].filter(Boolean).join(' · ')
      : 'Abrí x4 match para ver el partido.';
    const deepLink = `${APP_SCHEME}://match/${id}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · x4 match</title>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="x4 match" />
  <meta property="og:title" content="${escapeHtml(`Sumate: ${title}`)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta name="twitter:card" content="summary" />
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0B0F;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    main{max-width:360px;padding:32px 24px;text-align:center}
    h1{font-size:22px;margin:0 0 8px}
    p{color:#A1A1AA;margin:0 0 24px;line-height:1.4}
    a.btn{display:block;padding:14px 18px;border-radius:14px;font-weight:700;text-decoration:none;margin-bottom:12px}
    a.primary{background:#D7FF00;color:#0B0B0F}
    a.secondary{border:1px solid #3F3F46;color:#fff}
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <a class="btn primary" href="${deepLink}">Abrir en x4 match</a>
    <a class="btn secondary" href="${PLAY_STORE_URL}">Descargar la app</a>
  </main>
  <script>setTimeout(function(){window.location.href=${JSON.stringify(deepLink)};},300);</script>
</body>
</html>`);
  }
}
