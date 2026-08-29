import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub as string | undefined;
    if (!userId) {
      throw new UnauthorizedException('Token requerido');
    }

    const result = await this.db.query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1`,
      [userId],
    );
    const role = result.rows[0]?.role;
    if (role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo operadores internos (SUPER_ADMIN)');
    }

    request.platformUser = { id: userId, role };
    return true;
  }
}
