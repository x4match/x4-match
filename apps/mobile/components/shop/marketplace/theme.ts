import type { ViewStyle } from 'react-native';

export const SHOP_LIME = '#D7FF00';
export const SHOP_CARD_BG = '#17171C';
export const SHOP_MUTED = '#8E8E9F';
export const SHOP_IMAGE_BG = '#0B0B0F';

export const SHOP_GLASS: ViewStyle = {
  backgroundColor: 'rgba(255,255,255,0.06)',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
};

/** Color de marca del partner si es un hex válido; si no, lima de la app. */
export function partnerAccent(color?: string | null): string {
  return color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color.trim()) ? color.trim() : SHOP_LIME;
}

export function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
