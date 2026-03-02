import { Injectable, BadRequestException } from '@nestjs/common';
import { SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';

@Injectable()
export class AwsUtilsService {

    createSqsBatchMessage<T>(
        payload: T,
        options?: {
            messageGroupId?: string;
            deduplicationId?: string;
        },
    ): SendMessageBatchRequestEntry {

        if (!payload) {
            throw new BadRequestException('SQS payload is required');
        }

        const messageBody = JSON.stringify(payload);

        if (!messageBody || messageBody === 'undefined') {
            throw new BadRequestException('Invalid SQS message body');
        }

        const id = randomUUID();

        return {
            Id: id, // Required for batch
            MessageBody: messageBody,
            MessageGroupId: options?.messageGroupId || 'default-group',
            MessageDeduplicationId:
                options?.deduplicationId || id,
        };
    }
}