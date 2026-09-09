import { api } from '@/lib/api';
import type {
  TournamentDate,
  TournamentDetail,
  TournamentInvite,
  TournamentMatch,
  TournamentModality,
  TournamentRegistration,
  TournamentStanding,
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
  sets: { teamA: number; teamB: number }[]
): Promise<TournamentMatch> {
  const res = await api.post(`/tournaments/${id}/matches/${matchId}/score`, { sets });
  return res.data;
}

export async function removeMatch(id: string, matchId: string) {
  return api.delete(`/tournaments/${id}/matches/${matchId}`);
}

export async function generateFixture(
  id: string,
  payload: { mode?: 'ROUND_ROBIN' | 'SINGLE_ELIMINATION' | 'OPEN_COURT'; reset?: boolean }
): Promise<TournamentMatch[]> {
  const res = await api.post(`/tournaments/${id}/generate-fixture`, payload);
  return res.data;
}

export async function createTournament(payload: {
  name: string;
  modality: TournamentModality;
  category?: string;
  gender?: string;
  format?: string;
  description?: string;
  clubId?: string;
  startDate?: string;
  maxTeams?: number;
  courtsAvailable?: number;
  price?: number;
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
  if (!match.score?.sets?.length) return '—';
  return match.score.sets.map((s) => `${s.teamA}-${s.teamB}`).join(' · ');
}

export function buildTournamentInviteLink(tournamentId: string, inviteToken: string): string {
  return `playtomic://tournament/${tournamentId}?invite=${inviteToken}`;
}
