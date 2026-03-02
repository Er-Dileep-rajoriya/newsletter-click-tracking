import { Logger } from '@nestjs/common';
import knex, { Knex } from 'knex';
import * as dotenv from 'dotenv';
import { RedisPublisher } from './redis.publisher';

dotenv.config();

export class ClickEventProcessorService {
    private readonly logger = new Logger(ClickEventProcessorService.name);
    private readonly db: Knex;
    private readonly redisPublisher: RedisPublisher;

    constructor() {
        this.db = knex({
            client: 'pg',
            connection: {
                host: process.env.DB_HOST,
                port: Number(process.env.DB_PORT),
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
            },
            pool: { min: 2, max: 20 },
        });

        this.redisPublisher = new RedisPublisher();
    }

    async processEvent(rawMessage: any): Promise<void> {
        if (!rawMessage?.Body) {
            this.logger.warn('Empty SQS message received');
            return;
        }
        

        try {
            const body = JSON.parse(rawMessage.Body);
            console.log("body inside consumer : ", body)
            const campaignId = body.cid;
            const subscriberId = body.sid;
            const linkId = body.lid;
            const ipAddress = body.ip;
            const userAgent = body.userAgent;

            if (!campaignId || !subscriberId || !linkId) {
                this.logger.warn('Invalid click payload structure');
                return;
            }

            await this.db.transaction(async (trx) => {
                // 1. Insert raw click event
                await trx('click_stats').insert({
                    campaignId,
                    subscriberId,
                    linkId,
                    ipAddress,
                    userAgent,
                    createdAt: trx.fn.now(),
                });

                // 2️.Increment total hits (always)
                await trx('links')
                    .where({ id: linkId })
                    .increment('hits', 1);

                // 3. Unique visit detection
                const existing = await trx('click_stats')
                    .where({ campaignId, subscriberId, linkId })
                    .count<{ count: string }[]>('* as count')
                    .first();

                if (Number(existing?.count) === 1) {
                    await trx('links')
                        .where({ id: linkId })
                        .increment('visits', 1);
                }
            });

            this.logger.log(
                `Click processed | Campaign: ${campaignId} | Subscriber: ${subscriberId} | Link: ${linkId}`,
            );

            // 4️. Publish real-time update
            await this.redisPublisher.publish('click_events', {
                campaignId,
                linkId,
            });

        } catch (error: any) {
            this.logger.error(
                `Click event processing failed: ${error.message}`,
                error.stack,
            );

            // Important: rethrow so SQS retries
            throw error;
        }
    }
}