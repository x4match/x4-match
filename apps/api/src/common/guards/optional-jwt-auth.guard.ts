import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/** Adjunta request.user si hay Bearer válido; no falla si falta o es inválido. */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    if (!header?.startsWith('Bearer ')) {
      return true;
    }
    try {
      request.user = this.jwtService.verify(header.slice(7));
    } catch {
      // Público: token inválido = anónimo
    }
    return true;
  }
}
