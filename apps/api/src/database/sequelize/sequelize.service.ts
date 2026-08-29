import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize-typescript';
import { ClubModel } from './models/club.model';
import { PlayerModel } from './models/player.model';
import { TournamentPhotoModel } from './models/tournament-photo.model';
import { TournamentModel } from './models/tournament.model';
import { UserModel } from './models/user.model';

@Injectable()
export class SequelizeService implements OnModuleInit, OnModuleDestroy {
  public readonly sequelize: Sequelize;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL no está definida');
    }
    this.sequelize = new Sequelize(connectionString, {
      dialect: 'postgres',
      logging: false,
      pool: { max: 5, min: 0, acquire: 8000, idle: 10_000 },
      models: [UserModel, PlayerModel, ClubModel, TournamentModel, TournamentPhotoModel],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.sequelize.authenticate();
  }

  async onModuleDestroy(): Promise<void> {
    await this.sequelize.close();
  }
}
