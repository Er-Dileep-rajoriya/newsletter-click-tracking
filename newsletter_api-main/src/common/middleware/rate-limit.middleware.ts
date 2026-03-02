import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisRateLimiterService } from '../rate-limit/redis-rate-limiter.service';

@Injectable()
export class ClickRateLimitMiddleware implements NestMiddleware {
    constructor(
        private readonly rateLimiter: RedisRateLimiterService,
    ) { }

    async use(req: Request, res: Response, next: NextFunction) {
        try {
            const ip = req.ip;
            const token = req.query.token as string;

            // Combine IP + token (stronger protection)
            const key = `${ip}_${token || 'no-token'}`;

            await this.rateLimiter.consume(key);

            next();
        } catch {
            return res.status(429).json({
                message: 'Too many requests. Please try again later.',
            });
        }
    }
}