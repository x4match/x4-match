export type StoreFont =
  | 'jakarta'
  | 'inter'
  | 'outfit'
  | 'dm-sans'
  | 'space-grotesk'
  | 'playfair'
  | 'rubik';

export type StoreTheme = {
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  fontFamily?: StoreFont;
  heroStyle?: 'full-bleed' | 'split' | 'minimal' | 'banner-only';
  productGridCols?: 2 | 3 | 4;
  cardStyle?: 'soft' | 'bordered' | 'flat' | 'shadow';
  cornerRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  headerStyle?: 'solid' | 'transparent' | 'blur';
  colorMode?: 'light' | 'dark' | 'brand';
  showCategories?: boolean;
  showOffers?: boolean;
  showSearch?: boolean;
  showTagline?: boolean;
  ctaLabel?: string;
  heroOverlay?: number;
  faviconUrl?: string;
  heroHeadline?: string;
  footerText?: string;
};

export type ResolvedStoreTheme = Required<
  Pick<
    StoreTheme,
    | 'fontFamily'
    | 'heroStyle'
    | 'productGridCols'
    | 'cardStyle'
    | 'cornerRadius'
    | 'headerStyle'
    | 'colorMode'
    | 'showCategories'
    | 'showOffers'
    | 'showSearch'
    | 'showTagline'
    | 'ctaLabel'
    | 'heroOverlay'
  >
> &
  StoreTheme & {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    surfaceColor: string;
    textColor: string;
    mutedTextColor: string;
  };

export const DEFAULT_THEME: ResolvedStoreTheme = {
  primaryColor: '#03ac0e',
  secondaryColor: '#e8f5e9',
  accentColor: '#d7ff00',
  backgroundColor: '#f5f7f5',
  surfaceColor: '#ffffff',
  textColor: '#0b1220',
  mutedTextColor: '#64748b',
  fontFamily: 'jakarta',
  heroStyle: 'full-bleed',
  productGridCols: 4,
  cardStyle: 'soft',
  cornerRadius: 'lg',
  headerStyle: 'blur',
  colorMode: 'light',
  showCategories: true,
  showOffers: true,
  showSearch: true,
  showTagline: true,
  ctaLabel: 'Ver productos',
  heroOverlay: 0.48,
};

