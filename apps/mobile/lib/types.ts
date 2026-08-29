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
  zone?: string;
  description?: string;
  phone?: string;
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
  currency: string;
  clubName?: string;
  provider?: string;
  paid: boolean;
  depositStatus?: string | null;
  checkoutUrl?: string | null;
  coveredGuestSlots?: number;
  coveredGuests?: { id: string; name: string }[];
  players?: {
    id?: string;
    userId: string;
    userName: string;
    amount: number;
    status: string;
    paidAt?: string;
    coveredGuestSlots?: number;
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
  cancelPolicy?: string;
};

export type MatchPricing = {
  pricePerPlayer: number;
  depositAmount: number;
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
  zone?: string;
  courtBooking?: CourtBookingMode;
  venueNote?: string;
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
  maxTeams?: number;
  max_teams?: number;
  status: TournamentStatus | string;
  description?: string;
  photos?: { id: string; url: string; caption?: string }[];
  format?: string;
  entryFee?: number;
  clubName?: string;
  clubId?: string;
  modality?: string;
  clubValidationStatus?: string;
  inviteToken?: string;
  publicSlug?: string;
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
  zone?: string;
  address?: string;
  stageCount: number;
}

export interface CircuitStage {
  id: string;
  clubId: string;
  clubName: string;
  categoryId?: string;
  categoryLabel?: string;
  name?: string;
  startDate: string;
  endDate?: string;
  tournamentId?: string;
  status: string;
}

export interface CircuitRankingEntry {
  id: string;
  playerId: string;
  playerName: string;
  categoryId: string;
  categoryLabel: string;
  points: number;
  wins: number;
  losses: number;
  position?: number;
}

export interface Circuit {
  id: string;
  name: string;
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
}

export type MessageAccessReason =
  | 'self'
  | 'need_request'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'rejected';

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
  last_message?: string;
  last_message_at?: string;
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
  level?: number;
  rating?: number;
  skillScore?: number;
  zone?: string;
  city?: string;
  position?: string;
  bio?: string;
  levelCategory?: string;
  declaredCategory?: PlayerCategory;
  categoryStatus?: CategoryStatus;
  placementMatchesPlayed?: number;
  placementMatchesRequired?: number;
  distanceKm?: number | null;
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
