import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import express, { Express } from 'express';

const server = express();

/** Promise cacheada: en Vercel no recrear Nest en cada request. */
let nestReady: Promise<Express> | null = null;

export const createNestServer = async (): Promise<Express> => {
  if (!nestReady) {
    nestReady = (async () => {
      const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );

      app.enableCors({
        origin: '*',
        credentials: true,
      });

      await app.init();
      return server;
    })();
  }
  return nestReady;
};

// Modo serverless (Vercel) — reutiliza la misma instancia Nest entre requests
export default async (req: any, res: any) => {
  const app = await createNestServer();
  app(req, res);
};

// Modo servidor local
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  createNestServer()
    .then(() => {
      const port = process.env.PORT || 3000;
      server.listen(Number(port), '0.0.0.0', () => {
        console.log(`🚀 API running on http://0.0.0.0:${port}`);
      });
    })
    .catch((err) => {
      console.error('[api] Error al arrancar Nest:', err);
      process.exit(1);
    });
}
