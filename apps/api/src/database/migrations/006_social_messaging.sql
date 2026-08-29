-- Amistades y mensajería directa

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friend_requests_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friend_requests_unique_pair UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_addressee_pending
  ON friend_requests (addressee_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'rejected')),
  requested_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dm_conversations_no_self CHECK (user_a_id <> user_b_id),
  CONSTRAINT dm_conversations_unique_pair UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_conversations_user_a ON dm_conversations (user_a_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_user_b ON dm_conversations (user_b_id);

CREATE TABLE IF NOT EXISTS dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dm_messages_content_not_empty CHECK (char_length(trim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation_created
  ON dm_messages (conversation_id, created_at DESC);
