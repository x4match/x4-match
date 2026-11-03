import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { ActivityService } from './activity.service';
import { readClientInfo } from './client-info';
import { MetricsService } from './metrics.service';

@Injectable()
export class ObservabilityMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly metrics: MetricsService,
    private readonly activity: ActivityService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.originalUrl.startsWith('/metrics')) {
      next();
      return;
    }
    const startedAt = process.hrtime.bigint();
    const client = readClientInfo(req.headers);
    const userId = this.userIdFrom(req);

    res.on('finish', () => {
      // Usar el patrón de la ruta (/matches/:id) y no la URL real, para no explotar la cardinalidad.
      const route = req.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : 'unmatched';
      const status = String(res.statusCode);
      const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;

      this.metrics.httpRequests.inc({ method: req.method, route, status, platform: client.platform });
      this.metrics.httpDuration.observe(
        { method: req.method, route, status_class: `${status[0]}xx` },
        seconds,
      );
      if (userId) this.activity.record(userId, client);
    });
    next();
  }

  private userIdFrom(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    try {
      const payload = this.jwtService.verify<{ sub?: string }>(header.slice(7));
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
