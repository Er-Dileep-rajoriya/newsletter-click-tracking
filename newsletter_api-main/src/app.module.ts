import { Global, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from './organizations/organizations.module';
import { UserModule } from './users/users.module';
import { SubscribersModule } from './subscribers/subscribers.module';
import { ListsModule } from './lists/lists.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ClickStatsModule } from './click_stats/click_stats.module';
import { AuthModule } from './auth/auth.module';
import { Campaign } from './campaigns/entities/campaign.entity';
import { List } from './lists/entities/list.entity';
import { ClickStat } from './click_stats/entities/click_stat.entity';
import { Organization } from './organizations/entities/organization.entity';
import { Subscriber } from './subscribers/entities/subscriber.entity';
import { Email } from './email/entities/email.entity';
import { User } from './users/entities/user.entity';
import { Link } from './click_stats/entities/link.entity';
import { EmailModule } from './email/email.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/task.module';
import { KnexModule } from 'nestjs-knex';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { WebsocketModule } from './websocket/websocket.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `src/.${process.env.NODE_ENV || 'test'}.env`,
    }),
    TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.get<string>('DB_HOST'),
    port: Number(config.get<string>('DB_PORT')),
    username: config.get<string>('DB_USER'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_NAME'),
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: true,
  }),
}),// postgresql
    KnexModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        config: {
          client: 'pg',
          connection: {
            host: config.get<string>('DB_HOST'),
            port: config.get<number>('DB_PORT'),
            user: config.get<string>('DB_USER'),
            password: config.get<string>('DB_PASSWORD'),
            database: config.get<string>('DB_NAME'),
          },
          pool: { min: 2, max: 10 },
        },
      }),
    }),
    OrganizationsModule, // org
    UserModule, // cruds for user
    SubscribersModule, // subscribe organisations
    ListsModule,
    CampaignsModule,
    ClickStatsModule,
    AuthModule,
    EmailModule, // for emails sending and receiving
    ScheduleModule.forRoot(),
    TasksModule, // cron jobs (calls for every day)
    WebsocketModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