export const THEME_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  patch: Partial<StoreTheme> & { primaryColor?: string; bannerUrl?: string };
}> = [
  {
    id: 'marketplace',
    label: 'Marketplace',
    description: 'Verde commerce tipo Tokopedia',
    patch: {
      primaryColor: '#03ac0e',
      secondaryColor: '#e8f5e9',
      accentColor: '#d7ff00',
      backgroundColor: '#f5f7f5',
      surfaceColor: '#ffffff',
      textColor: '#0b1220',
      mutedTextColor: '#64748b',
      colorMode: 'light',
      heroStyle: 'full-bleed',
      cardStyle: 'soft',
      fontFamily: 'jakarta',
      cornerRadius: 'lg',
    },
  },
  {
    id: 'night',
    label: 'Night Match',
    description: 'Oscuro con acento lima',
    patch: {
      primaryColor: '#d7ff00',
      secondaryColor: '#1c1c1c',
      accentColor: '#e8ff66',
      backgroundColor: '#0a0a0a',
      surfaceColor: '#161616',
      textColor: '#fafafa',
      mutedTextColor: '#a3a3a3',
      colorMode: 'dark',
      heroStyle: 'minimal',
      cardStyle: 'bordered',
      fontFamily: 'space-grotesk',
      cornerRadius: 'md',
    },
  },
  {
    id: 'sport',
    label: 'Sport Bold',
    description: 'Energía y tipografía fuerte',
    patch: {
      primaryColor: '#ef4444',
      secondaryColor: '#fee2e2',
      accentColor: '#fbbf24',
      backgroundColor: '#fafafa',
      surfaceColor: '#ffffff',
      textColor: '#111827',
      mutedTextColor: '#6b7280',
      colorMode: 'light',
      heroStyle: 'split',
      cardStyle: 'shadow',
      fontFamily: 'rubik',
      cornerRadius: 'xl',
      productGridCols: 3,
    },
  },
  {
    id: 'luxury',
    label: 'Luxury',
    description: 'Serif elegante y neutros',
    patch: {
      primaryColor: '#1c1917',
      secondaryColor: '#f5f5f4',
      accentColor: '#a8a29e',
      backgroundColor: '#fafaf9',
      surfaceColor: '#ffffff',
      textColor: '#1c1917',
      mutedTextColor: '#78716c',
      colorMode: 'light',
      heroStyle: 'banner-only',
      cardStyle: 'flat',
      fontFamily: 'playfair',
      cornerRadius: 'sm',
      productGridCols: 3,
    },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Azules frescos',
    patch: {
      primaryColor: '#0284c7',
      secondaryColor: '#e0f2fe',
      accentColor: '#38bdf8',
      backgroundColor: '#f0f9ff',
      surfaceColor: '#ffffff',
      textColor: '#0c4a6e',
      mutedTextColor: '#64748b',
      colorMode: 'light',
      heroStyle: 'full-bleed',
      cardStyle: 'soft',
      fontFamily: 'outfit',
      cornerRadius: 'lg',
    },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Limpio, casi sin color',
    patch: {
      primaryColor: '#18181b',
      secondaryColor: '#f4f4f5',
      accentColor: '#a1a1aa',
      backgroundColor: '#ffffff',
      surfaceColor: '#ffffff',
      textColor: '#09090b',
      mutedTextColor: '#71717a',
      colorMode: 'light',
      heroStyle: 'minimal',
      cardStyle: 'flat',
      fontFamily: 'dm-sans',
      cornerRadius: 'none',
      headerStyle: 'solid',
      productGridCols: 4,
    },
  },
];

export const FONT_OPTIONS: Array<{ id: StoreFont; label: string; css: string; google?: string }> = [
  { id: 'jakarta', label: 'Plus Jakarta Sans', css: 'var(--font-plus-jakarta), ui-sans-serif, system-ui, sans-serif' },
  {
    id: 'inter',
    label: 'Inter',
    css: '"Inter", ui-sans-serif, system-ui, sans-serif',
    google: 'Inter:wght@400;600;700;800',
  },
  {
    id: 'outfit',
    label: 'Outfit',
    css: '"Outfit", ui-sans-serif, system-ui, sans-serif',
    google: 'Outfit:wght@400;600;700;800',
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    css: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    google: 'DM+Sans:wght@400;600;700',
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    css: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    google: 'Space+Grotesk:wght@400;600;700',
  },
  {
    id: 'playfair',
    label: 'Playfair Display',
    css: '"Playfair Display", ui-serif, Georgia, serif',
    google: 'Playfair+Display:wght@500;700;800',
  },
  {
    id: 'rubik',
    label: 'Rubik',
    css: '"Rubik", ui-sans-serif, system-ui, sans-serif',
    google: 'Rubik:wght@400;600;700;800',
  },
];

const RADIUS_MAP = {
  none: '0px',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
} as const;

