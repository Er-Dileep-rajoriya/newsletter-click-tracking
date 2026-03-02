import { Module } from '@nestjs/common';
import { SqsService } from './sqs/sqs.service';
import { AwsUtilsService } from 'src/utils/aws.utils';

@Module({
  providers: [SqsService, AwsUtilsService],
  exports: [SqsService, AwsUtilsService],
})
export class AwsModule {}