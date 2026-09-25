'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchSponsorBySlug } from '@/lib/storefront-api';
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader';
import { StoreThemeScope, useResolvedTheme } from '@/components/storefront/StoreThemeScope';
import { Skeleton } from '@/components/ui/skeleton';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const storeQuery = useQuery({
    queryKey: ['store', slug],
    queryFn: () => fetchSponsorBySlug(slug),
    enabled: !!slug,
  });

  const sponsor = storeQuery.data;
  const theme = useResolvedTheme(sponsor);

  return (
    <StoreThemeScope sponsor={sponsor} className="min-h-screen">
      {storeQuery.isLoading && !sponsor ? (
        <div className="border-b px-4 py-3">
          <Skeleton className="h-10 w-48" />
        </div>
      ) : (
        <StorefrontHeader sponsor={sponsor} theme={theme} />
      )}
      {children}
      <footer className="mt-16 border-t border-border bg-card py-10 text-center text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">{sponsor?.name || slug}</p>
        <p className="mt-1">{theme.footerText || 'Powered by x4 match'}</p>
      </footer>
    </StoreThemeScope>
  );
}
