import type { CircuitStaffMember, CircuitStaffRole, CircuitViewerAccess } from './circuits/staff';

export type UserRole = 'PLAYER' | 'CLUB_ADMIN' | 'ORGANIZER' | 'SUPER_ADMIN';

export type MatchStatus =
  | 'OPEN'
  | 'FULL'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'FINISHED'
  | 'CANCELLED'
  | 'DISPUTED';

export type TournamentStatus = 'DRAFT' | 'OPEN_REGISTRATION' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

export type PreferredHand = 'right' | 'left';
export type CourtPosition = 'drive' | 'reves' | 'ambos';
export type MatchType = 'friendly' | 'competitive';
export type MatchGender = 'male' | 'female' | 'mixed' | 'open';

export type CourtBookingMode = 'none' | 'external' | 'in_app';
export type TimeSlot = 'morning' | 'noon' | 'afternoon' | 'night';
export type PlayerCategory = '8va' | '7ma' | '6ta' | '5ta' | '4ta' | '3ra' | '2da' | '1ra';
export type CategoryStatus = 'provisional' | 'confirmed';

export interface Club {
  id: string;
  name: string;
  address?: string;
  city?: string;
  location?: string;
  description?: string;
  phone?: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  cardPhotoUrl?: string | null;
}

export interface MatchPlayer {
  id: string;
  name: string;
  photo?: string;
  rating?: number;
  skillScore?: number;
  levelCategory?: string;
  declaredCategory?: PlayerCategory;
  categoryStatus?: CategoryStatus;
  placementMatchesPlayed?: number;
  placementMatchesRequired?: number;
  status?: string;
  slotOrder?: number;
}

export interface MatchGuestInvite {
  id: string;
  name: string;
  role: 'partner' | 'opponent';
  slotOrder: number;
  sponsorUserId?: string;
}

export type SetScore = { teamA: number; teamB: number };

export type MatchResultConfirmation = {
  userId: string;
  name: string;
  confirmedAt?: string;
};

export type MatchResultRejection = {
  userId: string;
  name: string;
  comment?: string;
  rejectedAt?: string;
};

export interface MatchResult {
  teamAScore?: number;
  teamBScore?: number;
  score?: string;
  winnerTeam?: string;
  sets?: SetScore[];
  status?: 'pending' | 'confirmed' | 'disputed';
  disputed?: boolean;
  submittedByUserId?: string;
  submittedByName?: string;
  confirmations?: MatchResultConfirmation[];
  rejections?: MatchResultRejection[];
  requiredConfirmations?: number;
  confirmed?: boolean;
  proposedAt?: string;
  confirmDeadlineAt?: string;
  autoFinalized?: boolean;
}

export type PlayerMatchRating = {
  userId: string;
  score: number;
};

export type MatchDepositInfo = {
  required: boolean;
  amount: number;
  /** Parte completa del jugador (antes de aplicar % de seña). */
  fullShareAmount?: number;
  /** % configurado por el club para confirmar cancha (25/50/100). */
  depositPercent?: number;
  currency: string;
  clubName?: string;
  provider?: string;
  paid: boolean;
  depositStatus?: string | null;
  checkoutUrl?: string | null;
  coveredGuestSlots?: number;
  coveredGuests?: { id: string; name: string }[];
  /** Lo que falta para pagar el turno completo (null si ya no aplica). */
  fullCourtAmount?: number | null;
  /** Quién pagó el turno completo, si alguien lo hizo. */
  fullCourtPaidBy?: { userId: string; userName: string } | null;
  /** El viewer pagó el turno completo. */
  coversFullCourt?: boolean;
  players?: {
    id?: string;
    userId: string;
    userName: string;
    amount: number;
    status: string;
    paidAt?: string;
    coveredGuestSlots?: number;
    coversFullCourt?: boolean;
  }[];
};

export type MatchJoinRequest = {
  userId: string;
  playerId?: string;
  name: string;
  skillScore?: number;
  photo?: string;
  requestedAt?: string;
};

export type MatchCourtInfo = {
  label?: string | null;
  durationMinutes?: number;
  startHour?: number;
  endHour?: number;
  cancelPolicy?: string;
};

export type MatchPricing = {
  pricePerPlayer: number;
  depositAmount: number;
  depositPercent?: number;
  currency: string;
  bonusPoints?: number;
};

export interface Match {
  id: string;
  title: string;
  description?: string;
  date: string;
  endsAt?: string;
  status: MatchStatus;
  club?: Club;
  clubId?: string;
  createdByUserId?: string;
  createdAt?: string;
  courtBooking?: CourtBookingMode;
  venueNote?: string;
  courtSlotId?: string;
  distanceKm?: number | null;
  gender?: string;
  mode?: MatchType | string;
  neededPlayers: number;
  joinedCount: number;
  levelMin?: number;
  levelMax?: number;
  players: MatchPlayer[];
  guestInvites?: MatchGuestInvite[];
  joinRequests?: MatchJoinRequest[];
  viewerJoinStatus?: string | null;
  joinRequiresApproval?: boolean;
  viewerCategoryFits?: boolean;
  result?: MatchResult;
  deposit?: MatchDepositInfo;
  courtInfo?: MatchCourtInfo;
  pricing?: MatchPricing;
  canSubmitRivalReviews?: boolean;
  rivalReviewDeadlineAt?: string;
  disputedAt?: string;
}

