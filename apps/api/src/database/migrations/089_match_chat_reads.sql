-- Hasta cuándo leyó cada jugador el chat grupal de un partido (para contar mensajes sin leer)

CREATE TABLE IF NOT EXISTS match_chat_reads (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_chat_reads_user
  ON match_chat_reads (user_id);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created
  ON messages (chat_id, created_at DESC);

-- Los chats existentes arrancan como leídos para no mostrar todo el historial como nuevo.
INSERT INTO match_chat_reads (match_id, user_id, last_read_at)
SELECT DISTINCT ch.match_id, p.user_id, NOW()
FROM chats ch
INNER JOIN match_players mp ON mp.match_id = ch.match_id
INNER JOIN players p ON p.id = mp.player_id
WHERE ch.match_id IS NOT NULL
  AND p.user_id IS NOT NULL
ON CONFLICT (match_id, user_id) DO NOTHING;
