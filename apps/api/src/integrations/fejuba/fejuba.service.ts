import { Injectable, Logger } from '@nestjs/common';
import type { PlayerCategory } from '../../common/utils';
import { PLAYER_CATEGORIES } from '../../common/utils';
import type { FejubaGenderHint, FejubaLookupResult, FejubaMatch } from './fejuba.types';

const FEJUBA_BASE = 'https://www.fejuba.com.ar';
const LOOKUP_TIMEOUT_MS = 8000;

@Injectable()
export class FejubaService {
  private readonly logger = new Logger(FejubaService.name);

  normalizeDni(raw: string): string {
    return String(raw ?? '').replace(/\D/g, '');
  }

  isValidDni(dni: string): boolean {
    return /^\d{7,8}$/.test(dni);
  }

  async lookupByDni(rawDni: string): Promise<FejubaLookupResult> {
    const dni = this.normalizeDni(rawDni);
    if (!this.isValidDni(dni)) {
      return { found: false, matches: [] };
    }

    try {
      const html = await this.fetchPlayerListHtml(dni);
      const matches = this.parsePlayerCards(html);
      return { found: matches.length > 0, matches };
    } catch (error) {
      this.logger.warn(
        `FEJUBA lookup failed for dni=${dni}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { found: false, matches: [] };
    }
  }

  private async fetchPlayerListHtml(dni: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    try {
      // Seed cookies/session like a browser visit to the players page.
      await fetch(`${FEJUBA_BASE}/p_jugadores.php`, {
        method: 'GET',
        headers: this.browserHeaders(),
        signal: controller.signal,
      }).catch(() => undefined);

      const url =
        `${FEJUBA_BASE}/ajax/ajax_jugadores_listado_apa_filtro.php` +
        `?vdni=${encodeURIComponent(dni)}` +
        `&vedad=-1&vedadmax=-1&pais=-1&idfederacion=-1` +
        `&idcategoria=-1&idcategoriatorneo=-1&idasociacion=-1` +
        `&provincia=-1&ciudad=-1&jug_ape=`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.browserHeaders(),
          Referer: `${FEJUBA_BASE}/p_jugadores.php`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      // FEJUBA sirve ISO-8859-1 / latin1.
      return buffer.toString('latin1');
    } finally {
      clearTimeout(timer);
    }
  }

  private browserHeaders(): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (compatible; x4matchBot/1.0; +https://x4match.app)',
      Accept: 'text/html, */*;q=0.8',
    };
  }

  parsePlayerCards(html: string): FejubaMatch[] {
    const cards = html.split('contenedor_redondeado').slice(1);
    const matches: FejubaMatch[] = [];
    const seen = new Set<string>();

    for (const card of cards) {
      const idMatch = card.match(/myclick\((\d+)/);
      if (!idMatch) continue;
      const fejubaId = idMatch[1];
      if (seen.has(fejubaId)) continue;
      seen.add(fejubaId);

      const nameMatch = card.match(/<b>([^<]+)<\/b>\s*,\s*<b>([^<]+)<\/b>/i);
      const lastName = nameMatch?.[1]?.trim() ?? '';
      const firstName = nameMatch?.[2]?.trim() ?? '';
      if (!lastName && !firstName) continue;

      const categoryMatch = card.match(/\b((?:1ra|2da|3ra|4ta|5ta|6ta|7ma|8va))\s*([CD])\b/i);
      const rawCategory = categoryMatch
        ? `${categoryMatch[1]} ${categoryMatch[2].toUpperCase()}`
        : null;
      const category = this.mapCategory(categoryMatch?.[1] ?? null);
      const genderHint = this.mapGender(categoryMatch?.[2] ?? null);

      matches.push({
        fejubaId,
        fullName: this.formatFullName(firstName, lastName),
        category,
        rawCategory,
        genderHint,
      });
    }

    return matches;
  }

  private mapCategory(raw: string | null): PlayerCategory | null {
    if (!raw) return null;
    const normalized = raw.toLowerCase() as PlayerCategory;
    return (PLAYER_CATEGORIES as readonly string[]).includes(normalized)
      ? normalized
      : null;
  }

  private mapGender(letter: string | null): FejubaGenderHint | null {
    if (!letter) return null;
    const upper = letter.toUpperCase();
    if (upper === 'C') return 'Masculino';
    if (upper === 'D') return 'Femenino';
    return null;
  }

  private formatFullName(firstName: string, lastName: string): string {
    const toTitle = (value: string) =>
      value
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

    return [toTitle(firstName), toTitle(lastName)].filter(Boolean).join(' ').trim();
  }
}
