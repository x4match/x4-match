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
  const isPassword = secureTextEntry;

  return (
    <View style={{ marginBottom: ui.spacing.md, width: '100%' }}>
      {label ? (
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: ui.colors.textSecondary,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View style={{ position: 'relative' }}>
        {leftIcon ? (
          <View style={{ position: 'absolute', left: 12, top: 14, zIndex: 1 }}>{leftIcon}</View>
        ) : null}
        <TextInput
          placeholderTextColor={ui.colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          style={[
            {
              width: '100%',
              paddingHorizontal: 16,
              paddingVertical: 14,
              paddingLeft: leftIcon ? 44 : 16,
              paddingRight: isPassword || rightIcon ? 44 : 16,
              backgroundColor: ui.colors.card,
              borderWidth: 1,
              borderColor: error ? ui.colors.danger : ui.colors.border,
              borderRadius: ui.radius.md,
              fontSize: 15,
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
        <Text style={{ marginTop: 6, fontSize: 13, color: ui.colors.danger }}>{error}</Text>
      ) : hint ? (
        <Text style={{ marginTop: 6, fontSize: 13, color: ui.colors.textMuted }}>{hint}</Text>
      ) : null}
    </View>
  );
}
