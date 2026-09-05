'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';

export function AppHeader() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <SiteHeader />;
}
