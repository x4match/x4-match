import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ratingToSkillScore } from '../common/utils';

type AvailabilitySlot = {
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  clubId?: string;
};

@Injectable()
export class AvailabilityService {
  constructor(private readonly db: DatabaseService) {}

  async setAvailability(userId: string, availabilities: AvailabilitySlot[]) {
    this.validateNoOverlaps(availabilities);

    await this.db.query(`DELETE FROM player_availability WHERE user_id = $1`, [userId]);

    for (const slot of availabilities) {
      if (slot.startHour >= slot.endHour) {
        throw new BadRequestException('La hora de inicio debe ser anterior a la hora de fin');
      }
      await this.db.query(
        `INSERT INTO player_availability (user_id, day_of_week, start_hour, end_hour, club_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, slot.dayOfWeek, slot.startHour, slot.endHour, slot.clubId ?? null],
      );
    }

    return this.getMyAvailability(userId);
  }

  async getMyAvailability(userId: string) {
    const result = await this.db.query(
      `SELECT pa.id,
              pa.day_of_week AS "dayOfWeek",
              pa.start_hour AS "startHour",
              pa.end_hour AS "endHour",
              pa.club_id AS "clubId",
              c.name AS "clubName"
       FROM player_availability pa
       LEFT JOIN clubs c ON c.id = pa.club_id
       WHERE pa.user_id = $1
       ORDER BY pa.day_of_week ASC, pa.start_hour ASC`,
      [userId],
    );
    return result.rows;
  }

  async deleteSlot(userId: string, slotId: string) {
    const result = await this.db.query(
      `DELETE FROM player_availability
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [slotId, userId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException('Horario no encontrado');
    }
    return { message: 'Horario eliminado' };
  }

  async updateSlot(
    userId: string,
    slotId: string,
    data: { dayOfWeek?: number; startHour?: number; endHour?: number },
  ) {
    const current = await this.db.query(
      `SELECT * FROM player_availability WHERE id = $1 AND user_id = $2`,
      [slotId, userId],
    );
    if (current.rows.length === 0) {
      throw new NotFoundException('Horario no encontrado');
    }

    const slot = current.rows[0];
    const dayOfWeek = data.dayOfWeek ?? slot.day_of_week;
    const startHour = data.startHour ?? slot.start_hour;
    const endHour = data.endHour ?? slot.end_hour;

    if (startHour >= endHour) {
      throw new BadRequestException('La hora de inicio debe ser anterior a la hora de fin');
    }

    const overlap = await this.db.query(
      `SELECT id FROM player_availability
       WHERE user_id = $1 AND id <> $2 AND day_of_week = $3
         AND start_hour < $5 AND end_hour > $4
       LIMIT 1`,
      [userId, slotId, dayOfWeek, startHour, endHour],
    );
    if (overlap.rows.length > 0) {
      throw new BadRequestException('El horario se solapa con otro ya existente');
    }

    const updated = await this.db.query(
      `UPDATE player_availability
       SET day_of_week = $3, start_hour = $4, end_hour = $5
       WHERE id = $1 AND user_id = $2
       RETURNING id,
                 day_of_week AS "dayOfWeek",
                 start_hour AS "startHour",
                 end_hour AS "endHour",
                 club_id AS "clubId"`,
      [slotId, userId, dayOfWeek, startHour, endHour],
    );
    return updated.rows[0];
  }

  async addSlot(userId: string, slot: AvailabilitySlot) {
    if (slot.startHour >= slot.endHour) {
      throw new BadRequestException('La hora de inicio debe ser anterior a la hora de fin');
    }

    const overlap = await this.db.query(
      `SELECT id FROM player_availability
       WHERE user_id = $1 AND day_of_week = $2
         AND start_hour < $4 AND end_hour > $3
       LIMIT 1`,
      [userId, slot.dayOfWeek, slot.startHour, slot.endHour],
    );
    if (overlap.rows.length > 0) {
      throw new BadRequestException('El horario se solapa con otro ya existente');
    }

    const result = await this.db.query(
      `INSERT INTO player_availability (user_id, day_of_week, start_hour, end_hour, club_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id,
                 day_of_week AS "dayOfWeek",
                 start_hour AS "startHour",
                 end_hour AS "endHour",
                 club_id AS "clubId"`,
      [userId, slot.dayOfWeek, slot.startHour, slot.endHour, slot.clubId ?? null],
    );
    return result.rows[0];
  }

  async findAvailablePlayers(params: {
    date: Date;
    startHour: number;
    endHour: number;
    clubId?: string;
    levelMin?: number;
    levelMax?: number;
    excludeUserIds?: string[];
  }) {
    const dayOfWeek = params.date.getDay();
    const values: unknown[] = [dayOfWeek, params.startHour, params.endHour];
    let idx = 4;

    let sql = `
      SELECT DISTINCT p.id AS player_id,
             p.user_id,
             u.name,
             p.level,
             p.rating,
             p.photo_url
      FROM players p
      INNER JOIN users u ON u.id = p.user_id
      INNER JOIN player_availability pa ON pa.user_id = p.user_id
      WHERE pa.day_of_week = $1
        AND pa.start_hour <= $2
        AND pa.end_hour >= $3
    `;

    if (params.clubId) {
      sql += ` AND (pa.club_id IS NULL OR pa.club_id = $${idx})`;
      values.push(params.clubId);
      idx++;
    }

    if (params.excludeUserIds?.length) {
      sql += ` AND p.user_id <> ALL($${idx}::uuid[])`;
      values.push(params.excludeUserIds);
    }

    sql += ` ORDER BY p.rating ASC NULLS LAST LIMIT 20`;

    const result = await this.db.query(sql, values);
    return result.rows
      .map((row) => ({
        ...row,
        skill_score: ratingToSkillScore(
          row.rating != null ? Number(row.rating) : row.level != null ? Number(row.level) : null,
        ),
      }))
      .filter((row) => {
        if (params.levelMin != null && row.skill_score < params.levelMin) return false;
        if (params.levelMax != null && row.skill_score > params.levelMax) return false;
        return true;
      });
  }

  private validateNoOverlaps(slots: AvailabilitySlot[]) {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (
          slots[i].dayOfWeek === slots[j].dayOfWeek &&
          slots[i].startHour < slots[j].endHour &&
          slots[j].startHour < slots[i].endHour
        ) {
          throw new BadRequestException(
            `Los horarios del ${this.getDayName(slots[i].dayOfWeek)} se solapan`,
          );
        }
      }
    }
  }

  private getDayName(day: number): string {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[day] || `día ${day}`;
  }
}
