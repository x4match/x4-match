'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatHourLabel } from '@/lib/slot-time';
import {
  addDaysISO,
  dayHourOccupancy,
  planillaRows,
  summarizeDay,
  todayLocalISO,
  type PlanillaCourt,
  type PlanillaSchedule,
  type PlanillaSlot,
} from '@/lib/planilla';

type WeekOccupancyGridProps = {
  weekStart: string;
  courts: PlanillaCourt[];
  slots: PlanillaSlot[];
  schedules: PlanillaSchedule[];
  onPickDay: (date: string) => void;
};

const WEEKDAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function occupancyClass(open: number, occupied: number) {
  if (open === 0) return 'bg-muted/60 text-muted-foreground/60';
  if (occupied === 0) return 'bg-emerald-500/85 text-white';
  if (occupied >= open) return 'bg-rose-600 text-white';
  return occupied / open >= 0.5 ? 'bg-orange-500 text-white' : 'bg-lime-500 text-white';
}

export function WeekOccupancyGrid({ weekStart, courts, slots, schedules, onPickDay }: WeekOccupancyGridProps) {
  const today = todayLocalISO();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);
  const rows = useMemo(() => planillaRows(), []);

  const perDay = useMemo(
    () =>
      days.map((date) => ({
        date,
        hours: dayHourOccupancy(courts, date, slots, schedules),
        summary: summarizeDay(courts, date, slots, schedules),
      })),
    [days, courts, slots, schedules],
  );

  if (!courts.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Creá canchas en la pestaña Canchas para ver la planilla.
      </div>
    );
  }

  return (
    <div className="max-h-[75vh] overflow-auto rounded-xl border bg-card">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: '64px repeat(7, minmax(80px, 1fr))' }}>
        <div className="sticky left-0 top-0 z-30 border-b bg-muted px-2 py-2 text-xs font-medium">Hora</div>
        {perDay.map(({ date, summary }) => {
          const d = new Date(`${date}T12:00:00`);
          return (
            <button
              key={`head-${date}`}
              type="button"
              onClick={() => onPickDay(date)}
              className={cn(
                'sticky top-0 z-20 border-b border-l bg-muted px-2 py-1.5 text-left hover:bg-muted/70',
                date === today && 'ring-2 ring-inset ring-sky-500',
              )}
            >
              <div className="text-sm font-semibold">
                {WEEKDAY[d.getDay()]} {d.getDate()}
              </div>
              <div className="text-[11px] text-muted-foreground">{summary.occupancyPct}% ocupado</div>
            </button>
          );
        })}

        {rows.map((minutes) => (
          <div key={`row-${minutes}`} className="contents">
            <div
              className={cn(
                'sticky left-0 z-10 flex h-6 items-center justify-end border-b border-r bg-card px-2 text-[11px] text-muted-foreground',
                minutes % 60 === 0 && 'font-medium text-foreground',
              )}
            >
              {formatHourLabel(minutes / 60)}
            </div>
            {perDay.map(({ date, hours }) => {
              const cell = hours.get(minutes) || { open: 0, occupied: 0 };
              return (
                <button
                  key={`${date}-${minutes}`}
                  type="button"
                  onClick={() => onPickDay(date)}
                  title={
                    cell.open
                      ? `${cell.occupied} de ${cell.open} canchas ocupadas`
                      : 'Sin canchas abiertas'
                  }
                  className={cn(
                    'h-6 border-b border-l border-background/40 text-[10px] font-medium transition-opacity hover:opacity-80',
                    occupancyClass(cell.open, cell.occupied),
                  )}
                >
                  {cell.open ? `${cell.occupied}/${cell.open}` : ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
