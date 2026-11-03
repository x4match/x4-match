import { Global, Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { AnalyticsController } from './analytics.controller';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { ObservabilityMiddleware } from './observability.middleware';

/** El middleware se monta con app.use en main.ts: Express 5 no acepta el comodín de forRoutes('*'). */
@Global()
@Module({
  controllers: [MetricsController, AnalyticsController],
  providers: [MetricsService, ActivityService, ObservabilityMiddleware],
  exports: [MetricsService, ObservabilityMiddleware],
})
export class ObservabilityModule {}
