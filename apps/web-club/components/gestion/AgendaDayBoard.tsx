'use client';

import { useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency';
import {
  AGENDA_END_HOUR,
  AGENDA_START_HOUR,
  AGENDA_STEP_MINUTES,
  formatHourLabel,
  hourToMinutes,
  minutesToHour,
  slotDateKey,
} from '@/lib/slot-time';

export type AgendaCourt = { id: string; name: string };

export type AgendaSlot = {
  id: string;
  court_id?: string | null;
  court_label: string;
  slot_date: string;
  start_hour: string | number;
  end_hour: string | number;
  status?: string;
  price_per_hour?: number | null;
  pricePerHour?: number | null;
};

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
  courts: AgendaCourt[];
  slots: AgendaSlot[];
  onMove: (payload: MovePayload) => void;
  moving?: boolean;
};

const ROW_H = 40;

function statusStyles(status?: string) {
  if (status === 'BOOKED') return 'bg-emerald-600/90 text-white border-emerald-700';
  if (status === 'MAINTENANCE' || status === 'BLOCKED') {
    return 'bg-amber-500/90 text-white border-amber-600';
  }
  return 'bg-primary text-primary-foreground border-primary';
}

function DropCell({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn('h-10 border-b border-border/50', isOver && 'bg-primary/20')}
    />
  );
}

function DraggableSlot({
  slot,
  topPx,
  heightPx,
}: {
  slot: AgendaSlot;
  topPx: number;
  heightPx: number;
}) {
  const disabled = slot.status === 'BOOKED';
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: slot.id,
    data: { slot },
    disabled,
  });

  const price = Number(slot.price_per_hour ?? slot.pricePerHour ?? 0);

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        top: topPx,
        height: Math.max(heightPx, 28),
        opacity: isDragging ? 0.4 : 1,
      }}
      className={cn(
        'absolute left-1 right-1 z-10 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm',
        statusStyles(slot.status),
        disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
      )}
      {...listeners}
      {...attributes}
    >
      <div className="truncate font-semibold">
        {formatHourLabel(hourToMinutes(slot.start_hour) / 60)}–
        {formatHourLabel(hourToMinutes(slot.end_hour) / 60)}
      </div>
      <div className="truncate opacity-90">
        {slot.status === 'BOOKED'
          ? 'Reservado'
          : slot.status === 'MAINTENANCE'
            ? 'Mantenimiento'
            : slot.status === 'BLOCKED'
              ? 'Bloqueado'
              : 'Libre'}
      </div>
      {price > 0 ? <div className="opacity-80">{formatCurrency(price)}/h</div> : null}
    </button>
  );
}

function parseDropId(id: string): { courtId: string; minutes: number } | null {
  const [courtId, minutesRaw] = String(id).split('__');
  const minutes = Number(minutesRaw);
  if (!courtId || !Number.isFinite(minutes)) return null;
  return { courtId, minutes };
}

export function AgendaDayBoard({ date, courts, slots, onMove, moving }: AgendaDayBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const rows = useMemo(() => {
    const list: number[] = [];
    for (let m = AGENDA_START_HOUR * 60; m < AGENDA_END_HOUR * 60; m += AGENDA_STEP_MINUTES) {
      list.push(m);
    }
    return list;
  }, []);

  const daySlots = useMemo(
    () => slots.filter((s) => slotDateKey(s.slot_date) === date && s.status !== 'CANCELLED'),
    [slots, date],
  );

  const courtColumns = courts.length
    ? courts
    : Array.from(
        new Map(
          daySlots.map((s) => [
            s.court_id || s.court_label,
            { id: s.court_id || s.court_label, name: s.court_label },
          ]),
        ).values(),
      );

  const activeSlot = daySlots.find((s) => s.id === activeId) || null;
  const boardHeight = rows.length * ROW_H;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const slot = event.active.data.current?.slot as AgendaSlot | undefined;
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!slot || !overId || slot.status === 'BOOKED') return;

    const drop = parseDropId(overId);
    if (!drop) return;
    const court = courtColumns.find((c) => c.id === drop.courtId);
    if (!court) return;

    const duration =
      hourToMinutes(slot.end_hour) - hourToMinutes(slot.start_hour) || AGENDA_STEP_MINUTES * 3;
    const startHour = minutesToHour(drop.minutes);
    const endHour = minutesToHour(drop.minutes + duration);
    if (endHour > AGENDA_END_HOUR) return;

    const sameCourt = (slot.court_id || slot.court_label) === court.id;
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
        Creá canchas para usar la agenda visual.
      </div>
    );
  }

  return (
    <div className={cn('overflow-auto rounded-xl border bg-card', moving && 'pointer-events-none opacity-70')}>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          className="grid min-w-[720px]"
          style={{ gridTemplateColumns: `72px repeat(${courtColumns.length}, minmax(150px, 1fr))` }}
        >
          <div className="sticky top-0 z-30 border-b bg-muted/90 px-2 py-2 text-xs font-medium">
            Hora
          </div>
          {courtColumns.map((court) => (
            <div
              key={`head-${court.id}`}
              className="sticky top-0 z-30 border-b border-l bg-muted/90 px-2 py-2 text-sm font-semibold"
            >
              {court.name}
            </div>
          ))}

          <div className="border-r">
            {rows.map((minutes) => (
              <div
                key={`label-${minutes}`}
                className="flex h-10 items-start justify-end border-b px-2 pt-1 text-[11px] text-muted-foreground"
              >
                {formatHourLabel(minutes / 60)}
              </div>
            ))}
          </div>

          {courtColumns.map((court) => {
            const courtSlots = daySlots.filter(
              (s) => (s.court_id || s.court_label) === court.id,
            );
            return (
              <div key={`col-${court.id}`} className="relative border-l" style={{ height: boardHeight }}>
                {rows.map((minutes) => (
                  <DropCell key={`${court.id}-${minutes}`} id={`${court.id}__${minutes}`} />
                ))}
                {courtSlots.map((slot) => {
                  const start = hourToMinutes(slot.start_hour);
                  const end = hourToMinutes(slot.end_hour);
                  const topPx = ((start - AGENDA_START_HOUR * 60) / AGENDA_STEP_MINUTES) * ROW_H;
                  const heightPx = ((end - start) / AGENDA_STEP_MINUTES) * ROW_H;
                  return (
                    <DraggableSlot
                      key={slot.id}
                      slot={slot}
                      topPx={topPx}
                      heightPx={heightPx}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeSlot ? (
            <div className={cn('rounded-md border px-2 py-1 text-xs shadow-lg', statusStyles(activeSlot.status))}>
              {formatHourLabel(hourToMinutes(activeSlot.start_hour) / 60)} · {activeSlot.court_label}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
