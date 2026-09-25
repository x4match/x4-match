'use client';

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import {
  googleFontHref,
  resolveStoreTheme,
  themeToCssVars,
  type ResolvedStoreTheme,
} from '@/lib/store-theme';
import type { StorefrontSponsor } from '@/lib/types';

export function useResolvedTheme(sponsor?: StorefrontSponsor | null): ResolvedStoreTheme {
  return resolveStoreTheme(sponsor || {});
}

export function StoreThemeScope({
  sponsor,
  children,
  className,
}: {
  sponsor?: StorefrontSponsor | null;
  children: ReactNode;
  className?: string;
}) {
  const theme = resolveStoreTheme(sponsor || {});
  const vars = themeToCssVars(theme) as CSSProperties;
  const fontHref = googleFontHref(theme.fontFamily);

  useEffect(() => {
    if (!fontHref) return;
    const id = `sf-font-${theme.fontFamily}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = fontHref;
    document.head.appendChild(link);
  }, [fontHref, theme.fontFamily]);

  useEffect(() => {
    const href = theme.faviconUrl;
    if (!href) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon'][data-sf='1']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.dataset.sf = '1';
      document.head.appendChild(link);
    }
    link.href = href;
  }, [theme.faviconUrl]);

  return (
    <div
      className={className}
      data-sf-theme={theme.colorMode}
      data-sf-hero={theme.heroStyle}
      data-sf-header={theme.headerStyle}
      style={{
        ...vars,
        fontFamily: 'var(--sf-font)',
        background: 'var(--background)',
        color: 'var(--foreground)',
        minHeight: '100%',
      }}
    >
      {children}
    </div>
  );
}
