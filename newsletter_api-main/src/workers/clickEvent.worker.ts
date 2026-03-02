import * as dotenv from 'dotenv';
dotenv.config();
import { Logger } from '@nestjs/common';
import { SqsConsumerService } from './services/sqs-consumer.service';
import { ClickEventProcessorService } from './services/click-event-processor.service';

const logger = new Logger('clickEventWorker');

const REGION = process.env.AWS_REGION!;
const QUEUE_URL = process.env.CLICK_EVENT_QUEUE!;

if (!REGION || !QUEUE_URL) {
    throw new Error('Missing required environment variables');
}

const sqsConsumer = new SqsConsumerService(REGION, QUEUE_URL);
const clickEventProcessorService = new ClickEventProcessorService();

async function start() {
    logger.log('Email Click Event Worker started...');

    while (true) {
        try {
            await sqsConsumer.poll((message) =>
                clickEventProcessorService.processEvent(message),
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