-- Seguidores / seguidos (relación unidireccional)

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT user_follows_no_self CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_following
  ON user_follows (following_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower
  ON user_follows (follower_id);

-- Backfill desde amistades aceptadas (mutuo)
INSERT INTO user_follows (follower_id, following_id)
SELECT requester_id, addressee_id
FROM friend_requests
WHERE status = 'accepted'
ON CONFLICT DO NOTHING;

INSERT INTO user_follows (follower_id, following_id)
SELECT addressee_id, requester_id
FROM friend_requests
WHERE status = 'accepted'
ON CONFLICT DO NOTHING;
