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
import { CLUB_COOKIE } from '@/lib/auth-cookies';
import type { MineClub } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';

export function resolveActiveClubId(
  selectedClubId: string | null,
  clubs?: MineClub[] | null,
): string | null {
  if (selectedClubId && clubs?.some((c) => c.id === selectedClubId)) {
    return selectedClubId;
  }
  return clubs?.[0]?.id || null;
}

type ClubContextType = {
  clubs: MineClub[];
  clubsLoading: boolean;
  selectedClubId: string | null;
  activeClubId: string | null;
  activeClub: MineClub | null;
  setSelectedClubId: (id: string) => void;
  refetchClubs: () => void;
};

const ClubContext = createContext<ClubContextType | undefined>(undefined);

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const canManage = isClub(user?.role) && !!token;
  const [selectedClubId, setSelectedClubIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = Cookies.get(CLUB_COOKIE) || null;
    if (stored) setSelectedClubIdState(stored);
  }, []);

  const clubsQuery = useQuery({
    queryKey: ['clubs-mine'],
    queryFn: async () => {
      const res = await api.get('/clubs/mine');
      return res.data as MineClub[];
    },
    enabled: canManage,
  });

  const clubs = clubsQuery.data ?? [];
  const activeClubId = resolveActiveClubId(selectedClubId, clubs);
  const activeClub = clubs.find((c) => c.id === activeClubId) || null;

  const setSelectedClubId = useCallback((id: string) => {
    Cookies.set(CLUB_COOKIE, id, { expires: 30, sameSite: 'lax' });
    setSelectedClubIdState(id);
  }, []);

  useEffect(() => {
    if (!selectedClubId && clubs[0]?.id) {
      setSelectedClubId(clubs[0].id);
    }
  }, [clubs, selectedClubId, setSelectedClubId]);

  const value = useMemo(
    () => ({
      clubs,
      clubsLoading: clubsQuery.isLoading,
      selectedClubId,
      activeClubId,
      activeClub,
      setSelectedClubId,
      refetchClubs: () => {
        void clubsQuery.refetch();
      },
    }),
    [
      clubs,
      clubsQuery,
      selectedClubId,
      activeClubId,
      activeClub,
      setSelectedClubId,
    ],
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error('useClub must be used within ClubProvider');
  return ctx;
}