export function resolveStoreTheme(sponsor: {
  primary_color?: string | null;
  primaryColor?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  favicon_url?: string | null;
  store_theme?: StoreTheme | string | null;
  storeTheme?: StoreTheme | null;
}): ResolvedStoreTheme {
  let raw = sponsor.store_theme ?? sponsor.storeTheme ?? {};
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as StoreTheme;
    } catch {
      raw = {};
    }
  }
  const t = raw as StoreTheme;
  const primary =
    sponsor.primary_color || sponsor.primaryColor || DEFAULT_THEME.primaryColor;

  return {
    ...DEFAULT_THEME,
    ...t,
    primaryColor: primary,
    secondaryColor:
      sponsor.secondary_color || t.secondaryColor || DEFAULT_THEME.secondaryColor,
    accentColor: sponsor.accent_color || t.accentColor || DEFAULT_THEME.accentColor,
    backgroundColor: t.backgroundColor || DEFAULT_THEME.backgroundColor,
    surfaceColor: t.surfaceColor || DEFAULT_THEME.surfaceColor,
    textColor: t.textColor || DEFAULT_THEME.textColor,
    mutedTextColor: t.mutedTextColor || DEFAULT_THEME.mutedTextColor,
    faviconUrl: t.faviconUrl || sponsor.favicon_url || undefined,
    showCategories: t.showCategories ?? DEFAULT_THEME.showCategories,
    showOffers: t.showOffers ?? DEFAULT_THEME.showOffers,
    showSearch: t.showSearch ?? DEFAULT_THEME.showSearch,
    showTagline: t.showTagline ?? DEFAULT_THEME.showTagline,
    ctaLabel: t.ctaLabel || DEFAULT_THEME.ctaLabel,
    heroOverlay: t.heroOverlay ?? DEFAULT_THEME.heroOverlay,
    productGridCols: (t.productGridCols as 2 | 3 | 4) || DEFAULT_THEME.productGridCols,
    fontFamily: (t.fontFamily as StoreFont) || DEFAULT_THEME.fontFamily,
    heroStyle: t.heroStyle || DEFAULT_THEME.heroStyle,
    cardStyle: t.cardStyle || DEFAULT_THEME.cardStyle,
    cornerRadius: t.cornerRadius || DEFAULT_THEME.cornerRadius,
    headerStyle: t.headerStyle || DEFAULT_THEME.headerStyle,
    colorMode: t.colorMode || DEFAULT_THEME.colorMode,
  };
}

export function themeToCssVars(theme: ResolvedStoreTheme): Record<string, string> {
  const font = FONT_OPTIONS.find((f) => f.id === theme.fontFamily)?.css || FONT_OPTIONS[0].css;
  const radius = RADIUS_MAP[theme.cornerRadius] || RADIUS_MAP.lg;
  return {
    '--background': theme.backgroundColor,
    '--foreground': theme.textColor,
    '--card': theme.surfaceColor,
    '--card-foreground': theme.textColor,
    '--popover': theme.surfaceColor,
    '--popover-foreground': theme.textColor,
    '--primary': theme.primaryColor,
    '--primary-foreground': theme.colorMode === 'dark' ? '#0a0a0a' : '#ffffff',
    '--secondary': theme.secondaryColor,
    '--secondary-foreground': theme.textColor,
    '--muted': theme.secondaryColor,
    '--muted-foreground': theme.mutedTextColor,
    '--accent': theme.accentColor,
    '--accent-foreground': theme.textColor,
    '--border':
      theme.colorMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
    '--ring': theme.primaryColor,
    '--commerce': theme.primaryColor,
    '--radius': radius,
    '--sf-font': font,
    '--sf-hero-overlay': String(theme.heroOverlay),
  };
}

export function googleFontHref(fontFamily: StoreFont): string | null {
  const opt = FONT_OPTIONS.find((f) => f.id === fontFamily);
  if (!opt?.google) return null;
  return `https://fonts.googleapis.com/css2?family=${opt.google}&display=swap`;
}

export function productGridClass(cols: 2 | 3 | 4): string {
  if (cols === 2) return 'grid grid-cols-2 gap-4';
  if (cols === 3) return 'grid grid-cols-2 gap-4 md:grid-cols-3';
  return 'grid grid-cols-2 gap-4 md:grid-cols-4';
}

export function cardStyleClass(style: ResolvedStoreTheme['cardStyle']): string {
  switch (style) {
    case 'bordered':
      return 'overflow-hidden rounded-[var(--radius)] border-2 border-border bg-card';
    case 'flat':
      return 'overflow-hidden rounded-[var(--radius)] bg-card';
    case 'shadow':
      return 'overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-md';
    default:
      return 'sf-product-card rounded-[var(--radius)]';
  }
}
