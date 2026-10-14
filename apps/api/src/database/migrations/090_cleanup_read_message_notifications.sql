-- Los avisos de mensajes se borran al leer el chat; limpia los que ya quedaron cubiertos por una lectura.

DELETE FROM notifications n
USING dm_conversation_reads r
WHERE n.type = 'DM_MESSAGE'
  AND r.user_id = n.user_id
  AND r.conversation_id::text = n.data ->> 'conversationId'
  AND n.created_at <= r.last_read_at;

DELETE FROM notifications n
USING match_chat_reads r
WHERE n.type = 'MATCH_CHAT_MESSAGE'
  AND r.user_id = n.user_id
  AND r.match_id::text = n.data ->> 'matchId'
  AND n.created_at <= r.last_read_at;
