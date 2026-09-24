import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SponsorMemberGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { sub?: string; role?: string } | undefined;
    if (!user?.sub) throw new ForbiddenException('No autenticado');

    if (user.role === 'SUPER_ADMIN') return true;

    // Allow list endpoint without sponsorId
    const sponsorId = req.params?.sponsorId;
    if (!sponsorId) {
      if (user.role === 'PARTNER' || user.role === 'SUPER_ADMIN') return true;
      throw new ForbiddenException('Se requiere rol PARTNER');
    }

    if (user.role !== 'PARTNER' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Se requiere rol PARTNER');
    }

    const result = await this.db.query(
      `SELECT 1 FROM platform_sponsor_members WHERE user_id = $1 AND sponsor_id = $2`,
      [user.sub, sponsorId],
    );
    if (!result.rows[0] && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('No sos miembro de este partner');
    }
    return true;
  }
}
