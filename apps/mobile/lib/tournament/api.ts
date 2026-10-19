import { api } from '@/lib/api';
import type {
  FixtureMode,
  TournamentDate,
  TournamentDetail,
  TournamentGroupsResponse,
  TournamentInvite,
  TournamentMatch,
  TournamentModality,
  TournamentPlayer,
  TournamentPlayerSide,
  TournamentRefund,
  TournamentRegistration,
  TournamentStanding,
  WithdrawRefundResult,
  ZoneDraft,
} from './types';

export async function fetchTournamentDetail(
  id: string,
  inviteToken?: string | null,
): Promise<TournamentDetail> {
  const res = await api.get(`/tournaments/${id}`, {
    params: inviteToken ? { invite: inviteToken } : undefined,
  });
  return res.data;
}

export async function updateTournament(
  id: string,
  payload: Record<string, unknown>
): Promise<TournamentDetail> {
  const res = await api.patch(`/tournaments/${id}`, payload);
  return res.data;
}

export async function deleteTournament(id: string) {
  return api.delete(`/tournaments/${id}`);
}

// Fechas
export async function fetchDates(id: string): Promise<TournamentDate[]> {
  const res = await api.get(`/tournaments/${id}/dates`);
  return res.data;
}

export async function addDate(
  id: string,
  payload: { playDate: string; label?: string; notes?: string }
): Promise<TournamentDate> {
  const res = await api.post(`/tournaments/${id}/dates`, payload);
  return res.data;
}

export async function removeDate(id: string, dateId: string) {
  return api.delete(`/tournaments/${id}/dates/${dateId}`);
}

// Inscripciones
export async function fetchRegistrations(id: string): Promise<TournamentRegistration[]> {
  const res = await api.get(`/tournaments/${id}/registrations`);
  return res.data;
}

export async function fetchMyRegistration(id: string): Promise<TournamentRegistration | null> {
  const res = await api.get(`/tournaments/${id}/registrations/me`);
  return res.data;
}

export async function registerTeam(
  id: string,
  payload: {
    player1Name: string;
    player2Name: string;
    player1UserId?: string;
    player2UserId?: string;
    player1Email?: string;
    player2Email?: string;
    phone?: string;
    category?: string;
    onBehalf?: boolean;
  },
  inviteToken?: string | null,
): Promise<TournamentRegistration> {
  const res = await api.post(`/tournaments/${id}/registrations`, payload, {
    params: inviteToken ? { invite: inviteToken } : undefined,
  });
  return res.data;
}

export async function approveRegistration(id: string, regId: string) {
  const res = await api.post(`/tournaments/${id}/registrations/${regId}/approve`);
  return res.data;
}

export async function rejectRegistration(id: string, regId: string) {
  const res = await api.post(`/tournaments/${id}/registrations/${regId}/reject`);
  return res.data;
}

export async function promoteRegistration(id: string, regId: string) {
  const res = await api.post(`/tournaments/${id}/registrations/${regId}/promote`);
  return res.data;
}

export async function removeRegistration(id: string, regId: string) {
  return api.delete(`/tournaments/${id}/registrations/${regId}`);
}

/** El jugador se baja de su inscripción; el backend aplica la política de devolución. */
export async function withdrawRegistration(id: string, regId: string) {
  const res = await api.delete(`/tournaments/${id}/registrations/${regId}`);
  return res.data as { success: boolean; refund: WithdrawRefundResult | null };
}

export async function fetchTournamentRefunds(id: string): Promise<TournamentRefund[]> {
  const res = await api.get(`/tournaments/${id}/refunds`);
  return res.data;
}

export async function markTournamentRefundDone(id: string, refundId: string) {
  const res = await api.post(`/tournaments/${id}/refunds/${refundId}/mark-refunded`);
  return res.data as TournamentRefund;
}

// Pagos
export async function createRegistrationCheckout(id: string, regId: string) {
  const res = await api.post(`/tournaments/${id}/registrations/${regId}/checkout`);
  return res.data as {
    required: boolean;
    paid: boolean;
    amount: number;
    checkoutUrl?: string;
    provider?: string;
    mock?: boolean;
    message?: string;
    methods?: { transfer?: boolean; mercadopago?: boolean };
    transfer?: {
      cbu?: string | null;
      alias?: string | null;
      holderName?: string | null;
    } | null;
  };
}

export async function simulatePayment(id: string, regId: string) {
  const res = await api.post(`/tournaments/${id}/registrations/${regId}/pay/simulate`);
  return res.data;
}

/** Organizador marca el pago como acreditado (manual / efectivo / transferencia). */
export async function markRegistrationPaid(id: string, regId: string) {
  const res = await api.post(`/tournaments/${id}/registrations/${regId}/mark-paid`);
  return res.data as TournamentRegistration;
}

// Partidos
export async function fetchMatches(id: string): Promise<TournamentMatch[]> {
  const res = await api.get(`/tournaments/${id}/matches`);
  return res.data;
}

