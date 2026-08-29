import { normalizeMatchLevelValue } from './skill';
import type { Circuit, CircuitRankingEntry, CircuitStage, CircuitVenue, Match, MatchPlayer, PlayerMatchHistory, PlayerMatchHistoryEntry, Tournament } from './types';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export function extractCircuitId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const nested = row.circuit;
  if (nested && typeof nested === 'object') {
    const nestedId =
      (nested as Record<string, unknown>).id ??
      (nested as Record<string, unknown>).circuit_id ??
      (nested as Record<string, unknown>).circuitId;
    if (nestedId != null) {
      const id = String(nestedId).trim();
      return id && id !== 'undefined' && id !== 'null' ? id : null;
    }
  }
  const id = row.id ?? row.circuit_id ?? row.circuitId;
  if (id == null) return null;
  const normalized = String(id).trim();
  return normalized && normalized !== 'undefined' && normalized !== 'null' ? normalized : null;
}

export function isCircuitOwner(raw: Record<string, unknown>, userId?: string | null): boolean {
  if (!userId || !raw || typeof raw !== 'object') return false;
  const ownerId = raw.created_by_user_id ?? raw.createdByUserId ?? raw.created_by ?? raw.createdBy;
  return ownerId != null && String(ownerId) === userId;
}

export function mapMatch(raw: any): Match {
  const players: MatchPlayer[] = (raw.players || []).map((p: any) => ({
    id: p.id || p.user_id,
    name: p.name || p.user?.name || 'Jugador',
    photo: p.photo || p.photo_url,
    rating: p.rating ?? p.level,
    skillScore: p.skillScore ?? p.skill_score ?? p.rating ?? p.level,
    levelCategory: p.levelCategory || p.level_category,
    declaredCategory: p.declaredCategory || p.declared_category,
    categoryStatus: p.categoryStatus || p.category_status,
    placementMatchesPlayed:
      p.placementMatchesPlayed != null || p.placement_matches_played != null
        ? Number(p.placementMatchesPlayed ?? p.placement_matches_played)
        : undefined,
    placementMatchesRequired:
      p.placementMatchesRequired != null || p.placement_matches_required != null
        ? Number(p.placementMatchesRequired ?? p.placement_matches_required)
        : undefined,
    status: p.status || p.player_status,
    slotOrder: p.slotOrder ?? p.slot_order,
  }));

  return {
    id: raw.id,
    title: raw.title || 'Partido',
    description: raw.description,
    date: raw.date,
    endsAt: raw.ends_at ?? raw.endsAt ?? undefined,
    status: raw.status,
    club:
      raw.club ||
      (raw.club_name || raw.clubName
        ? {
            id: raw.club_id ?? raw.clubId,
            name: raw.club_name ?? raw.clubName,
          }
        : undefined),
    clubId: raw.club_id ?? raw.clubId ?? raw.club?.id,
    createdByUserId: raw.created_by_user_id ?? raw.createdByUserId,
    createdAt: raw.created_at ?? raw.createdAt ?? undefined,
    zone: raw.zone,
    courtBooking: (raw.courtBooking ?? raw.court_booking ?? 'none') as Match['courtBooking'],
    venueNote: raw.venueNote ?? raw.venue_note ?? undefined,
    distanceKm:
      raw.distanceKm != null || raw.distance_km != null
        ? Number(raw.distanceKm ?? raw.distance_km)
        : null,
    gender: raw.gender,
    mode: raw.mode,
    neededPlayers: raw.neededPlayers ?? raw.needed_players ?? 4,
    joinedCount: raw.joinedCount ?? raw.joined_count ?? players.length,
    levelMin: normalizeMatchLevelValue(raw.levelMin ?? raw.level_min),
    levelMax: normalizeMatchLevelValue(raw.levelMax ?? raw.level_max),
    players,
    joinRequests: (raw.join_requests || raw.joinRequests || []).map((request: any) => ({
      userId: request.userId ?? request.user_id,
      playerId: request.playerId ?? request.player_id,
      name: request.name,
      skillScore: request.skillScore ?? request.skill_score,
      photo: request.photo ?? request.photo_url,
      requestedAt: request.requestedAt ?? request.requested_at,
    })),
    viewerJoinStatus: raw.viewer_join_status ?? raw.viewerJoinStatus ?? null,
    joinRequiresApproval: raw.join_requires_approval ?? raw.joinRequiresApproval ?? false,
    guestInvites: (raw.guestInvites || raw.guest_invites || []).map((guest: any) => ({
      id: guest.id,
      name: guest.name || 'Invitado',
      role: guest.role,
      slotOrder: guest.slotOrder ?? guest.slot_order ?? 0,
      sponsorUserId: guest.sponsorUserId ?? guest.sponsor_user_id,
    })),
    result: raw.result
      ? {
          score: raw.result.score,
          winnerTeam: raw.result.winnerTeam ?? raw.result.winner_team,
          sets: raw.result.sets ?? [],
          status: raw.result.status ?? (raw.result.confirmed ? 'confirmed' : 'pending'),
          submittedByUserId: raw.result.submittedByUserId ?? raw.result.submitted_by_user_id,
          submittedByName: raw.result.submittedByName ?? raw.result.submitted_by_name,
          confirmations: raw.result.confirmations ?? [],
          rejections: raw.result.rejections ?? [],
          requiredConfirmations:
            raw.result.requiredConfirmations ?? raw.result.required_confirmations ?? 0,
          confirmed: raw.result.confirmed ?? raw.result.status === 'confirmed',
          proposedAt: raw.result.proposedAt ?? raw.result.proposed_at,
          confirmDeadlineAt: raw.result.confirmDeadlineAt ?? raw.result.confirm_deadline_at,
          autoFinalized: raw.result.autoFinalized ?? raw.result.auto_finalized,
          disputed: raw.result.disputed ?? raw.result.status === 'disputed',
          teamAScore: raw.result.teamAScore ?? raw.result.team_a_score,
          teamBScore: raw.result.teamBScore ?? raw.result.team_b_score,
        }
      : undefined,
    deposit: raw.deposit
      ? {
          ...raw.deposit,
          coveredGuestSlots: raw.deposit.coveredGuestSlots ?? raw.deposit.covered_guest_slots,
          coveredGuests: raw.deposit.coveredGuests ?? raw.deposit.covered_guests ?? [],
          players: (raw.deposit.players || []).map((player: any) => ({
            id: player.id,
            userId: player.userId ?? player.user_id,
            userName: player.userName ?? player.user_name,
            amount: Number(player.amount ?? 0),
            status: player.status,
            paidAt: player.paidAt ?? player.paid_at,
            coveredGuestSlots: player.coveredGuestSlots ?? player.covered_guest_slots,
          })),
        }
      : undefined,
    courtInfo: raw.courtInfo ?? raw.court_info
      ? {
          label: raw.courtInfo?.label ?? raw.court_info?.label ?? null,
          durationMinutes:
            raw.courtInfo?.durationMinutes ?? raw.court_info?.duration_minutes ?? undefined,
          cancelPolicy:
            raw.courtInfo?.cancelPolicy ?? raw.court_info?.cancel_policy ?? undefined,
        }
      : undefined,
    pricing: raw.pricing
      ? {
          pricePerPlayer: Number(raw.pricing.pricePerPlayer ?? raw.pricing.price_per_player ?? 0),
          depositAmount: Number(raw.pricing.depositAmount ?? raw.pricing.deposit_amount ?? 0),
          currency: raw.pricing.currency ?? 'ARS',
          bonusPoints: Number(raw.pricing.bonusPoints ?? raw.pricing.bonus_points ?? 0) || undefined,
        }
      : undefined,
    canSubmitRivalReviews: raw.can_submit_rival_reviews ?? raw.canSubmitRivalReviews,
    rivalReviewDeadlineAt: raw.rival_review_deadline_at ?? raw.rivalReviewDeadlineAt,
    disputedAt: raw.disputed_at ?? raw.disputedAt,
  };
}

