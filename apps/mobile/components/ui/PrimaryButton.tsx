import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Text,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from './PressableScale';
import { ui } from '@/theme/tokens';

type Variant = 'primary' | 'accent' | 'dark' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const sizeStyles = {
  sm: { py: 10, px: 14, fontSize: 13, radius: ui.radius.sm },
  md: { py: 14, px: 20, fontSize: 15, radius: ui.radius.md },
  lg: { py: 16, px: 24, fontSize: 16, radius: ui.radius.lg },
};

function buttonColors(variant: Variant) {
  switch (variant) {
    case 'accent':
      return {
        text: ui.colors.onPrimary,
        border: undefined,
        gradient: [ui.colors.accent, ui.colors.accentDark] as [string, string],
        bg: ui.colors.accent,
      };
    case 'dark':
      return { text: ui.colors.textPrimary, border: ui.colors.borderStrong, gradient: null, bg: ui.colors.surface3 };
    case 'outline':
      return { text: ui.colors.primary, border: ui.colors.primary, gradient: null, bg: 'transparent' };
    case 'ghost':
      return { text: ui.colors.textSecondary, border: undefined, gradient: null, bg: 'transparent' };
    default:
      return {
        text: ui.colors.onPrimary,
        border: undefined,
        gradient: [ui.colors.primary, ui.colors.primaryDark] as [string, string],
        bg: ui.colors.primary,
      };
  }
}

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
}: PrimaryButtonProps) {
  const colors = buttonColors(variant);
  const s = sizeStyles[size];
  const dimmed = disabled || loading;

  const inner = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: s.py,
        paddingHorizontal: s.px,
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} style={{ marginRight: 8 }} />
      ) : icon ? (
        <View style={{ marginRight: 8 }}>{icon}</View>
      ) : null}
      <Text style={{ color: colors.text, fontFamily: ui.typography.label.fontFamily, fontSize: s.fontSize }}>
        {label}
      </Text>
    </View>
  );

  const shell: ViewStyle = {
    borderRadius: s.radius,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    borderWidth: colors.border ? 1.5 : 0,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.gradient ? undefined : colors.bg,
  };

  return (
    <PressableScale
      onPress={onPress}
      disabled={dimmed}
      style={[shell, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: dimmed, busy: loading }}
    >
      {colors.gradient ? (
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </PressableScale>
  );
}
