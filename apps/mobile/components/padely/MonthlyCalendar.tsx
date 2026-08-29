import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { startOfDay } from '@/lib/format';
import { ui } from '@/theme/tokens';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

type MonthlyCalendarProps = {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  /** Defaults to today. Pass `null` to allow selecting any past date. */
  minDate?: Date | null;
  /** Dates (or YYYY-MM-DD keys) that should show a highlight marker. */
  markedDates?: Array<string | Date>;
};

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthTitle(date: Date): string {
  const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function MonthlyCalendar({ label, value, onChange, minDate, markedDates }: MonthlyCalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const min = useMemo(() => {
    if (minDate === null) return null;
    return startOfDay(minDate ?? today);
  }, [minDate, today]);

  const markedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of markedDates ?? []) {
      if (typeof entry === 'string') {
        keys.add(entry.slice(0, 10));
      } else {
        keys.add(toDayKey(entry));
      }
    }
    return keys;
  }, [markedDates]);

  const [viewMonth, setViewMonth] = useState(() => {
    const base = value ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const canGoPrev =
    min == null ||
    viewMonth.getFullYear() > min.getFullYear() ||
    (viewMonth.getFullYear() === min.getFullYear() && viewMonth.getMonth() > min.getMonth());

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const startPad = (first.getDay() + 6) % 7;
    const items: ({ date: Date; inMonth: boolean } | null)[] = [];

    for (let i = 0; i < startPad; i++) items.push(null);
    for (let day = 1; day <= lastDay; day++) {
      items.push({ date: new Date(year, month, day), inMonth: true });
    }
    while (items.length % 7 !== 0) items.push(null);
    return items;
  }, [viewMonth]);

  const shiftMonth = (delta: number) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <View style={{ marginBottom: ui.spacing.md }}>
      {label ? (
        <Text
          style={{
            fontSize: 17,
            fontWeight: '700',
            color: ui.colors.textInverse,
            marginBottom: 12,
          }}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={{
          backgroundColor: ui.colors.card,
          borderRadius: ui.radius.md,
          padding: ui.spacing.md,
          ...ui.shadow.card,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <TouchableOpacity
            onPress={() => canGoPrev && shiftMonth(-1)}
            disabled={!canGoPrev}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ opacity: canGoPrev ? 1 : 0.35 }}
          >
            <Ionicons name="chevron-back" size={22} color={ui.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '700', color: ui.colors.textPrimary }}>{monthTitle(viewMonth)}</Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={22} color={ui.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          {WEEKDAY_LABELS.map((wd) => (
            <View key={wd} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: ui.colors.textMuted }}>{wd}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((cell, index) => {
            if (!cell) {
              return <View key={`empty-${index}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
            }

            const dayStart = startOfDay(cell.date);
            const disabled = min != null && dayStart.getTime() < min.getTime();
            const selected = value ? isSameDay(dayStart, value) : false;
            const isToday = isSameDay(dayStart, today);
            const marked = markedKeys.has(toDayKey(dayStart));

            return (
              <TouchableOpacity
                key={cell.date.toISOString()}
                disabled={disabled}
                onPress={() => onChange(dayStart)}
                style={{
                  width: `${100 / 7}%`,
                  aspectRatio: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: disabled ? 0.35 : 1,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected
                      ? ui.colors.primary
                      : marked
                        ? ui.colors.warningSoft
                        : 'transparent',
                    borderWidth: isToday && !selected ? 2 : marked && !selected ? 1 : 0,
                    borderColor: selected ? ui.colors.primary : marked ? ui.colors.warning : ui.colors.primary,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: selected || isToday || marked ? '700' : '500',
                      color: selected ? ui.colors.onPrimary : marked ? ui.colors.warning : ui.colors.textPrimary,
                    }}
                  >
                    {cell.date.getDate()}
                  </Text>
                  {marked && !selected ? (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: ui.colors.warning,
                      }}
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}
