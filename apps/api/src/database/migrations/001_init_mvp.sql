CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('PLAYER', 'CLUB_ADMIN', 'SUPER_ADMIN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'player_position') THEN
    CREATE TYPE player_position AS ENUM ('drive', 'reves', 'ambos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_gender') THEN
    CREATE TYPE match_gender AS ENUM ('male', 'female', 'mixed', 'open');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_mode') THEN
    CREATE TYPE match_mode AS ENUM ('friendly', 'competitive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status') THEN
    CREATE TYPE match_status AS ENUM ('OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_player_status') THEN
    CREATE TYPE match_player_status AS ENUM ('JOINED', 'INVITED', 'LEFT', 'CONFIRMED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_type') THEN
    CREATE TYPE chat_type AS ENUM ('MATCH', 'TOURNAMENT', 'THIRD_TIME', 'PRIVATE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_status') THEN
    CREATE TYPE tournament_status AS ENUM ('DRAFT', 'OPEN_REGISTRATION', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'PLAYER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT,
  city TEXT,
  zone TEXT,
  level NUMERIC(3,1) DEFAULT 2.5,
  position player_position DEFAULT 'ambos',
  bio TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  zone TEXT,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  zone TEXT,
  level_min NUMERIC(3,1),
  level_max NUMERIC(3,1),
  gender match_gender NOT NULL DEFAULT 'open',
  mode match_mode NOT NULL DEFAULT 'friendly',
  needed_players INT NOT NULL CHECK (needed_players BETWEEN 2 AND 8),
  status match_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status match_player_status NOT NULL DEFAULT 'JOINED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  tournament_id UUID,
  third_time_id UUID,
  type chat_type NOT NULL DEFAULT 'MATCH',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID UNIQUE NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  winner_team TEXT NOT NULL,
  score TEXT NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  format TEXT,
  gender TEXT,
  start_date TIMESTAMPTZ,
  max_teams INT,
  price NUMERIC(10,2),
  rules TEXT,
  prizes TEXT,
  status tournament_status NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS third_time (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  place TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
