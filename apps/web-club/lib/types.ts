import type { UserRole } from './roles';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
  photo?: string;
  nickname?: string;
  phone?: string;
  mainClubId?: string;
};

export type MineClub = {
  id: string;
  name: string;
  city?: string;
  zone?: string;
  logoUrl?: string | null;
  logo_url?: string | null;
  coverUrl?: string | null;
  cover_url?: string | null;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  subscriptionPlan?: string;
  subscription_plan?: string;
  currency?: string;
  courtPricePerHour?: number;
  court_price_per_hour?: number;
  depositPercent?: number;
  deposit_percent?: number;
  autoFillGapsEnabled?: boolean;
  auto_fill_gaps_enabled?: boolean;
};

export type ClubDetail = MineClub & {
  courtsCount?: number;
  [key: string]: unknown;
};

export function clubHourlyPrice(club?: MineClub | null): number {
  return Number(club?.courtPricePerHour ?? club?.court_price_per_hour ?? 0);
}

export function clubDepositPercent(club?: MineClub | null): number {
  return Number(club?.depositPercent ?? club?.deposit_percent ?? 0);
}

export function clubLogoUrl(club?: MineClub | null): string | null {
  return club?.logoUrl ?? club?.logo_url ?? null;
}

export function clubCoverUrl(club?: MineClub | null): string | null {
  return club?.coverUrl ?? club?.cover_url ?? null;
}
