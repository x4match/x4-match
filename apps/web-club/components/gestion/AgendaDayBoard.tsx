'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AGENDA_END_HOUR,
  AGENDA_START_HOUR,
  AGENDA_STEP_MINUTES,
  formatHourLabel,
  hourToMinutes,
  minutesToHour,
  slotDateKey,
} from '@/lib/slot-time';
import {
  buildCourtDayCells,
  slotCellState,
  slotCourtKey,
  slotHolderLabel,
  todayLocalISO,
  type CellState,
  type PlanillaCourt,
  type PlanillaSchedule,
  type PlanillaSlot,
} from '@/lib/planilla';

type MovePayload = {
  slotId: string;
  courtId: string;
  courtLabel: string;
  slotDate: string;
  startHour: number;
  endHour: number;
};

type AgendaDayBoardProps = {
  date: string;
  courts: PlanillaCourt[];
  slots: PlanillaSlot[];
  schedules: PlanillaSchedule[];
  onMove: (payload: MovePayload) => void;
  onCellClick: (court: PlanillaCourt, minutes: number, state: CellState) => void;
  onSlotClick: (slot: PlanillaSlot) => void;
  moving?: boolean;
};

const ROW_H = 36;

export const PLANILLA_STATE_STYLES: Record<CellState, string> = {
  occupied: 'bg-rose-600 text-white border-rose-700',
  free: 'bg-emerald-500 text-white border-emerald-600',
  blocked: 'bg-amber-500 text-white border-amber-600',
  closed: 'bg-muted text-muted-foreground border-border',
};

function slotSubtitle(slot: PlanillaSlot): string {
  if (slot.status === 'BOOKED') return slotHolderLabel(slot);
  if (slot.status === 'MAINTENANCE') return slot.block_reason || 'Mantenimiento';
  if (slot.status === 'BLOCKED') return slot.block_reason || 'Bloqueado';
  return 'Libre · publicado en la app';
}

function isDraggable(slot: PlanillaSlot) {
  return slot.status !== 'BOOKED' || slot.booking_source === 'MANUAL';
}

function useNowMinutes() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now ? now.getHours() * 60 + now.getMinutes() : null;
}

function DropCell({
  id,
  state,
  past,
  onClick,
}: {
  id: string;
  state: CellState;
  past: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={onClick}
      style={{ height: ROW_H }}
      title={state === 'free' ? 'Libre · tocá para anotar una reserva' : 'Cerrado · tocá para cargar un turno igual'}
      className={cn(
        'group flex w-full items-center justify-center border-b border-border/40 transition-colors',
        state === 'free'
          ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40'
          : 'bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(0,0,0,0.04)_6px,rgba(0,0,0,0.04)_12px)] hover:bg-muted/60',
        past && 'opacity-50',
        isOver && 'bg-primary/25',
      )}
    >
      <Plus className="size-3.5 text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-emerald-300" />
    </button>
  );
}

function DraggableSlot({
  slot,
  topPx,
  heightPx,
  past,
  onClick,
}: {
  slot: PlanillaSlot;
  topPx: number;
  heightPx: number;
  past: boolean;
  onClick: () => void;
}) {
  const disabled = !isDraggable(slot);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: slot.id,
    data: { slot },
    disabled,
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={onClick}
      style={{
        transform: CSS.Translate.toString(transform),
        top: topPx,
        height: Math.max(heightPx - 2, 26),
        opacity: isDragging ? 0.4 : past ? 0.65 : 1,
      }}
      className={cn(
        'absolute left-1 right-1 z-10 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm',
        PLANILLA_STATE_STYLES[slotCellState(slot)],
        disabled ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
      )}
      {...listeners}
      {...attributes}
    >
      <div className="truncate font-semibold">
        {formatHourLabel(hourToMinutes(slot.start_hour) / 60)}–
        {formatHourLabel(hourToMinutes(slot.end_hour) / 60)}
        {slot.status === 'BOOKED' ? ' · Ocupado' : ''}
      </div>
      <div className="truncate opacity-90">{slotSubtitle(slot)}</div>
    </button>
  );
}

function parseDropId(id: string): { courtId: string; minutes: number } | null {
  const [courtId, minutesRaw] = String(id).split('__');
  const minutes = Number(minutesRaw);
  if (!courtId || !Number.isFinite(minutes)) return null;
  return { courtId, minutes };
}

