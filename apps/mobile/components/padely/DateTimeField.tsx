import { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ui } from '@/theme/tokens';

type DateTimeFieldProps = {
  label?: string;
  mode: 'date' | 'time';
  value?: Date | null;
  onChange: (value: Date) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
};

function formatValue(value: Date, mode: 'date' | 'time'): string {
  if (mode === 'time') {
    return value.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  return value.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function DateTimeField({
  label,
  mode,
  value,
  onChange,
  placeholder,
  minimumDate,
  maximumDate,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed') return;
    if (selected) onChange(selected);
  };

  return (
    <View style={{ marginBottom: ui.spacing.md, width: '100%' }}>
      {label ? (
        <Text style={[ui.typography.label, { color: ui.colors.textSecondary, marginBottom: 6 }]}>
          {label}
        </Text>
      ) : null}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOpen((prev) => !prev)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: ui.colors.surface1,
          borderWidth: 1.5,
          borderColor: open ? ui.colors.primary : ui.colors.border,
          borderRadius: ui.radius.md,
        }}
      >
        <Text style={{ fontSize: 15, color: value ? ui.colors.textPrimary : ui.colors.textMuted }}>
          {value ? formatValue(value, mode) : placeholder || (mode === 'time' ? 'Seleccionar hora' : 'Seleccionar fecha')}
        </Text>
        <Ionicons
          name={mode === 'time' ? 'time-outline' : 'calendar-outline'}
          size={20}
          color={ui.colors.textMuted}
        />
      </TouchableOpacity>
      {open ? (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}
