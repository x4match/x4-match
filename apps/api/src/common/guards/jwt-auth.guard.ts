import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token requerido');
    }
    const token = header.slice(7);
    try {
      request.user = this.jwtService.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
