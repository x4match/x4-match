import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
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

@Controller('share')
export class ShareController {
  constructor(private readonly db: DatabaseService) {}

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
