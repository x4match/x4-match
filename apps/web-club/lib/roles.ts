export type UserRole = 'PLAYER' | 'CLUB_ADMIN' | 'ORGANIZER' | 'SUPER_ADMIN';

export const CLUB_ROLES: UserRole[] = ['CLUB_ADMIN', 'SUPER_ADMIN'];

export function isClub(role?: string | null): boolean {
  return CLUB_ROLES.includes(role as UserRole);
}
