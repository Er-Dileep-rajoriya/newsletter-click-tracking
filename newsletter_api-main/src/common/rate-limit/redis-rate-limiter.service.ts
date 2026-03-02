import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';

@Injectable()
export class RedisRateLimiterService {
    private redis: Redis;
    private clickLimiter: RateLimiterRedis;

    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
        });

        this.clickLimiter = new RateLimiterRedis({
            storeClient: this.redis,
            keyPrefix: 'click_rate_limit',
            points: 30, // 30 requests
            duration: 60, // per 60 seconds
        });
    }

    async consume(key: string) {
        return this.clickLimiter.consume(key);
    }
}