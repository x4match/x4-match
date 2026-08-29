import { useState, ReactNode } from 'react';
import { View, Text, TextInput, TouchableOpacity, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';

type InputFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export function InputField({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  secureTextEntry,
  style,
  ...props
}: InputFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View style={{ marginBottom: ui.spacing.md, width: '100%' }}>
      {label ? (
        <Text style={[ui.typography.label, { color: ui.colors.textSecondary, marginBottom: 6 }]}>
          {label}
        </Text>
      ) : null}
      <View style={{ position: 'relative' }}>
        {leftIcon ? (
          <View style={{ position: 'absolute', left: 14, top: 15, zIndex: 1 }}>{leftIcon}</View>
        ) : null}
        <TextInput
          placeholderTextColor={ui.colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            {
              width: '100%',
              paddingHorizontal: 16,
              paddingVertical: 14,
              paddingLeft: leftIcon ? 44 : 16,
              paddingRight: isPassword || rightIcon ? 44 : 16,
              backgroundColor: ui.colors.surface1,
              borderWidth: 1.5,
              borderColor: error ? ui.colors.danger : focused ? ui.colors.primary : ui.colors.border,
              borderRadius: ui.radius.md,
              fontSize: 15,
              fontFamily: ui.typography.body.fontFamily,
              color: ui.colors.textPrimary,
            },
            style,
          ]}
          {...props}
        />
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: 12, top: 14 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={ui.colors.textMuted}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <View style={{ position: 'absolute', right: 12, top: 14 }}>{rightIcon}</View>
        ) : null}
      </View>
      {error ? (
        <Text style={{ marginTop: 6, fontSize: 13, color: ui.colors.danger, fontFamily: ui.typography.bodySm.fontFamily }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ marginTop: 6, fontSize: 13, color: ui.colors.textMuted, fontFamily: ui.typography.bodySm.fontFamily }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
