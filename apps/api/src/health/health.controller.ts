import { Controller, Get } from '@nestjs/common';

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

  private payload() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
