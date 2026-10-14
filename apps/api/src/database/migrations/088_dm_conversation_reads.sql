-- Hasta cuándo leyó cada participante un chat directo (para contar mensajes sin leer)

CREATE TABLE IF NOT EXISTS dm_conversation_reads (
  conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_conversation_reads_user
  ON dm_conversation_reads (user_id);

-- Los chats existentes arrancan como leídos para no mostrar todo el historial como nuevo.
INSERT INTO dm_conversation_reads (conversation_id, user_id, last_read_at)
SELECT c.id, participant.user_id, NOW()
FROM dm_conversations c
CROSS JOIN LATERAL (VALUES (c.user_a_id), (c.user_b_id)) AS participant(user_id)
ON CONFLICT (conversation_id, user_id) DO NOTHING;
