import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isClubRole } from '../common/roles';
import { DatabaseService } from '../database/database.service';

type MessageAccessDenied = {
  canMessage: false;
  reason: 'self' | 'need_request' | 'pending_outgoing' | 'pending_incoming' | 'rejected';
  canSendRequest?: boolean;
};

export type MessageAccess =
  | { canMessage: true; conversationId?: string }
  | MessageAccessDenied;

@Injectable()
export class MessagingService {
  constructor(private readonly db: DatabaseService) {}

  private canonicalPair(userId: string, otherUserId: string): [string, string] {
    return userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];
  }

  async areFriends(userId: string, otherUserId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM friend_requests
       WHERE status = 'accepted'
         AND (
           (requester_id = $1 AND addressee_id = $2)
           OR (requester_id = $2 AND addressee_id = $1)
         )
       LIMIT 1`,
      [userId, otherUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async havePlayedTogether(userId: string, otherUserId: string): Promise<boolean> {
    const queries = [
      `SELECT EXISTS (
         SELECT 1 FROM match_players mp1
         INNER JOIN match_players mp2 ON mp1.match_id = mp2.match_id
         INNER JOIN matches m ON m.id = mp1.match_id
         WHERE mp1.user_id = $1 AND mp2.user_id = $2 AND m.status = 'FINISHED'
       ) AS ok`,
      `SELECT EXISTS (
         SELECT 1 FROM "match_participants" mp1
         INNER JOIN "match_participants" mp2 ON mp1."matchId" = mp2."matchId"
         INNER JOIN matches m ON m.id = mp1."matchId"
         WHERE mp1."userId" = $1 AND mp2."userId" = $2 AND m.status = 'FINISHED'
       ) AS ok`,
    ];
    for (const sql of queries) {
      try {
        const result = await this.db.query<{ ok: boolean }>(sql, [userId, otherUserId]);
        if (result.rows[0]?.ok) return true;
      } catch {
        // tabla con otro nombre de esquema
      }
    }
    return false;
  }

  async getAccess(userId: string, otherUserId: string): Promise<MessageAccess> {
    if (userId === otherUserId) {
      return { canMessage: false, reason: 'self' };
    }

    const conv = await this.findConversation(userId, otherUserId);
    const userIsClub = await this.isClubUser(userId);
    const otherIsClub = await this.isClubUser(otherUserId);

    if (userIsClub || otherIsClub) {
      if (conv?.status === 'active') {
        return { canMessage: true, conversationId: conv.id };
      }
      if (await this.areFriends(userId, otherUserId) || (await this.havePlayedTogether(userId, otherUserId))) {
        return { canMessage: true, conversationId: conv?.id };
      }
      return this.resolveConversationAccess(userId, conv);
    }

    if (await this.areFriends(userId, otherUserId)) {
      return { canMessage: true, conversationId: conv?.id };
    }
    if (await this.havePlayedTogether(userId, otherUserId)) {
      return { canMessage: true, conversationId: conv?.id };
    }

    return this.resolveConversationAccess(userId, conv);
  }

  private resolveConversationAccess(
    userId: string,
    conv?: { id: string; status: string; requested_by_id: string },
  ): MessageAccess {
    if (!conv) {
      return { canMessage: false, reason: 'need_request', canSendRequest: true };
    }
    if (conv.status === 'active') {
      return { canMessage: true, conversationId: conv.id };
    }
    if (conv.status === 'rejected') {
      return { canMessage: false, reason: 'rejected' };
    }
    if (conv.requested_by_id === userId) {
      return { canMessage: false, reason: 'pending_outgoing' };
    }
    return { canMessage: false, reason: 'pending_incoming' };
  }

  private async isClubUser(userId: string): Promise<boolean> {
    const result = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    return isClubRole(result.rows[0]?.role);
  }

  private async findConversation(userId: string, otherUserId: string) {
    const [userA, userB] = this.canonicalPair(userId, otherUserId);
    const result = await this.db.query(
      `SELECT id, status, requested_by_id FROM dm_conversations
       WHERE user_a_id = $1 AND user_b_id = $2`,
      [userA, userB],
    );
    return result.rows[0] as { id: string; status: string; requested_by_id: string } | undefined;
  }

  async requestConversation(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new BadRequestException('No podés enviarte mensajes a vos mismo');
    }
    const access = await this.getAccess(userId, otherUserId);
    if (access.canMessage) {
      const convId = access.conversationId ?? (await this.ensureActiveConversation(userId, otherUserId)).id;
      return { conversationId: convId, status: 'active' as const };
    }

    const { reason } = access as MessageAccessDenied;
    if (reason === 'pending_outgoing') {
      throw new BadRequestException('Ya enviaste una solicitud de mensaje. Esperá la respuesta.');
    }
    if (reason === 'pending_incoming') {
      throw new BadRequestException('Tenés una solicitud pendiente. Aceptala desde Mensajes.');
    }
    if (reason === 'rejected') {
      throw new BadRequestException('La solicitud de mensaje fue rechazada');
    }

    const [userA, userB] = this.canonicalPair(userId, otherUserId);
    const result = await this.db.query(
      `INSERT INTO dm_conversations (user_a_id, user_b_id, status, requested_by_id)
       VALUES ($1, $2, 'pending', $3)
       ON CONFLICT (user_a_id, user_b_id) DO UPDATE
         SET updated_at = NOW()
       RETURNING id, status`,
      [userA, userB, userId],
    );
    return { conversationId: result.rows[0].id, status: result.rows[0].status };
  }

  async acceptConversation(userId: string, conversationId: string) {
    const conv = await this.getConversationForUser(conversationId, userId);
    if (conv.status !== 'pending') {
      throw new BadRequestException('Esta conversación ya no está pendiente');
    }
    if (conv.requested_by_id === userId) {
      throw new ForbiddenException('No podés aceptar tu propia solicitud');
    }
    await this.db.query(
      `UPDATE dm_conversations SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [conversationId],
    );
    return { conversationId, status: 'active' };
  }

  async rejectConversation(userId: string, conversationId: string) {
    const conv = await this.getConversationForUser(conversationId, userId);
    if (conv.status !== 'pending') {
      throw new BadRequestException('Esta conversación ya no está pendiente');
    }
    if (conv.requested_by_id === userId) {
      throw new ForbiddenException('No podés rechazar tu propia solicitud');
    }
    await this.db.query(
      `UPDATE dm_conversations SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
      [conversationId],
    );
    return { conversationId, status: 'rejected' };
  }

  private async ensureActiveConversation(userId: string, otherUserId: string) {
    const existing = await this.findConversation(userId, otherUserId);
    if (existing?.status === 'active') return existing;
    const [userA, userB] = this.canonicalPair(userId, otherUserId);
    const result = await this.db.query(
      `INSERT INTO dm_conversations (user_a_id, user_b_id, status, requested_by_id)
       VALUES ($1, $2, 'active', $3)
       ON CONFLICT (user_a_id, user_b_id) DO UPDATE
         SET status = 'active', updated_at = NOW()
       RETURNING id`,
      [userA, userB, userId],
    );
    return { id: result.rows[0].id as string };
  }

  private async getConversationForUser(conversationId: string, userId: string) {
    const result = await this.db.query(
      `SELECT id, user_a_id, user_b_id, status, requested_by_id
       FROM dm_conversations WHERE id = $1`,
      [conversationId],
    );
    const conv = result.rows[0];
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    if (conv.user_a_id !== userId && conv.user_b_id !== userId) {
      throw new ForbiddenException('No tenés acceso a esta conversación');
    }
    return conv as {
      id: string;
      user_a_id: string;
      user_b_id: string;
      status: string;
      requested_by_id: string;
    };
  }

  async listConversations(userId: string) {
    const result = await this.db.query(
      `SELECT
         c.id,
         c.status,
         c.requested_by_id,
         c.updated_at,
         CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END AS other_user_id,
         u.name AS other_user_name,
         p.photo_url AS other_user_photo,
         (
           SELECT content FROM dm_messages m
           WHERE m.conversation_id = c.id
           ORDER BY m.created_at DESC LIMIT 1
         ) AS last_message,
         (
           SELECT created_at FROM dm_messages m
           WHERE m.conversation_id = c.id
           ORDER BY m.created_at DESC LIMIT 1
         ) AS last_message_at
       FROM dm_conversations c
       INNER JOIN users u ON u.id = CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END
       LEFT JOIN players p ON p.user_id = u.id
       WHERE c.user_a_id = $1 OR c.user_b_id = $1
       ORDER BY c.updated_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async listPendingRequests(userId: string) {
    const result = await this.db.query(
      `SELECT
         c.id,
         c.requested_by_id,
         c.created_at,
         u.id AS from_user_id,
         u.name AS from_user_name,
         p.photo_url AS from_user_photo
       FROM dm_conversations c
       INNER JOIN users u ON u.id = c.requested_by_id
       LEFT JOIN players p ON p.user_id = u.id
       WHERE c.status = 'pending'
         AND c.requested_by_id <> $1
         AND (c.user_a_id = $1 OR c.user_b_id = $1)`,
      [userId],
    );
    return result.rows;
  }

  async getMessages(userId: string, conversationId: string) {
    const conv = await this.getConversationForUser(conversationId, userId);
    if (conv.status !== 'active') {
      throw new ForbiddenException(
        conv.status === 'pending'
          ? 'La conversación está pendiente de aceptación'
          : 'No podés ver esta conversación',
      );
    }
    const result = await this.db.query(
      `SELECT m.id, m.sender_id, m.content, m.created_at, u.name AS sender_name
       FROM dm_messages m
       INNER JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId],
    );
    return result.rows;
  }

  async sendMessage(userId: string, conversationId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) throw new BadRequestException('El mensaje no puede estar vacío');

    const conv = await this.getConversationForUser(conversationId, userId);
    const otherUserId = conv.user_a_id === userId ? conv.user_b_id : conv.user_a_id;

    if (conv.status === 'pending') {
      throw new ForbiddenException('Esperá a que acepten tu solicitud de mensaje');
    }
    if (conv.status === 'rejected') {
      throw new ForbiddenException('No podés enviar mensajes en esta conversación');
    }
    if (conv.status !== 'active') {
      const access = await this.getAccess(userId, otherUserId);
      if (!access.canMessage) {
        throw new ForbiddenException('Necesitás ser amigos o haber jugado un partido juntos para chatear');
      }
      await this.db.query(
        `UPDATE dm_conversations SET status = 'active', updated_at = NOW() WHERE id = $1`,
        [conversationId],
      );
    }

    const result = await this.db.query(
      `INSERT INTO dm_messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, content, created_at`,
      [conversationId, userId, trimmed],
    );
    await this.db.query(`UPDATE dm_conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]);
    const row = result.rows[0];
    return { ...row, sender_name: (await this.db.query(`SELECT name FROM users WHERE id = $1`, [userId])).rows[0]?.name };
  }

  async resolveUserIdFromPlayer(playerOrUserId: string): Promise<string> {
    const byUser = await this.db.query(`SELECT id FROM users WHERE id = $1`, [playerOrUserId]);
    if (byUser.rows[0]) return playerOrUserId;
    const byPlayer = await this.db.query(`SELECT user_id FROM players WHERE id = $1`, [playerOrUserId]);
    if (byPlayer.rows[0]?.user_id) return byPlayer.rows[0].user_id;
    throw new NotFoundException('Usuario no encontrado');
  }
}
