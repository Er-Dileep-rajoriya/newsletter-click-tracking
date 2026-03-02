import * as dotenv from 'dotenv';
dotenv.config();
import { Logger } from '@nestjs/common';
import { SesService } from './services/ses.service';
import { EmailProcessorService } from './services/email-processor.service';
import { SqsConsumerService } from './services/sqs-consumer.service';

const logger = new Logger('EmailWorker');

const REGION = process.env.AWS_REGION!;
const QUEUE_URL = process.env.EMAIL_SENDING_QUEUE!;
const FROM_EMAIL = process.env.SES_FROM_EMAIL!;

if (!REGION || !QUEUE_URL || !FROM_EMAIL) {
    throw new Error('Missing required environment variables');
}

const sesService = new SesService(REGION, FROM_EMAIL);
const emailProcessor = new EmailProcessorService(sesService);
const sqsConsumer = new SqsConsumerService(REGION, QUEUE_URL);

async function start() {
    logger.log('Email Worker started...');

    while (true) {
        try {
            await sqsConsumer.poll((message) =>
                emailProcessor.process(message),
            );
        } catch (error) {
            logger.error('Worker loop error', error.stack);
        }
    }
}

process.on('SIGINT', () => {
    logger.warn('Email Worker shutting down...');
    process.exit(0);
});

start();