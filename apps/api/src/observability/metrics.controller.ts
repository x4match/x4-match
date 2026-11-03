import { Controller, Get, Headers, NotFoundException, Res } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /** Scrapeado por Grafana Alloy. Sin METRICS_TOKEN configurado el endpoint no existe. */
  @Get()
  async scrape(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    if (!this.isAuthorized(authorization)) {
      throw new NotFoundException();
    }
    res.setHeader('Content-Type', this.metrics.registry.contentType);
    return this.metrics.registry.metrics();
  }

  private isAuthorized(authorization: string | undefined): boolean {
    const expected = process.env.METRICS_TOKEN;
    if (!expected || !authorization?.startsWith('Bearer ')) return false;
    const given = Buffer.from(authorization.slice(7));
    const wanted = Buffer.from(expected);
    return given.length === wanted.length && timingSafeEqual(given, wanted);
  }
}
