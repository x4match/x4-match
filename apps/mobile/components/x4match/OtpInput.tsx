import { useRef, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { ui } from '@/theme/tokens';

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  label?: string;
  error?: string;
  autoFocus?: boolean;
  editable?: boolean;
};

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  label,
  error,
  autoFocus,
  editable = true,
}: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);

  const handleChangeText = (text: string) => {
    let next: string;
    if (text.length - value.length > 1) {
      // Pegado o autocompletado: priorizar el código completo dentro del texto insertado.
      const inserted = text.startsWith(value) ? text.slice(value.length) : text;
      const fullCode = inserted.match(new RegExp(`\\d{${length}}`));
      next = fullCode ? fullCode[0] : (value + inserted.replace(/\D/g, '')).slice(0, length);
    } else {
      next = text.replace(/\D/g, '').slice(0, length);
    }
    onChange(next);
    if (next.length === length && next !== value) {
      inputRef.current?.blur();
      onComplete?.(next);
    }
  };

  return (
    <View style={{ marginBottom: ui.spacing.md, width: '100%' }}>
      {label ? (
        <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textSecondary, marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <View style={{ position: 'relative' }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {Array.from({ length }, (_, index) => {
            const digit = value[index] ?? '';
            const isActive = focused && index === activeIndex;
            return (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: 58,
                  borderRadius: ui.radius.md,
                  borderWidth: isActive ? 2 : 1,
                  borderColor: error
                    ? ui.colors.danger
                    : isActive
                      ? ui.colors.primary
                      : digit
                        ? ui.colors.borderStrong
                        : ui.colors.border,
                  backgroundColor: ui.colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {digit ? (
                  <Text style={[ui.typography.h2, { color: ui.colors.textPrimary }]}>{digit}</Text>
                ) : isActive ? (
                  <View style={{ width: 2, height: 24, borderRadius: 1, backgroundColor: ui.colors.primary }} />
                ) : null}
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          editable={editable}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          caretHidden
          selectionColor="transparent"
          accessibilityLabel={label ?? 'Código de verificación'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            color: 'transparent',
            backgroundColor: 'transparent',
            fontSize: 1,
          }}
        />
      </View>
      {error ? <Text style={{ marginTop: 6, fontSize: 13, color: ui.colors.danger }}>{error}</Text> : null}
    </View>
  );
}
