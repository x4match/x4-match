'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import { api } from '@/lib/api';
import { SPONSOR_COOKIE } from '@/lib/auth-cookies';
import type { MineSponsor } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { isPartner } from '@/lib/roles';

export function resolveActiveSponsorId(
  selectedSponsorId: string | null,
  sponsors?: MineSponsor[] | null,
): string | null {
  if (selectedSponsorId && sponsors?.some((s) => s.id === selectedSponsorId)) {
    return selectedSponsorId;
  }
  return sponsors?.[0]?.id || null;
}

type SponsorContextType = {
  sponsors: MineSponsor[];
  sponsorsLoading: boolean;
  selectedSponsorId: string | null;
  activeSponsorId: string | null;
  activeSponsor: MineSponsor | null;
  setSelectedSponsorId: (id: string) => void;
  refetchSponsors: () => void;
};

const SponsorContext = createContext<SponsorContextType | undefined>(undefined);

export function SponsorProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const canManage = isPartner(user?.role) && !!token;
  const [selectedSponsorId, setSelectedSponsorIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = Cookies.get(SPONSOR_COOKIE) || null;
    if (stored) setSelectedSponsorIdState(stored);
  }, []);

  const sponsorsQuery = useQuery({
    queryKey: ['sponsors-me'],
    queryFn: async () => {
      const res = await api.get('/sponsors/me');
      const data = res.data;
      const list = (Array.isArray(data) ? data : data?.sponsors ?? data?.items ?? []) as MineSponsor[];
      return list.filter((s) => typeof s?.id === 'string' && s.id.length > 0);
    },
    enabled: canManage,
    retry: 2,
  });

  const sponsors = sponsorsQuery.data ?? [];
  const activeSponsorId = resolveActiveSponsorId(selectedSponsorId, sponsors);
  const activeSponsor = sponsors.find((s) => s.id === activeSponsorId) || null;

  const setSelectedSponsorId = useCallback((id: string) => {
    Cookies.set(SPONSOR_COOKIE, id, { expires: 30, sameSite: 'lax' });
    setSelectedSponsorIdState(id);
  }, []);

  useEffect(() => {
    if (!selectedSponsorId && sponsors[0]?.id) {
      setSelectedSponsorId(sponsors[0].id);
    }
  }, [sponsors, selectedSponsorId, setSelectedSponsorId]);

  const value = useMemo(
    () => ({
      sponsors,
      sponsorsLoading: sponsorsQuery.isLoading,
      selectedSponsorId,
      activeSponsorId,
      activeSponsor,
      setSelectedSponsorId,
      refetchSponsors: () => {
        void sponsorsQuery.refetch();
      },
    }),
    [
      sponsors,
      sponsorsQuery,
      selectedSponsorId,
      activeSponsorId,
      activeSponsor,
      setSelectedSponsorId,
    ],
  );

  return <SponsorContext.Provider value={value}>{children}</SponsorContext.Provider>;
}

export function useSponsor() {
  const ctx = useContext(SponsorContext);
  if (!ctx) throw new Error('useSponsor must be used within SponsorProvider');
  return ctx;
}