export interface Tournament {
  id: string;
  name: string;
  category?: string;
  gender?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  maxTeams?: number;
  max_teams?: number;
  status: TournamentStatus | string;
  description?: string;
  photos?: { id: string; url: string; caption?: string }[];
  format?: string;
  entryFee?: number;
  price?: number;
  clubName?: string;
  clubId?: string;
  modality?: string;
  clubValidationStatus?: string;
  inviteToken?: string;
  publicSlug?: string;
  flyerUrl?: string;
  featuredPriority?: number;
  featuredUntil?: string;
  approvedCount?: number;
  pendingCount?: number;
  scheduleType?: string;
  venueCount?: number;
  isPast?: boolean;
  isClosed?: boolean;
}

export type CircuitStatus = 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';

export interface CircuitCategory {
  id: string;
  label: string;
  gender?: string;
  sortOrder?: number;
}

export interface CircuitVenue {
  clubId: string;
  clubName: string;
  city?: string;
  address?: string;
  stageCount: number;
}

export interface CircuitStage {
  id: string;
  clubId: string;
  clubName: string;
  categoryId?: string;
  categoryLabel?: string;
  categoryGender?: string;
  name?: string;
  startDate: string;
  endDate?: string;
  tournamentId?: string;
  tournamentStatus?: string;
  tournamentName?: string;
  pointsAwarded?: boolean;
  status: string;
}

export interface CircuitPointRule {
  id?: string;
  placement: string;
  points: number;
  sortOrder?: number;
}

export interface CircuitRankingEntry {
  id: string;
  playerId: string;
  playerName: string;
  categoryId: string;
  categoryLabel: string;
  categoryGender?: string;
  points: number;
  wins: number;
  losses: number;
  tournamentsPlayed?: number;
  position?: number;
}

export interface Circuit {
  id: string;
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  city?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  instagram?: string | null;
  website?: string | null;
  staff?: CircuitStaffMember[];
  viewer?: CircuitViewerAccess;
  /** Solo en GET /circuits/mine. */
  myRole?: CircuitStaffRole | null;
  myDisplayTitle?: string | null;
  description?: string;
  season?: string;
  status: CircuitStatus | string;
  startDate?: string;
  endDate?: string;
  venueCount?: number;
  categoryCount?: number;
  nextStageDate?: string;
  categories?: CircuitCategory[];
  venues?: CircuitVenue[];
  stages?: CircuitStage[];
  rankings?: CircuitRankingEntry[];
  pointRules?: CircuitPointRule[];
}

export type MessageAccessReason =
  | 'self'
  | 'need_request'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'rejected'
  | 'blocked';

export interface MessageAccess {
  canMessage: boolean;
  conversationId?: string;
  reason?: MessageAccessReason;
  canSendRequest?: boolean;
}

export interface PlayerMatchStats {
  wins: number;
  losses: number;
  draws?: number;
  completed: number;
  notCompleted: number;
  total: number;
  winRate?: number | null;
}

export type MatchHistoryResult = 'win' | 'loss' | 'draw';

export interface PlayerMatchHistoryEntry {
  matchId: string;
  date: string;
  title?: string;
  clubName?: string;
  result: MatchHistoryResult;
  score: string;
  ratingChange?: number;
  ratingAfter?: number;
  opponent: string[];
}

export interface PlayerMatchHistory {
  currentRating?: number;
  totalMatches: number;
  wins: number;
  losses: number;
  draws?: number;
  history: PlayerMatchHistoryEntry[];
}

export interface DirectConversation {
  id: string;
  status: 'pending' | 'active' | 'rejected';
  requested_by_id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_photo?: string;
  /** Si el otro participante es una cuenta de club, el chat muestra y enlaza al club. */
  other_club_id?: string | null;
  last_message?: string;
  last_message_at?: string;
  /** Mensajes del otro participante posteriores a tu última lectura. */
  unread_count?: number;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

export interface Player {
  id: string;
  userId?: string;
  name: string;
  nickname?: string;
  photo_url?: string;
  rating?: number;
  skillScore?: number;
  city?: string;
  location?: string;
  position?: string;
  preferredHand?: string;
  gender?: string;
  birthDate?: string;
  bio?: string;
  levelCategory?: string;
  declaredCategory?: PlayerCategory;
  categoryStatus?: CategoryStatus;
  placementMatchesPlayed?: number;
  placementMatchesRequired?: number;
  distanceKm?: number | null;
  matchStats?: PlayerMatchStats;
  competitiveMonthly?: {
    monthKey: string;
    points: number;
    matchesPlayed: number;
  };
  mainClubId?: string;
  mainClub?: { id: string; name: string; city?: string; location?: string };
}

export interface UserBadge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category?: string;
  sortOrder?: number;
  earnedAt?: string;
  matchId?: string | null;
}

export interface BadgeCatalogItem {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category?: string;
  sortOrder?: number;
  earned: boolean;
  earnedAt?: string | null;
  matchId?: string | null;
}

export interface BadgesSummary {
  earned: UserBadge[];
  all: BadgeCatalogItem[];
  earnedCount: number;
  total: number;
}
