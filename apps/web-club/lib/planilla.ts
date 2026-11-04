import {
  AGENDA_END_HOUR,
  AGENDA_START_HOUR,
  AGENDA_STEP_MINUTES,
  hourToMinutes,
  slotDateKey,
} from '@/lib/slot-time';

export type PlanillaCourt = { id: string; name: string };

export type PlanillaSlot = {
  id: string;
  court_id?: string | null;
  court_label: string;
  slot_date: string;
  start_hour: string | number;
  end_hour: string | number;
  status?: string;
  price_per_hour?: number | string | null;
  pricePerHour?: number | null;
  block_reason?: string | null;
  booking_source?: 'APP' | 'MANUAL' | null;
  booked_by_name?: string | null;
  booked_by_phone?: string | null;
  match_id?: string | null;
  match_title?: string | null;
  match_organizer_name?: string | null;
};

export type PlanillaSchedule = {
  id: string;
  court_id: string;
  day_of_week: number;
  start_hour: string | number;
  end_hour: string | number;
};

/** Ocupado = rojo, libre = verde, bloqueado = ámbar, cerrado = gris. */
export type CellState = 'occupied' | 'free' | 'blocked' | 'closed';

export function slotCellState(slot: PlanillaSlot): CellState {
  if (slot.status === 'BOOKED') return 'occupied';
  if (slot.status === 'BLOCKED' || slot.status === 'MAINTENANCE') return 'blocked';
  return 'free';
}

export function slotCourtKey(slot: PlanillaSlot): string {
  return slot.court_id || slot.court_label;
}

export function slotPrice(slot: PlanillaSlot): number {
  return Number(slot.price_per_hour ?? slot.pricePerHour ?? 0) || 0;
}

export function slotHolderLabel(slot: PlanillaSlot): string {
  if (slot.status !== 'BOOKED') return '';
  if (slot.booking_source === 'MANUAL') return slot.booked_by_name || 'Reserva del club';
  return slot.match_organizer_name || slot.match_title || 'Reserva por la app';
}

export function planillaRows(): number[] {
  const rows: number[] = [];
  for (let m = AGENDA_START_HOUR * 60; m < AGENDA_END_HOUR * 60; m += AGENDA_STEP_MINUTES) {
    rows.push(m);
  }
  return rows;
}

export function dayOfWeekFromISO(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

export function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayLocalISO(): string {
  return toLocalISO(new Date());
}

export function startOfWeekISO(date: string): string {
  const dow = dayOfWeekFromISO(date);
  return addDaysISO(date, dow === 0 ? -6 : 1 - dow);
}

/**
 * Minutos en que la cancha está abierta ese día según sus horarios fijos.
 * Sin horarios cargados se asume abierta todo el rango de la planilla.
 */
export function openMinutesForCourt(
  courtId: string,
  date: string,
  schedules: PlanillaSchedule[],
): (minutes: number) => boolean {
  const courtSchedules = schedules.filter((s) => s.court_id === courtId);
  if (!courtSchedules.length) return () => true;
  const dow = dayOfWeekFromISO(date);
  const windows = courtSchedules
    .filter((s) => Number(s.day_of_week) === dow)
    .map((s) => [hourToMinutes(s.start_hour), hourToMinutes(s.end_hour)] as const);
  return (minutes) => windows.some(([start, end]) => minutes >= start && minutes < end);
}

export type CourtDayCell = {
  minutes: number;
  state: CellState;
  slot: PlanillaSlot | null;
};

export function buildCourtDayCells(
  court: PlanillaCourt,
  date: string,
  slots: PlanillaSlot[],
  schedules: PlanillaSchedule[],
): CourtDayCell[] {
  const isOpen = openMinutesForCourt(court.id, date, schedules);
  const courtSlots = slots.filter(
    (s) => slotDateKey(s.slot_date) === date && s.status !== 'CANCELLED' && slotCourtKey(s) === court.id,
  );
  return planillaRows().map((minutes) => {
    const slot =
      courtSlots.find(
        (s) => minutes >= hourToMinutes(s.start_hour) && minutes < hourToMinutes(s.end_hour),
      ) || null;
    if (slot) return { minutes, state: slotCellState(slot), slot };
    return { minutes, state: isOpen(minutes) ? 'free' : 'closed', slot: null };
  });
}

export type OccupancySummary = {
  occupiedHours: number;
  freeHours: number;
  blockedHours: number;
  occupancyPct: number;
  bookedRevenue: number;
};

export function summarizeDay(
  courts: PlanillaCourt[],
  date: string,
  slots: PlanillaSlot[],
  schedules: PlanillaSchedule[],
): OccupancySummary {
  const stepHours = AGENDA_STEP_MINUTES / 60;
  let occupied = 0;
  let free = 0;
  let blocked = 0;
  let revenue = 0;
  for (const court of courts) {
    for (const cell of buildCourtDayCells(court, date, slots, schedules)) {
      if (cell.state === 'occupied') {
        occupied += stepHours;
        revenue += slotPrice(cell.slot!) * stepHours;
      } else if (cell.state === 'free') free += stepHours;
      else if (cell.state === 'blocked') blocked += stepHours;
    }
  }
  const sellable = occupied + free;
  return {
    occupiedHours: occupied,
    freeHours: free,
    blockedHours: blocked,
    occupancyPct: sellable > 0 ? Math.round((occupied / sellable) * 100) : 0,
    bookedRevenue: Math.round(revenue),
  };
}

/** Por cada media hora: cuántas canchas abiertas hay y cuántas están ocupadas. */
export function dayHourOccupancy(
  courts: PlanillaCourt[],
  date: string,
  slots: PlanillaSlot[],
  schedules: PlanillaSchedule[],
): Map<number, { open: number; occupied: number }> {
  const map = new Map<number, { open: number; occupied: number }>();
  for (const minutes of planillaRows()) map.set(minutes, { open: 0, occupied: 0 });
  for (const court of courts) {
    for (const cell of buildCourtDayCells(court, date, slots, schedules)) {
      const entry = map.get(cell.minutes)!;
      if (cell.state === 'occupied') {
        entry.open += 1;
        entry.occupied += 1;
      } else if (cell.state === 'free') {
        entry.open += 1;
      }
    }
  }
  return map;
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded.toLocaleString('es-AR')} h`;
}
