import type { Metadata } from 'next';
import { AppProviders } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'x4 match Ops',
  description: 'Backoffice interno x4 match',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
