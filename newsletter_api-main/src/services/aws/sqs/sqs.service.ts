import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  SQSClient,
  SendMessageCommand,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
} from '@aws-sdk/client-sqs';

@Injectable()
export class SqsService {
  private readonly logger = new Logger(SqsService.name);
  private readonly sqs: SQSClient;

  constructor() {
    if (!process.env.AWS_REGION) {
      throw new Error('AWS_REGION is not configured');
    }

    this.sqs = new SQSClient({
      region: process.env.AWS_REGION,
    });
  }

  // Send Single Message (Standard or FIFO)
  async sendMessage(
    queueUrl: string,
    payload: unknown,
    options?: {
      messageGroupId?: string;
      deduplicationId?: string;
    },
  ): Promise<void> {
    if (!queueUrl) {
      throw new InternalServerErrorException(
        'Queue URL is required to send message',
      );
    }

    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(payload),

        // FIFO only fields (ignored by standard queue)
        MessageGroupId: options?.messageGroupId,
        MessageDeduplicationId: options?.deduplicationId,
      });

      await this.sqs.send(command);

      this.logger.log('Message successfully sent to SQS');
    } catch (error) {
      this.logger.error('Failed to send SQS message', error.stack);
      throw new InternalServerErrorException(
        'Failed to send message to SQS',
      );
    }
  }

  // Send Batch (Max 10 per request)
  async sendBatch(
    queueUrl: string,
    messages: SendMessageBatchRequestEntry[],
  ): Promise<void> {
    if (!queueUrl) {
      throw new InternalServerErrorException(
        'Queue URL is required for batch send',
      );
    }

    if (!messages?.length) {
      this.logger.warn('No messages provided for batch send');
      return;
    }

    if (messages.length > 10) {
      throw new InternalServerErrorException(
        'SQS batch limit exceeded (max 10 messages)',
      );
    }

    try {
      const command = new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: messages,
      });

      const response = await this.sqs.send(command);

      if (response.Failed?.length) {
        this.logger.error(
          `Some messages failed in batch: ${JSON.stringify(response.Failed)}`,
        );
      }

      this.logger.log(
        `Batch sent successfully. Count: ${messages.length}`,
      );
    } catch (error) {
      this.logger.error('Failed to send batch to SQS', error.stack);
      throw new InternalServerErrorException(
        'Failed to send batch to SQS',
      );
    }
  }
}