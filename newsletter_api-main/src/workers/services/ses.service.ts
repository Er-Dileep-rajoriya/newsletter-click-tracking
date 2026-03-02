import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Logger } from '@nestjs/common';

export class SesService {
    private readonly logger = new Logger(SesService.name);
    private readonly ses: SESClient;

    constructor(region: string, private readonly fromEmail: string) {
        this.ses = new SESClient({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });
    }

    async sendEmail(to: string, subject: string, html: string) {
        await this.ses.send(
            new SendEmailCommand({
                Destination: { ToAddresses: [to] },
                Message: {
                    Subject: { Data: subject },
                    Body: { Html: { Data: html } },
                },
                Source: this.fromEmail,
            }),
        );

        this.logger.log(`Email sent → ${to}`);
    }
}