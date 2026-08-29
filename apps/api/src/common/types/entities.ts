export type UserRole = 'PLAYER' | 'CLUB_ADMIN' | 'SUPER_ADMIN';
export type MatchStatus =
  | 'OPEN'
  | 'FULL'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'FINISHED'
  | 'CANCELLED';

export interface UserEntity {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface PlayerEntity {
  id: string;
  user_id: string;
  nickname: string | null;
  city: string | null;
  zone: string | null;
  level: number | null;
  position: 'drive' | 'reves' | 'ambos' | null;
  bio: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchEntity {
  id: string;
  club_id: string | null;
  created_by_user_id: string;
  title: string;
  description: string | null;
  date: string;
  zone: string | null;
  level_min: number | null;
  level_max: number | null;
  gender: 'male' | 'female' | 'mixed' | 'open';
  mode: 'friendly' | 'competitive';
  needed_players: number;
  status: MatchStatus;
  created_at: string;
  updated_at: string;
}
