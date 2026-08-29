import { Platform, TextStyle, ViewStyle } from 'react-native';

export const fontFamily = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  extrabold: 'Geist_800ExtraBold',
} as const;

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

export type AppColors = {
  bg: string;
  bgElevated: string;
  surface0: string;
  surface1: string;
  surface2: string;
  surface3: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  cardMuted: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  /** Text/icon color on solid `primary` fills */
  onPrimary: string;
  primary: string;
  primarySoft: string;
  primaryDark: string;
  primaryGlow: string;
  accent: string;
  accentSoft: string;
  accentDark: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  border: string;
  borderStrong: string;
  overlay: string;
  glass: string;
};

/** Night Match — black minimal + yellow accents */
export const darkColors: AppColors = {
  bg: '#000000',
  bgElevated: '#0A0A0A',
  surface0: '#111111',
  surface1: '#161616',
  surface2: '#1C1C1C',
  surface3: '#242424',
  surface: '#161616',
  surfaceAlt: '#1C1C1C',
  card: '#161616',
  cardMuted: '#111111',
  textPrimary: '#FAFAFA',
  textSecondary: '#A3A3A3',
  textMuted: '#737373',
  textInverse: '#FAFAFA',
  onPrimary: '#0A0A0A',
  primary: '#F5C518',
  primarySoft: 'rgba(245,197,24,0.14)',
  primaryDark: '#D4A017',
  primaryGlow: 'rgba(245,197,24,0.35)',
  accent: '#FFE566',
  accentSoft: 'rgba(255,229,102,0.14)',
  accentDark: '#EAB308',
  success: '#22C55E',
  successSoft: 'rgba(34,197,94,0.14)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245,158,11,0.14)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.14)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  overlay: 'rgba(0,0,0,0.72)',
  glass: 'rgba(22,22,22,0.88)',
};

/** Bright Court — daylight companion */
export const lightColors: AppColors = {
  bg: '#F1F5F9',
  bgElevated: '#FFFFFF',
  surface0: '#E8EEF5',
  surface1: '#FFFFFF',
  surface2: '#F8FAFC',
  surface3: '#E2E8F0',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  card: '#FFFFFF',
  cardMuted: '#E8EEF5',
  textPrimary: '#0B1220',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textInverse: '#0B1220',
  onPrimary: '#FFFFFF',
  primary: '#0D9488',
  primarySoft: 'rgba(13,148,136,0.12)',
  primaryDark: '#0F766E',
  primaryGlow: 'rgba(13,148,136,0.22)',
  accent: '#84CC16',
  accentSoft: 'rgba(132,204,22,0.16)',
  accentDark: '#65A30D',
  success: '#16A34A',
  successSoft: 'rgba(22,163,74,0.12)',
  warning: '#D97706',
  warningSoft: 'rgba(217,119,6,0.14)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220,38,38,0.12)',
  border: 'rgba(15,23,42,0.08)',
  borderStrong: 'rgba(15,23,42,0.14)',
  overlay: 'rgba(15,23,42,0.48)',
  glass: 'rgba(255,255,255,0.86)',
};

export const palettes = {
  dark: darkColors,
  light: lightColors,
} as const;

type ThemeRuntime = {
  mode: ThemeMode;
  colors: AppColors;
};

const themeRuntime: ThemeRuntime = {
  mode: 'dark',
  colors: darkColors,
};

/** Sync palette used by `ui.colors` getters. ThemeProvider keeps React in sync. */
export function setResolvedThemeMode(mode: ThemeMode) {
  themeRuntime.mode = mode;
  themeRuntime.colors = palettes[mode];
}

export function getResolvedThemeMode(): ThemeMode {
  return themeRuntime.mode;
}

export function resolvePalette(mode: ThemeMode): AppColors {
  return palettes[mode];
}

const typography = {
  display: { fontSize: 32, lineHeight: 38, fontFamily: fontFamily.extrabold, letterSpacing: -0.8 } as TextStyle,
  h1: { fontSize: 28, lineHeight: 34, fontFamily: fontFamily.bold, letterSpacing: -0.6 } as TextStyle,
  h2: { fontSize: 22, lineHeight: 28, fontFamily: fontFamily.bold, letterSpacing: -0.4 } as TextStyle,
  h3: { fontSize: 18, lineHeight: 24, fontFamily: fontFamily.semibold, letterSpacing: -0.2 } as TextStyle,
  body: { fontSize: 15, lineHeight: 22, fontFamily: fontFamily.regular } as TextStyle,
  bodySm: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular } as TextStyle,
  caption: { fontSize: 11, lineHeight: 14, fontFamily: fontFamily.medium, letterSpacing: 0.2 } as TextStyle,
  label: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.semibold, letterSpacing: 0.4 } as TextStyle,
  stat: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: fontFamily.extrabold,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
};

const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const motion = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: { damping: 18, stiffness: 220, mass: 0.8 },
  pressScale: 0.97,
};

function shadowFor(mode: ThemeMode) {
  if (mode === 'light') {
    return {
      card: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      },
      glow: {
        shadowColor: '#0D9488',
        shadowOpacity: 0.22,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
        elevation: 4,
      },
    };
  }
  return {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    glow: {
      shadowColor: '#F5C518',
      shadowOpacity: 0.35,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 0 },
      elevation: 8,
    },
  };
}

/**
 * Design tokens. `colors` and `shadow` track the resolved theme via ThemeProvider.
 * Prefer `useTheme().colors` in new code when you need reactive theme in leaf trees.
 */
export const ui = {
  get colors(): AppColors {
    return themeRuntime.colors;
  },
  get shadow() {
    return shadowFor(themeRuntime.mode);
  },
  typography,
  radius,
  spacing,
  motion,
} as const;

export function surfaceStyle(level: 0 | 1 | 2 | 3 = 1, extra?: ViewStyle): ViewStyle {
  const map = {
    0: ui.colors.surface0,
    1: ui.colors.surface1,
    2: ui.colors.surface2,
    3: ui.colors.surface3,
  };
  return {
    backgroundColor: map[level],
    borderWidth: 1,
    borderColor: ui.colors.border,
    borderRadius: ui.radius.lg,
    ...extra,
  };
}

export const text = {
  get primary(): TextStyle {
    return { color: ui.colors.textPrimary, fontFamily: fontFamily.regular };
  },
  get secondary(): TextStyle {
    return { color: ui.colors.textSecondary, fontFamily: fontFamily.regular };
  },
  get muted(): TextStyle {
    return { color: ui.colors.textMuted, fontFamily: fontFamily.regular };
  },
  get inverse(): TextStyle {
    return { color: ui.colors.textInverse, fontFamily: fontFamily.regular };
  },
  get accent(): TextStyle {
    return { color: ui.colors.accent, fontFamily: fontFamily.semibold };
  },
  get brand(): TextStyle {
    return { color: ui.colors.primary, fontFamily: ui.typography.label.fontFamily };
  },
};

export function hapticStyle() {
  return Platform.OS === 'ios' ? 'light' : 'soft';
}
