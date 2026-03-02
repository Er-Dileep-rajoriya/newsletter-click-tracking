import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClickStatController } from './click_stats.controller';
import { ClickStatService } from './click_stats.service';
import { ClickStat } from './entities/click_stat.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { AuthModule } from '../auth/auth.module';
import { Link } from './entities/link.entity';
import { List } from '../lists/entities/list.entity';
import { Subscriber } from '../subscribers/entities/subscriber.entity';
import { ListsModule } from '../lists/lists.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { SubscribersModule } from '../subscribers/subscribers.module';
import { AwsModule } from 'src/services/aws/aws.module';
import { ClickEventProcessorService } from 'src/workers/services/click-event-processor.service';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { RedisRateLimiterService } from 'src/common/rate-limit/redis-rate-limiter.service';
import { ClickRateLimitMiddleware } from 'src/common/middleware/rate-limit.middleware';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClickStat,
      Campaign,
      Link,
      List,
      Subscriber,
    ]),
    AuthModule,
    ListsModule,
    CampaignsModule,
    SubscribersModule,
    AwsModule,
  ],
  controllers: [ClickStatController],
  providers: [
    ClickStatService,
    ClickEventProcessorService,
    RedisRateLimiterService
  ],
  exports: [ClickStatService],
})

export class ClickStatsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ClickRateLimitMiddleware)
      .forRoutes('api/click-stats/track'); // rate limit -> 30 request per seconnd
  }
}
