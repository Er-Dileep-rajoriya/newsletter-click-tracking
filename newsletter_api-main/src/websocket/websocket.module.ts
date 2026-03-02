import { Module } from '@nestjs/common';
import { ClickGateway } from './click.gateway';
import { RedisSubscriberService } from './redis-subscriber.service';

@Module({
  providers: [
    ClickGateway,
    RedisSubscriberService,
  ],
})
export class WebsocketModule {}