export async function fetchStandings(id: string): Promise<TournamentStanding[]> {
  const res = await api.get(`/tournaments/${id}/standings`);
  return res.data;
}

export async function fetchGroups(
  id: string,
  inviteToken?: string | null,
): Promise<TournamentGroupsResponse> {
  const res = await api.get(`/tournaments/${id}/groups`, {
    params: inviteToken ? { invite: inviteToken } : undefined,
  });
  return res.data;
}

export async function createMatch(
  id: string,
  payload: {
    teamARegistrationId?: string;
    teamBRegistrationId?: string;
    teamAName?: string;
    teamBName?: string;
    round?: number;
    roundLabel?: string;
    courtLabel?: string;
    dateId?: string;
    scheduledAt?: string;
  }
): Promise<TournamentMatch> {
  const res = await api.post(`/tournaments/${id}/matches`, payload);
  return res.data;
}

export async function updateMatch(
  id: string,
  matchId: string,
  payload: { status?: string; courtLabel?: string; scheduledAt?: string; dateId?: string }
): Promise<TournamentMatch> {
  const res = await api.patch(`/tournaments/${id}/matches/${matchId}`, payload);
  return res.data;
}

export async function setMatchScore(
  id: string,
  matchId: string,
  result: { sets: { teamA: number; teamB: number }[] } | { walkoverWinner: 'A' | 'B' }
): Promise<TournamentMatch> {
  const res = await api.post(`/tournaments/${id}/matches/${matchId}/score`, result);
  return res.data;
}

export async function clearMatchScore(id: string, matchId: string): Promise<TournamentMatch> {
  const res = await api.delete(`/tournaments/${id}/matches/${matchId}/score`);
  return res.data;
}

export async function removeMatch(id: string, matchId: string) {
  return api.delete(`/tournaments/${id}/matches/${matchId}`);
}

export async function clearFixture(id: string) {
  return api.delete(`/tournaments/${id}/matches`);
}

// Jugadores y parejas (torneo interno)
export async function fetchTournamentPlayers(
  id: string,
  inviteToken?: string | null,
): Promise<TournamentPlayer[]> {
  const res = await api.get(`/tournaments/${id}/players`, {
    params: inviteToken ? { invite: inviteToken } : undefined,
  });
  return res.data;
}

export async function addTournamentPlayer(
  id: string,
  payload: { name: string; side: TournamentPlayerSide; userId?: string },
): Promise<TournamentPlayer> {
  const res = await api.post(`/tournaments/${id}/players`, payload);
  return res.data;
}

export async function updateTournamentPlayerSide(
  id: string,
  playerId: string,
  side: TournamentPlayerSide,
): Promise<TournamentPlayer> {
  const res = await api.patch(`/tournaments/${id}/players/${playerId}`, { side });
  return res.data;
}

export async function removeTournamentPlayer(id: string, playerId: string) {
  return api.delete(`/tournaments/${id}/players/${playerId}`);
}

export async function createTournamentPair(
  id: string,
  driveId: string,
  revesId: string,
): Promise<TournamentPlayer[]> {
  const res = await api.post(`/tournaments/${id}/pairs`, { driveId, revesId });
  return res.data;
}

export async function autoPairTournamentPlayers(id: string): Promise<TournamentPlayer[]> {
  const res = await api.post(`/tournaments/${id}/pairs/auto`);
  return res.data;
}

export async function removeTournamentPair(id: string, regId: string): Promise<TournamentPlayer[]> {
  const res = await api.delete(`/tournaments/${id}/pairs/${regId}`);
  return res.data;
}

export async function generateFixture(
  id: string,
  payload: { mode?: FixtureMode; reset?: boolean; force?: boolean }
): Promise<TournamentMatch[]> {
  const res = await api.post(`/tournaments/${id}/generate-fixture`, payload);
  return res.data;
}

// Gestión estilo organizador: inscripción, zonas, cierre y carga masiva

export async function updateRegistrationWindow(
  id: string,
  payload: { closesAt?: string | null; action?: 'CLOSE' | 'REOPEN' },
): Promise<TournamentDetail> {
  const res = await api.patch(`/tournaments/${id}/registration-window`, payload);
  return res.data;
}

export async function fetchZoneDraft(id: string): Promise<ZoneDraft> {
  const res = await api.get(`/tournaments/${id}/zones`);
  return res.data;
}

export async function saveZoneDraft(
  id: string,
  zones: { code: string; teamIds: string[] }[],
): Promise<ZoneDraft> {
  const res = await api.put(`/tournaments/${id}/zones`, { zones });
  return res.data;
}

export async function resetZoneDraft(id: string): Promise<ZoneDraft> {
  const res = await api.delete(`/tournaments/${id}/zones`);
  return res.data;
}

export async function closeZone(id: string, code: string): Promise<{ code: string; cancelled: number }> {
  const res = await api.post(`/tournaments/${id}/zones/${code}/close`);
  return res.data;
}

