export type UserRole = 'PLAYER' | 'CLUB_ADMIN' | 'ORGANIZER' | 'SUPER_ADMIN';

export function isPlatformAdmin(role?: string) {
  return role === 'SUPER_ADMIN';
}

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};
