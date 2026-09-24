import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** Solo rol PARTNER + membership. SUPER_ADMIN opera por /platform/shop/*. */
@Injectable()
export class SponsorMemberGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.sub as string | undefined;
    if (!userId) throw new UnauthorizedException('No autenticado');

    const user = await this.db.query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1`,
      [userId],
    );
    const role = user.rows[0]?.role;
    if (!role) throw new ForbiddenException('Usuario no encontrado');
    req.user = { ...req.user, role };

    if (role !== 'PARTNER') {
      throw new ForbiddenException('Se requiere rol PARTNER');
    }

    const sponsorId = req.params?.sponsorId as string | undefined;
    if (!sponsorId) return true;

    const result = await this.db.query(
      `SELECT 1 FROM platform_sponsor_members WHERE user_id = $1 AND sponsor_id = $2`,
      [userId, sponsorId],
    );
    if (!result.rows[0]) {
      throw new ForbiddenException('No sos miembro de este partner');
    }
    return true;
  }
}