export async function reopenZone(id: string, code: string): Promise<{ code: string; reopened: number }> {
  const res = await api.post(`/tournaments/${id}/zones/${code}/reopen`);
  return res.data;
}

export async function closeTournament(id: string, force = false): Promise<TournamentDetail> {
  const res = await api.post(`/tournaments/${id}/close`, { force });
  return res.data;
}

export type BulkResultItem =
  | { matchId: string; sets: { teamA: number; teamB: number }[] }
  | { matchId: string; walkoverWinner: 'A' | 'B' };

export async function saveResultsBulk(
  id: string,
  results: BulkResultItem[],
): Promise<{ saved: number; failed: number; results: { matchId: string; ok: boolean; error?: string }[] }> {
  const res = await api.post(`/tournaments/${id}/results/bulk`, { results });
  return res.data;
}

export async function createTournament(payload: {
  name: string;
  modality: TournamentModality;
  category?: string;
  gender?: string;
  format?: string;
  scheduleType?: 'SINGLE_DAY' | 'MULTI_DAY';
  description?: string;
  clubId?: string;
  venueClubIds?: string[];
  startDate?: string;
  maxTeams?: number;
  courtsAvailable?: number;
  price?: number;
  acceptTransfer?: boolean;
  acceptMercadopago?: boolean;
  transferCbu?: string;
  transferAlias?: string;
  transferHolderName?: string;
  refundOnWithdraw?: boolean;
  prizes?: string;
  rules?: string;
}): Promise<TournamentDetail> {
  const res = await api.post('/tournaments', payload);
  return res.data;
}

export async function addTournamentPhoto(
  tournamentId: string,
  payload: { photoUrl: string; caption?: string },
) {
  const res = await api.post(`/tournaments/${tournamentId}/photos`, payload);
  return res.data as { id: string; photo_url: string; caption?: string | null };
}

export async function addTournamentPhotoFile(
  tournamentId: string,
  file: { uri: string; mimeType: string; fileName: string },
  caption?: string,
) {
  const formData = new FormData();
  formData.append('photo', {
    uri: file.uri,
    name: file.fileName,
    type: file.mimeType,
  } as any);
  if (caption) formData.append('caption', caption);
  const res = await api.post(`/tournaments/${tournamentId}/photos/upload`, formData, {
    timeout: 60_000,
  });
  return res.data as { id: string; photo_url: string; caption?: string | null };
}

export async function deleteTournamentPhoto(tournamentId: string, photoId: string) {
  return api.delete(`/tournaments/${tournamentId}/photos/${photoId}`);
}

export async function fetchTournamentInvites(id: string): Promise<TournamentInvite[]> {
  const res = await api.get(`/tournaments/${id}/invites`);
  return res.data;
}

export async function inviteTournamentPlayers(id: string, userIds: string[]) {
  const res = await api.post(`/tournaments/${id}/invites`, { userIds });
  return res.data as TournamentInvite[];
}

export async function revokeTournamentInvite(id: string, inviteId: string) {
  return api.delete(`/tournaments/${id}/invites/${inviteId}`);
}

export async function joinTournamentByInviteToken(token: string): Promise<TournamentDetail> {
  const res = await api.get(`/tournaments/join/${token}`);
  return res.data;
}

export async function fetchClubTournamentValidations(clubId: string): Promise<TournamentDetail[]> {
  const res = await api.get(`/clubs/${clubId}/tournament-validations`);
  return res.data;
}

export async function approveClubTournamentValidation(id: string): Promise<TournamentDetail> {
  const res = await api.post(`/tournaments/${id}/club-validation/approve`);
  return res.data;
}

export async function rejectClubTournamentValidation(id: string): Promise<TournamentDetail> {
  const res = await api.post(`/tournaments/${id}/club-validation/reject`);
  return res.data;
}

export type OrganizerTournamentStatusFilter =
  | 'ALL'
  | 'DRAFT'
  | 'OPEN_REGISTRATION'
  | 'IN_PROGRESS'
  | 'FINISHED'
  | 'CANCELLED';

export type OrganizerTournamentRow = TournamentDetail & {
  approved_count?: number;
  pending_count?: number;
  total_count?: number;
  matches_count?: number;
  matches_finished_count?: number;
};

/** Torneos del organizador autenticado. */
export async function fetchMyTournaments(
  status: OrganizerTournamentStatusFilter = 'ALL',
): Promise<OrganizerTournamentRow[]> {
  const res = await api.get('/tournaments/mine', {
    params: status === 'ALL' ? undefined : { status },
  });
  return res.data;
}

export function formatScore(match: TournamentMatch): string {
  if (match.score?.bye) return 'Pase libre';
  if (match.score?.walkover) return 'W.O.';
  if (!match.score?.sets?.length) return '—';
  return match.score.sets.map((s) => `${s.teamA}-${s.teamB}`).join(' · ');
}

export function buildTournamentInviteLink(tournamentId: string, inviteToken: string): string {
  return `playtomic://tournament/${tournamentId}?invite=${inviteToken}`;
}
