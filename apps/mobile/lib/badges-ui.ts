import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';

export const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  matches: { bg: 'rgba(20,184,166,0.15)', color: ui.colors.primary },
  streak: { bg: 'rgba(245,158,11,0.15)', color: ui.colors.accent },
  skill: { bg: 'rgba(99,102,241,0.15)', color: '#818CF8' },
  competitive: { bg: 'rgba(239,68,68,0.12)', color: '#F87171' },
  club: { bg: 'rgba(14,165,233,0.12)', color: '#38BDF8' },
  fun: { bg: 'rgba(168,85,247,0.12)', color: '#C084FC' },
  general: { bg: 'rgba(148,163,184,0.15)', color: ui.colors.textSecondary },
};

export function badgePalette(category?: string) {
  return BADGE_COLORS[category ?? 'general'] ?? BADGE_COLORS.general;
}

export function isIoniconName(icon?: string): icon is keyof typeof Ionicons.glyphMap {
  return !!icon && icon in Ionicons.glyphMap;
}

export function resolveBadgeIcon(icon?: string): keyof typeof Ionicons.glyphMap {
  return isIoniconName(icon) ? icon : 'ribbon';
}
