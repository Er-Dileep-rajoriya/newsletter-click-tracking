import { Injectable, Logger } from '@nestjs/common';
import { SesService } from './ses.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class EmailProcessorService {
    private readonly logger = new Logger(EmailProcessorService.name);

    constructor(private readonly sesService: SesService) { }

    private injectTrackingLinks(
        html: string,
        campaignId: string,
        email: string,
    ): string {
        if (!html) return html;

        return html.replace(
            /<a\s+[^>]*href="([^"]+)"[^>]*>/gi,
            (match, originalUrl) => {

                // Prevent double injection
                if (originalUrl.includes('/api/click-stats/track')) {
                    return match;
                }

                const encodedUrl = encodeURIComponent(originalUrl);

                // Create JWT
                const token = jwt.sign(
                    {
                        campaignId,
                        email,
                    },
                    process.env.JWT_SECRET_KEY || 'supersecret',
                    { expiresIn: '7d' },
                );

                const trackingUrl =
                    `${process.env.TRACKING_BASE_URL || 'http://localhost:8080'}` +
                    `/api/click-stats/track/${campaignId}` +
                    `?link=${encodedUrl}&token=${token}`;

                return match.replace(originalUrl, trackingUrl);
            },
        );
    }

    async process(rawMessage: any): Promise<void> {
        try {
            const body = JSON.parse(rawMessage.Body);
            console.log("body : ", body);
        
            const { campaignId, email, subject, content} = body;

            if (!campaignId || !email || !subject || !content) {
                this.logger.error(`Invalid message payload`);
                return;
            }

            const updatedContent = this.injectTrackingLinks(
                content,
                campaignId,
                email,
            );

            await this.sesService.sendEmail(
                email,
                subject,
                updatedContent,
            );

            this.logger.log(
                `Email sent | Campaign: ${campaignId} | Recipient: ${email}`,
            );

        } catch (error) {
            this.logger.error(
                `Email processing failed: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }
}