export function AgendaDayBoard({
  date,
  courts,
  slots,
  schedules,
  onMove,
  onCellClick,
  onSlotClick,
  moving,
}: AgendaDayBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const nowMinutes = useNowMinutes();
  const today = todayLocalISO();
  const isPastMinute = (minutes: number) =>
    date < today || (date === today && nowMinutes != null && minutes + AGENDA_STEP_MINUTES <= nowMinutes);

  const daySlots = useMemo(
    () => slots.filter((s) => slotDateKey(s.slot_date) === date && s.status !== 'CANCELLED'),
    [slots, date],
  );

  const courtColumns = courts.length
    ? courts
    : Array.from(
        new Map(daySlots.map((s) => [slotCourtKey(s), { id: slotCourtKey(s), name: s.court_label }])).values(),
      );

  const cellsByCourt = useMemo(
    () =>
      new Map(courtColumns.map((court) => [court.id, buildCourtDayCells(court, date, daySlots, schedules)])),
    [courtColumns, date, daySlots, schedules],
  );

  const activeSlot = daySlots.find((s) => s.id === activeId) || null;
  const rowCount = ((AGENDA_END_HOUR - AGENDA_START_HOUR) * 60) / AGENDA_STEP_MINUTES;
  const boardHeight = rowCount * ROW_H;
  const nowTop =
    date === today && nowMinutes != null && nowMinutes >= AGENDA_START_HOUR * 60 && nowMinutes < AGENDA_END_HOUR * 60
      ? ((nowMinutes - AGENDA_START_HOUR * 60) / AGENDA_STEP_MINUTES) * ROW_H
      : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const slot = event.active.data.current?.slot as PlanillaSlot | undefined;
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!slot || !overId || !isDraggable(slot)) return;

    const drop = parseDropId(overId);
    if (!drop) return;
    const court = courtColumns.find((c) => c.id === drop.courtId);
    if (!court) return;

    const duration =
      hourToMinutes(slot.end_hour) - hourToMinutes(slot.start_hour) || AGENDA_STEP_MINUTES * 3;
    const startHour = minutesToHour(drop.minutes);
    const endHour = minutesToHour(drop.minutes + duration);
    if (endHour > AGENDA_END_HOUR) return;

    const sameCourt = slotCourtKey(slot) === court.id;
    const sameStart = hourToMinutes(slot.start_hour) === drop.minutes;
    if (sameCourt && sameStart) return;

    onMove({
      slotId: slot.id,
      courtId: court.id,
      courtLabel: court.name,
      slotDate: date,
      startHour,
      endHour,
    });
  }

  if (!courtColumns.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Creá canchas en la pestaña Canchas para ver la planilla.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'max-h-[75vh] overflow-auto rounded-xl border bg-card',
        moving && 'pointer-events-none opacity-70',
      )}
    >
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          className="grid min-w-[640px]"
          style={{ gridTemplateColumns: `64px repeat(${courtColumns.length}, minmax(140px, 1fr))` }}
        >
          <div className="sticky left-0 top-0 z-40 border-b bg-muted px-2 py-2 text-xs font-medium">
            Hora
          </div>
          {courtColumns.map((court) => (
            <div
              key={`head-${court.id}`}
              className="sticky top-0 z-30 border-b border-l bg-muted px-2 py-2 text-sm font-semibold"
            >
              {court.name}
            </div>
          ))}

          <div className="sticky left-0 z-20 border-r bg-card">
            {Array.from({ length: rowCount }, (_, i) => AGENDA_START_HOUR * 60 + i * AGENDA_STEP_MINUTES).map(
              (minutes) => (
                <div
                  key={`label-${minutes}`}
                  style={{ height: ROW_H }}
                  className={cn(
                    'flex items-start justify-end border-b px-2 pt-1 text-[11px] text-muted-foreground',
                    minutes % 60 === 0 && 'font-medium text-foreground',
                  )}
                >
                  {formatHourLabel(minutes / 60)}
                </div>
              ),
            )}
          </div>

          {courtColumns.map((court) => {
            const cells = cellsByCourt.get(court.id) || [];
            const courtSlots = daySlots.filter((s) => slotCourtKey(s) === court.id);
            return (
              <div key={`col-${court.id}`} className="relative border-l" style={{ height: boardHeight }}>
                {cells.map((cell) => (
                  <DropCell
                    key={`${court.id}-${cell.minutes}`}
                    id={`${court.id}__${cell.minutes}`}
                    state={cell.slot ? 'free' : cell.state}
                    past={isPastMinute(cell.minutes)}
                    onClick={() => onCellClick(court, cell.minutes, cell.state)}
                  />
                ))}
                {courtSlots.map((slot) => {
                  const start = hourToMinutes(slot.start_hour);
                  const end = hourToMinutes(slot.end_hour);
                  const topPx = ((start - AGENDA_START_HOUR * 60) / AGENDA_STEP_MINUTES) * ROW_H + 1;
                  const heightPx = ((end - start) / AGENDA_STEP_MINUTES) * ROW_H;
                  return (
                    <DraggableSlot
                      key={slot.id}
                      slot={slot}
                      topPx={topPx}
                      heightPx={heightPx}
                      past={isPastMinute(end - AGENDA_STEP_MINUTES)}
                      onClick={() => onSlotClick(slot)}
                    />
                  );
                })}
                {nowTop != null ? (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 h-0.5 bg-sky-500"
                    style={{ top: nowTop }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeSlot ? (
            <div
              className={cn(
                'rounded-md border px-2 py-1 text-xs shadow-lg',
                PLANILLA_STATE_STYLES[slotCellState(activeSlot)],
              )}
            >
              {formatHourLabel(hourToMinutes(activeSlot.start_hour) / 60)} · {activeSlot.court_label}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