export function mapTournament(raw: any): Tournament {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    gender: raw.gender,
    startDate: raw.startDate || raw.start_date,
    maxTeams: raw.maxTeams ?? raw.max_teams,
    status: raw.status,
    description: raw.description,
    photos: raw.photos || [],
    format: raw.format,
    entryFee: raw.entryFee,
    clubName: raw.club_name ?? raw.clubName,
    clubId: raw.club_id ?? raw.clubId,
    modality: raw.modality,
    clubValidationStatus: raw.club_validation_status ?? raw.clubValidationStatus,
    inviteToken: raw.invite_token ?? raw.inviteToken,
    publicSlug: raw.publicSlug,
  };
}

export function mapCircuit(raw: any): Circuit {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Circuit payload inválido');
  }
  return {
    id: String(raw.id ?? raw.circuit_id ?? raw.circuitId ?? ''),
    name: String(raw.name ?? 'Circuito'),
    description: raw.description ?? undefined,
    season: raw.season ?? undefined,
    status: raw.status ?? 'DRAFT',
    startDate: raw.startDate || raw.start_date,
    endDate: raw.endDate || raw.end_date,
    venueCount: raw.venueCount ?? raw.venue_count,
    categoryCount: raw.categoryCount ?? raw.category_count,
    nextStageDate: raw.nextStageDate || raw.next_stage_date,
    categories: asArray<any>(raw.categories).map((c) => ({
      id: String(c.id ?? c.category_id ?? c.categoryId ?? c.label ?? Math.random()),
      label: String(c.label ?? c.name ?? 'Categoría'),
      gender: c.gender ?? undefined,
      sortOrder: c.sort_order ?? c.sortOrder,
    })),
    venues: asArray<any>(raw.venues).map(mapCircuitVenue),
    stages: asArray<any>(raw.stages).map(mapCircuitStage),
    rankings: asArray<any>(raw.rankings).map(mapCircuitRanking),
  };
}

export function safeMapCircuit(raw: unknown): Circuit | null {
  try {
    return mapCircuit(raw);
  } catch {
    return null;
  }
}

