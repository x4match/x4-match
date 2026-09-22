export type AvailabilityWindow = {
  dayDate: string; // YYYY-MM-DD
  startHour: number;
  endHour: number;
  preferredClubId?: string | null;
};

export type WeeklyAvailabilitySlot = {
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  clubId?: string | null;
};

export type TeamAvailability = {
  registrationId: string;
  windows: AvailabilityWindow[];
  preferredClubIds: string[];
  hasExplicitAvailability: boolean;
};

/** Overlap length in hours between [aStart,aEnd) and [bStart,bEnd). */
export function hourOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export function dateToDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function eachDayKey(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(start);
  cur.setHours(12, 0, 0, 0);
  const last = new Date(end);
  last.setHours(12, 0, 0, 0);
  while (cur.getTime() <= last.getTime()) {
    keys.push(dateToDayKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

/** Expand weekly slots into concrete day windows for an event date range. */
export function expandWeeklyToEventDays(
  weekly: WeeklyAvailabilitySlot[],
  dayKeys: string[],
): AvailabilityWindow[] {
  const out: AvailabilityWindow[] = [];
  for (const dayKey of dayKeys) {
    const dow = parseDayKey(dayKey).getDay();
    for (const slot of weekly) {
      if (slot.dayOfWeek !== dow) continue;
      out.push({
        dayDate: dayKey,
        startHour: slot.startHour,
        endHour: slot.endHour,
        preferredClubId: slot.clubId ?? null,
      });
    }
  }
  return out;
}

/**
 * Intersect two players' windows for a specific day.
 * Prefer windows that share the same preferred club when both specify one.
 */
export function intersectPlayerWindows(
  a: AvailabilityWindow[],
  b: AvailabilityWindow[],
  dayDate: string,
): AvailabilityWindow[] {
  const aDay = a.filter((w) => w.dayDate === dayDate);
  const bDay = b.filter((w) => w.dayDate === dayDate);
  if (!aDay.length || !bDay.length) return [];

  const result: AvailabilityWindow[] = [];
  for (const wa of aDay) {
    for (const wb of bDay) {
      const start = Math.max(wa.startHour, wb.startHour);
      const end = Math.min(wa.endHour, wb.endHour);
      if (end - start < 1) continue;

      let preferredClubId: string | null = null;
      if (wa.preferredClubId && wb.preferredClubId) {
        if (wa.preferredClubId === wb.preferredClubId) {
          preferredClubId = wa.preferredClubId;
        } else {
          continue;
        }
      } else {
        preferredClubId = wa.preferredClubId ?? wb.preferredClubId ?? null;
      }

      result.push({ dayDate, startHour: start, endHour: end, preferredClubId });
    }
  }
  return mergeOverlappingWindows(result);
}

export function mergeOverlappingWindows(windows: AvailabilityWindow[]): AvailabilityWindow[] {
  const byClub = new Map<string, AvailabilityWindow[]>();
  for (const w of windows) {
    const key = `${w.dayDate}|${w.preferredClubId ?? ''}`;
    const list = byClub.get(key) ?? [];
    list.push(w);
    byClub.set(key, list);
  }

  const merged: AvailabilityWindow[] = [];
  for (const list of byClub.values()) {
    list.sort((x, y) => x.startHour - y.startHour || x.endHour - y.endHour);
    let cur = { ...list[0] };
    for (let i = 1; i < list.length; i++) {
      const nxt = list[i];
      if (nxt.startHour <= cur.endHour) {
        cur.endHour = Math.max(cur.endHour, nxt.endHour);
      } else {
        merged.push(cur);
        cur = { ...nxt };
      }
    }
    merged.push(cur);
  }
  return merged;
}

/** Team (= pair) availability = intersection of both players when both have data. */
export function intersectTeamWindows(
  player1: AvailabilityWindow[],
  player2: AvailabilityWindow[],
  dayKeys: string[],
): AvailabilityWindow[] {
  if (!player1.length && !player2.length) return [];
  if (!player1.length) return player2.filter((w) => dayKeys.includes(w.dayDate));
  if (!player2.length) return player1.filter((w) => dayKeys.includes(w.dayDate));

  const out: AvailabilityWindow[] = [];
  for (const day of dayKeys) {
    out.push(...intersectPlayerWindows(player1, player2, day));
  }
  return out;
}

export function teamCoversSlot(
  team: TeamAvailability,
  dayDate: string,
  startHour: number,
  endHour: number,
  clubId: string,
  strict: boolean,
): { ok: boolean; score: number; warning?: string } {
  if (!team.hasExplicitAvailability) {
    return {
      ok: !strict,
      score: strict ? 0 : 5,
      warning: strict ? 'Pareja sin disponibilidad' : 'Sin disponibilidad cargada',
    };
  }

  const covering = team.windows.filter(
    (w) =>
      w.dayDate === dayDate &&
      w.startHour <= startHour &&
      w.endHour >= endHour &&
      (!w.preferredClubId || w.preferredClubId === clubId),
  );

  if (!covering.length) {
    return { ok: false, score: 0, warning: 'Fuera de disponibilidad' };
  }

  let score = 20;
  if (team.preferredClubIds.includes(clubId)) score += 15;
  const bestOverlap = Math.max(
    ...covering.map((w) => hourOverlap(w.startHour, w.endHour, startHour, endHour)),
  );
  score += bestOverlap * 2;
  return { ok: true, score };
}

export type CourtSlot = {
  clubId: string;
  clubName: string;
  courtLabel: string;
  dayDate: string;
  startHour: number;
  endHour: number;
  startAt: Date;
  isPrimary: boolean;
};

export function buildVenueSlots(params: {
  venues: Array<{
    clubId: string;
    clubName: string;
    courtsCount: number;
    isPrimary: boolean;
  }>;
  dayKeys: string[];
  dayStartHour: number;
  dayEndHour: number;
  matchDurationMinutes: number;
}): CourtSlot[] {
  const durationHours = params.matchDurationMinutes / 60;
  const slots: CourtSlot[] = [];

  for (const venue of params.venues) {
    for (const dayDate of params.dayKeys) {
      for (let court = 1; court <= venue.courtsCount; court++) {
        for (
          let start = params.dayStartHour;
          start + durationHours <= params.dayEndHour;
          start += durationHours
        ) {
          const end = start + durationHours;
          const startAt = parseDayKey(dayDate);
          startAt.setHours(Math.floor(start), Math.round((start % 1) * 60), 0, 0);
          slots.push({
            clubId: venue.clubId,
            clubName: venue.clubName,
            courtLabel: `Cancha ${court}`,
            dayDate,
            startHour: start,
            endHour: end,
            startAt,
            isPrimary: venue.isPrimary,
          });
        }
      }
    }
  }

  return slots;
}

export function rangesOverlap(
  aStart: Date,
  aEndMs: number,
  bStart: Date,
  bEndMs: number,
): boolean {
  const a0 = aStart.getTime();
  const a1 = a0 + aEndMs;
  const b0 = bStart.getTime();
  const b1 = b0 + bEndMs;
  return a0 < b1 && b0 < a1;
}
