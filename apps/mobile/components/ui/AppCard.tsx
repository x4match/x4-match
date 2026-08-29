import { ReactNode } from 'react';
import { View, Text, ViewStyle, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from './PressableScale';
import { ui } from '@/theme/tokens';

type AppCardProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'elevated' | 'gradient' | 'ghost';
  glow?: boolean;
};

const paddingMap = { sm: ui.spacing.md, md: ui.spacing.lg, lg: ui.spacing.xl };

function CardSurface({
  children,
  padding,
  variant,
  glow,
  style,
}: {
  children: ReactNode;
  padding: 'sm' | 'md' | 'lg';
  variant: AppCardProps['variant'];
  glow?: boolean;
  style?: ViewStyle;
}) {
  const baseStyle: ViewStyle = {
    borderRadius: ui.radius.lg,
    padding: paddingMap[padding],
    borderWidth: 1,
    borderColor: ui.colors.border,
    overflow: 'hidden',
    ...(variant === 'elevated' ? ui.shadow.card : {}),
    ...(glow ? ui.shadow.glow : {}),
  };

  if (variant === 'gradient') {
    return (
      <LinearGradient
        colors={['rgba(20,184,166,0.22)', 'rgba(163,230,53,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[baseStyle, { backgroundColor: ui.colors.surface1 }, style]}
      >
        {children}
      </LinearGradient>
    );
  }

  const bg =
    variant === 'ghost'
      ? 'transparent'
      : variant === 'elevated'
        ? ui.colors.surface2
        : ui.colors.surface1;

  return <View style={[baseStyle, { backgroundColor: bg }, style]}>{children}</View>;
}

export function AppCard({
  children,
  onPress,
  style,
  padding = 'md',
  variant = 'default',
  glow,
}: AppCardProps) {
  const { wrapperStyle, surfaceStyle } = splitCardStyles(style);
  const outerStyle = [{ marginBottom: ui.spacing.sm }, wrapperStyle];

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={outerStyle}>
        <CardSurface padding={padding} variant={variant} glow={glow} style={surfaceStyle}>
          {children}
        </CardSurface>
      </PressableScale>
    );
  }

  return (
    <View style={outerStyle}>
      <CardSurface padding={padding} variant={variant} glow={glow} style={surfaceStyle}>
        {children}
      </CardSurface>
    </View>
  );
}

function splitCardStyles(style?: ViewStyle) {
  const flat = StyleSheet.flatten(style) ?? {};
  const wrapperKeys = [
    'width',
    'flex',
    'flexGrow',
    'flexShrink',
    'alignSelf',
    'margin',
    'marginTop',
    'marginBottom',
    'marginLeft',
    'marginRight',
    'marginHorizontal',
    'marginVertical',
  ] as const;
  const wrapperStyle: ViewStyle = {};
  const surfaceStyle: ViewStyle = {};

  for (const [key, value] of Object.entries(flat)) {
    if (value == null) continue;
    if (wrapperKeys.includes(key as (typeof wrapperKeys)[number])) {
      (wrapperStyle as Record<string, unknown>)[key] = value;
    } else {
      (surfaceStyle as Record<string, unknown>)[key] = value;
    }
  }

  return { wrapperStyle, surfaceStyle };
}

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  dark?: boolean;
  style?: ViewStyle;
};

export function SectionHeader({ title, subtitle, action, style }: SectionHeaderProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: ui.spacing.md,
        },
        style,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[ui.typography.h2, { color: ui.colors.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[ui.typography.bodySm, { color: ui.colors.textSecondary, marginTop: 2 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
