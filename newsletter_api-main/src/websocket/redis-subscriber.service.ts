import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ClickGateway } from './click.gateway';

@Injectable()
export class RedisSubscriberService implements OnModuleInit {
    private readonly logger = new Logger(RedisSubscriberService.name);
    private subscriber: Redis;

    constructor(private readonly clickGateway: ClickGateway) {
        this.subscriber = new Redis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
        });
    }

    async onModuleInit() {
        await this.subscriber.subscribe('click_events');

        this.logger.log('Subscribed to Redis channel: click_events');

        this.subscriber.on('message', (channel, message) => {
            this.logger.log(`Redis message received: ${message}`);

            const data = JSON.parse(message);

            this.clickGateway.emitClickUpdate(
                data.campaignId,
                data,
            );
        });
    }
}