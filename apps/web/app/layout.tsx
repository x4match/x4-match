import type { Metadata } from 'next';
import { Anton, DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import { AppHeader } from '@/components/AppHeader';
import { CookieBanner } from '@/components/CookieBanner';
import { SiteFooter } from '@/components/SiteFooter';
import { SITE } from '@/content/site';
import './globals.css';

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  metadataBase: new URL(SITE.url),
  openGraph: {
    title: SITE.name,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
    locale: 'es_AR',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning className={`${anton.variable} ${dmSans.variable} ${ibmPlexMono.variable}`}>
      <body suppressHydrationWarning>
        <AppHeader />
        <main>{children}</main>
        <SiteFooter />
        <CookieBanner />
      </body>
    </html>
  );
}
