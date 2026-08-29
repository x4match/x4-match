import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { CircuitsModule } from './circuits/circuits.module';
import { ClubPaymentConfigModule } from './clubs/club-payment-config.module';
import { ClubsModule } from './clubs/clubs.module';
import { FriendsModule } from './friends/friends.module';
import { FollowsModule } from './follows/follows.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PlayersModule } from './players/players.module';
import { UsersModule } from './users/users.module';
import { MatchesModule } from './matches/matches.module';
import { ChatModule } from './chat/chat.module';
import { CommunityModule } from './community/community.module';
import { AvailabilityModule } from './availability/availability.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ShopModule } from './shop/shop.module';
import { PaymentsModule } from './payments/payments.module';
import { CompetitiveScoringModule } from './competitive-scoring/competitive-scoring.module';
import { BadgesModule } from './badges/badges.module';
import { ReportsModule } from './reports/reports.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
    DatabaseModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    PlayersModule,
    MatchesModule,
    ChatModule,
    CommunityModule,
    AvailabilityModule,
    MatchmakingModule,
    ClubPaymentConfigModule,
    ClubsModule,
    CircuitsModule,
    FriendsModule,
    FollowsModule,
    MessagingModule,
    NotificationsModule,
    ShopModule,
    PaymentsModule,
    CompetitiveScoringModule,
    BadgesModule,
    ReportsModule,
    TournamentsModule,
    PlatformAdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