export function mapCircuitVenue(raw: any): CircuitVenue {
  if (!raw || typeof raw !== 'object') {
    return { clubId: '', clubName: 'Club', stageCount: 0 };
  }
  return {
    clubId: String(raw.club_id ?? raw.clubId ?? raw.id ?? ''),
    clubName: String(raw.club_name ?? raw.clubName ?? raw.name ?? 'Club'),
    city: raw.city,
    zone: raw.zone,
    address: raw.address,
    stageCount: raw.stage_count ?? raw.stageCount ?? 0,
  };
}

export function mapCircuitStage(raw: any): CircuitStage {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 'stage-unknown',
      clubId: '',
      clubName: 'Club',
      startDate: '',
      status: 'SCHEDULED',
    };
  }
  return {
    id: String(raw.id ?? `${raw.club_id ?? raw.clubId}-${raw.start_date ?? raw.startDate ?? 'stage'}`),
    clubId: String(raw.club_id ?? raw.clubId ?? ''),
    clubName: String(raw.club_name ?? raw.clubName ?? 'Club'),
    categoryId: raw.category_id ?? raw.categoryId,
    categoryLabel: raw.category_label ?? raw.categoryLabel,
    name: raw.name,
    startDate: raw.start_date ?? raw.startDate,
    endDate: raw.end_date ?? raw.endDate,
    tournamentId: raw.tournament_id ?? raw.tournamentId,
    status: raw.status ?? 'SCHEDULED',
  };
}

export function mapCircuitRanking(raw: any): CircuitRankingEntry {
  if (!raw || typeof raw !== 'object') {
    return {
      id: String(Math.random()),
      playerId: '',
      playerName: 'Jugador',
      categoryId: '',
      categoryLabel: '',
      points: 0,
      wins: 0,
      losses: 0,
    };
  }
  return {
    id: String(raw.id ?? raw.player_id ?? raw.playerId ?? Math.random()),
    playerId: String(raw.player_id ?? raw.playerId ?? ''),
    playerName: String(raw.player_name ?? raw.playerName ?? raw.nickname ?? 'Jugador'),
    categoryId: raw.category_id ?? raw.categoryId,
    categoryLabel: raw.category_label ?? raw.categoryLabel,
    points: raw.points ?? 0,
    wins: raw.wins ?? 0,
    losses: raw.losses ?? 0,
    position: raw.position,
  };
}

function mapPlayerMatchStats(raw: any) {
  if (!raw) return undefined;
  const src = raw.match_stats ?? raw.matchStats ?? raw.stats ?? raw;
  if (src.wins == null && src.completed == null && src.total == null) return undefined;
  return {
    wins: src.wins ?? 0,
    losses: src.losses ?? 0,
    draws: src.draws ?? 0,
    completed: src.completed ?? 0,
    notCompleted: src.notCompleted ?? src.not_completed ?? 0,
    total: src.total ?? 0,
    winRate: src.winRate ?? src.win_rate ?? null,
  };
}

export function mapPlayerMatchHistory(raw: any): PlayerMatchHistory {
  const history = (raw.history || []).map(
    (entry: any): PlayerMatchHistoryEntry => ({
      matchId: entry.matchId ?? entry.match_id,
      date: entry.date,
      title: entry.title,
      clubName: entry.clubName ?? entry.club_name,
      result: entry.result,
      score: entry.score,
      ratingChange: entry.ratingChange ?? entry.rating_change,
      ratingAfter: entry.ratingAfter ?? entry.rating_after,
      opponent: entry.opponent ?? entry.opponentNames ?? entry.opponent_names ?? [],
    }),
  );

  return {
    currentRating: raw.currentRating ?? raw.current_rating,
    totalMatches: raw.totalMatches ?? raw.total_matches ?? history.length,
    wins: raw.wins ?? 0,
    losses: raw.losses ?? 0,
    draws: raw.draws ?? 0,
    history,
  };
}

export function mapPlayer(raw: any) {
  return {
    id: raw.id,
    userId: raw.user_id ?? raw.userId ?? raw.id,
    name: raw.name || raw.nickname || 'Jugador',
    nickname: raw.nickname,
    photo_url: raw.photo_url,
    level: raw.level,
    rating: raw.rating,
    skillScore: raw.skillScore ?? raw.skill_score ?? raw.rating ?? raw.level,
    zone: raw.zone,
    city: raw.city,
    position: raw.position,
    bio: raw.bio,
    levelCategory: raw.levelCategory || raw.level_category,
    declaredCategory: raw.declaredCategory || raw.declared_category,
    categoryStatus: raw.categoryStatus || raw.category_status,
    placementMatchesPlayed:
      raw.placementMatchesPlayed != null || raw.placement_matches_played != null
        ? Number(raw.placementMatchesPlayed ?? raw.placement_matches_played)
        : undefined,
    placementMatchesRequired:
      raw.placementMatchesRequired != null || raw.placement_matches_required != null
        ? Number(raw.placementMatchesRequired ?? raw.placement_matches_required)
        : undefined,
    matchStats: mapPlayerMatchStats(raw),
    distanceKm:
      raw.distanceKm != null || raw.distance_km != null
        ? Number(raw.distanceKm ?? raw.distance_km)
        : null,
  };
}
