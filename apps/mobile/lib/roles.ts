import type { UserRole } from './types';

export const CLUB_ROLES: UserRole[] = ['CLUB_ADMIN', 'SUPER_ADMIN'];
/** @deprecated Prefer canOrganizeEvents — ORGANIZER queda por compatibilidad. */
export const ORGANIZER_ROLES: UserRole[] = ['ORGANIZER', 'SUPER_ADMIN'];
export const STAFF_ROLES: UserRole[] = ['CLUB_ADMIN', 'ORGANIZER', 'SUPER_ADMIN'];

/** Jugador (incluye ORGANIZER legacy unificado al mismo UX). */
export function isPlayer(role?: string): boolean {
  return !role || role === 'PLAYER' || role === 'ORGANIZER';
}

export function isClub(role?: string): boolean {
  return CLUB_ROLES.includes(role as UserRole);
}

/**
 * Puede crear y gestionar torneos/circuitos.
 * Unificado con jugador: ya no hace falta un rol ORGANIZER aparte.
 */
export function canOrganizeEvents(role?: string): boolean {
  return isPlayer(role) || role === 'SUPER_ADMIN';
}

/** @deprecated Use canOrganizeEvents */
export function isEventOrganizer(role?: string): boolean {
  return canOrganizeEvents(role);
}

export function isStaff(role?: string): boolean {
  return STAFF_ROLES.includes(role as UserRole);
}

export function roleLabel(role?: string): string {
  switch (role) {
    case 'CLUB_ADMIN':
      return 'Club';
    case 'SUPER_ADMIN':
      return 'Administrador';
    case 'ORGANIZER':
    case 'PLAYER':
    default:
      return 'Jugador';
  }
}
