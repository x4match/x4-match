/** Altura aproximada del contenido interno de la FloatingTabBar (sin safe area). */
export const TAB_BAR_CONTENT_HEIGHT = 72;

/**
 * Espacio desde el borde inferior de la pantalla hasta arriba de la tab bar.
 * La barra flota en `bottom: max(insets.bottom, 12)`.
 */
export function getFloatingTabOffset(insetsBottom: number): number {
  return Math.max(insetsBottom, 12);
}

/** Padding inferior para que el último control quede por encima de la tab bar. */
export function getTabScreenPaddingBottom(insetsBottom = 0, extra = 24): number {
  return getFloatingTabOffset(insetsBottom) + TAB_BAR_CONTENT_HEIGHT + extra;
}

/** @deprecated Prefer getTabScreenPaddingBottom(insets.bottom) para respetar safe area. */
export const TAB_BAR_HEIGHT = 88;

export const tabScreenPadding = {
  paddingHorizontal: 16,
  paddingBottom: TAB_BAR_HEIGHT + 24,
} as const;
