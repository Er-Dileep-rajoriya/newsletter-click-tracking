import Redis from 'ioredis';

export class RedisPublisher {
    private readonly redis: Redis;

    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
        });
    }

    async publish(channel: string, message: any) {
        await this.redis.publish(channel, JSON.stringify(message));
        console.log("Message published : ", message)
    }
}