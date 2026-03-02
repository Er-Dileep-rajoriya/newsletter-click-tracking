import {
    SQSClient,
    ReceiveMessageCommand,
    DeleteMessageBatchCommand,
    SendMessageCommand,
    Message,
} from '@aws-sdk/client-sqs';
import { Logger } from '@nestjs/common';

export class SqsConsumerService {
    private readonly logger = new Logger(SqsConsumerService.name);
    private readonly sqs: SQSClient;
    private readonly maxRetry: number;
    private readonly dlqUrl: string | undefined;

    constructor(
        region: string,
        private readonly queueUrl: string,
    ) {
        this.sqs = new SQSClient({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });

        this.maxRetry = Number(process.env.SQS_MAX_RETRY || '2');
        this.dlqUrl = process.env.DEAD_LETER_QUEUE;
    }

    //Move failed message to DLQ manually
    private async moveToDLQ(message: Message): Promise<void> {
        if (!this.dlqUrl) {
            this.logger.error(
                'DLQ URL not configured. Message cannot be moved to DLQ.',
            );
            return;
        }

        try {
            await this.sqs.send(
                new SendMessageCommand({
                    QueueUrl: this.dlqUrl,
                    MessageBody: message.Body!,
                    // Required if FIFO queue
                    MessageGroupId: 'dlq-group',
                    MessageDeduplicationId: `${message.MessageId}-${Date.now()}`,
                }),
            );

            this.logger.warn(
                `Message ${message.MessageId} successfully moved to DLQ`,
            );
        } catch (err: any) {
            this.logger.error(
                `Failed to move message ${message.MessageId} to DLQ`,
                err.stack,
            );
        }
    }

    //Poll messages and process them
    async poll(
        handler: (message: Message) => Promise<void>,
    ): Promise<void> {
        const response = await this.sqs.send(
            new ReceiveMessageCommand({
                QueueUrl: this.queueUrl,
                MaxNumberOfMessages: 10,
                WaitTimeSeconds: 10,
                VisibilityTimeout: 30,
                MessageSystemAttributeNames: ['ApproximateReceiveCount'],
            }),
        );

        if (!response.Messages?.length) {
            return;
        }

        const successfulDeletes: {
            Id: string;
            ReceiptHandle: string;
        }[] = [];

        for (const message of response.Messages) {
            const retryCount = Number(
                message.Attributes?.ApproximateReceiveCount || 0,
            );

            try {
                await handler(message);

                // If processed successfull ->  mark for delete
                successfulDeletes.push({
                    Id: message.MessageId!,
                    ReceiptHandle: message.ReceiptHandle!,
                });

            } catch (error: any) {
                this.logger.error(
                    `Message ${message.MessageId} failed (retry ${retryCount})`,
                    error.stack,
                );

                // If exceeded retry limit -> send to DLQ
                if (retryCount >= this.maxRetry) {
                    this.logger.warn(
                        `Message ${message.MessageId} exceeded max retry (${this.maxRetry}). Sending to DLQ.`,
                    );

                    await this.moveToDLQ(message);

                    // After moving to DLQ → delete from main queue
                    successfulDeletes.push({
                        Id: message.MessageId!,
                        ReceiptHandle: message.ReceiptHandle!,
                    });
                }
                // else ->  do nothing, SQS will retry automatically
            }
        }

        if (successfulDeletes.length > 0) {
            await this.sqs.send(
                new DeleteMessageBatchCommand({
                    QueueUrl: this.queueUrl,
                    Entries: successfulDeletes,
                }),
            );

            this.logger.log(
                `Deleted ${successfulDeletes.length} processed messages`,
            );
        }
    }
}