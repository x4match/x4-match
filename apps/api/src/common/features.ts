import { CanActivate, Injectable, ServiceUnavailableException } from '@nestjs/common';

/** Módulo de circuitos: pausado salvo que CIRCUITS_ENABLED=true. */
export function circuitsEnabled(): boolean {
  return process.env.CIRCUITS_ENABLED === 'true';
}

export function featureFlags() {
  return { circuits: circuitsEnabled() };
}

@Injectable()
export class CircuitsEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!circuitsEnabled()) {
      throw new ServiceUnavailableException({
        message: 'El módulo de circuitos está pausado por ahora.',
        code: 'CIRCUITS_DISABLED',
      });
    }
    return true;
  }
}
