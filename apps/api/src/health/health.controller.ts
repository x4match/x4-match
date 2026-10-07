import { Controller, Get } from '@nestjs/common';
import { featureFlags } from '../common/features';

@Controller()
export class HealthController {
  @Get()
  root() {
    return this.payload();
  }

  @Get('health')
  health() {
    return this.payload();
  }

  /** Módulos activos de la app (se controlan con variables de entorno). */
  @Get('features')
  features() {
    return featureFlags();
  }

  private payload() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
