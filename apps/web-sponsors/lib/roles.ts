export type UserRole = 'PLAYER' | 'CLUB_ADMIN' | 'ORGANIZER' | 'PARTNER' | 'SUPER_ADMIN';

/** Panel de partners: solo PARTNER. SUPER_ADMIN usa web-admin. */
export function isPartner(role?: string | null): boolean {
  return role === 'PARTNER';
}
