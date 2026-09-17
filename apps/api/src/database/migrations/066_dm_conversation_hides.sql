-- Ocultar chats por usuario (borrar solo para mí)

CREATE TABLE IF NOT EXISTS dm_conversation_hides (
  conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_conversation_hides_user
  ON dm_conversation_hides (user_id);
