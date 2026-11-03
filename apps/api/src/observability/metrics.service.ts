import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: 'x4_http_requests_total',
    help: 'Requests HTTP atendidos por la API',
    labelNames: ['method', 'route', 'status', 'platform'] as const,
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'x4_http_request_duration_seconds',
    help: 'Latencia de los requests HTTP',
    labelNames: ['method', 'route', 'status_class'] as const,
    buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly socketConnections = new Gauge({
    name: 'x4_socket_connections',
    help: 'Clientes conectados por Socket.IO',
    registers: [this.registry],
  });

  readonly analyticsEvents = new Counter({
    name: 'x4_analytics_events_total',
    help: 'Eventos de producto recibidos desde las apps',
    labelNames: ['platform'] as const,
    registers: [this.registry],
  });

  constructor() {
    this.registry.setDefaultLabels({ app: 'x4match-api' });
    collectDefaultMetrics({ register: this.registry, prefix: 'x4_' });
  }
}
