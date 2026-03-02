import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { List } from '../lists/entities/list.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Subscriber } from '../subscribers/entities/subscriber.entity';
import { InjectKnex } from 'nestjs-knex';
import { EmailService } from '../email/email.service';
import { ListService } from '../lists/lists.service';
import { Knex } from 'knex';
import { SqsService } from 'src/services/aws/sqs/sqs.service';
import { AwsUtilsService } from 'src/utils/aws.utils';
import { Link } from 'src/click_stats/entities/link.entity';
import * as cheerio from 'cheerio';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    @InjectRepository(List)
    private listRepository: Repository<List>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(Link)
    private linkRepository: Repository<Link>,
    @InjectRepository(Subscriber)
    private subscriberRepository: Repository<Subscriber>,
    private readonly emailService: EmailService,
    private readonly listService: ListService,
    @InjectKnex() private readonly knex: Knex,
    private readonly sqsServices: SqsService,
    private readonly awsUtils: AwsUtilsService
  ) { }


  async createCampaign(
    createCampaignDto: CreateCampaignDto,
  ): Promise<Campaign> {

    if (!createCampaignDto.subject || !createCampaignDto.content) {
      throw new Error('Subject and content are required');
    }

    return await this.campaignRepository.manager.transaction(
      async (manager) => {

        // Validate list
        const list = await manager.findOne(List, {
          where: { id: createCampaignDto.listId },
        });
        if (!list) throw new NotFoundException('List not found');

        // Validate organization
        const organization = await manager.findOne(Organization, {
          where: { id: createCampaignDto.organizationId },
        });
        if (!organization)
          throw new NotFoundException('Organization not found');

        // Save campaign first
        const campaign = manager.create(Campaign, {
          subject: createCampaignDto.subject,
          content: '', // temporary
          list,
          organization,
        });

        const savedCampaign = await manager.save(campaign);

        // Parse HTML
        const $ = cheerio.load(createCampaignDto.content);
        const linksToSave: Link[] = [];

        $('a[href]').each((_, element) => {
          const originalUrl = $(element).attr('href');
          if (!originalUrl) return;

          const link = manager.create(Link, {
            cid: savedCampaign.id,   // IMPORTANT
            url: originalUrl,
            hits: 0,
            visits: 0,
          });

          linksToSave.push(link);
        });

        // If no links → just save content
        if (linksToSave.length === 0) {
          savedCampaign.content = createCampaignDto.content;
          return await manager.save(savedCampaign);
        }

        // Save links → DB will generate numeric id
        const savedLinks = await manager.save(linksToSave);

        // Inject numeric link IDs into HTML
        let index = 0;

        $('a[href]').each((_, element) => {
          const linkEntity = savedLinks[index++];
          if (!linkEntity) return;

          $(element).attr('data-link-id', linkEntity.id.toString());
        });

        savedCampaign.content = $.html();

        return await manager.save(savedCampaign);
      },
    );
  }

  async listCampaigns(): Promise<Campaign[]> {
    return this.campaignRepository.find({
      relations: ['list', 'organization'],
      order: { createdAt: 'DESC' },
    });
  }

  async sendCampaign(
    id: string,
    filters?: Record<string, any>,
  ): Promise<any> {

    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ['list', 'organization'],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const segmented = await this.listService.segmentSubscribers(
      campaign.list.id,
      filters || {},
    );

    const subscribers = segmented.data;

    if (!subscribers.length) {
      return {
        campaignId: campaign.id,
        message: 'No subscribers matched segmentation filters',
        totalQueued: 0,
      };
    }

    const queueUrl = process.env.EMAIL_SENDING_QUEUE;
    if (!queueUrl) {
      throw new Error('EMAIL_SENDING_QUEUE not configured');
    }

    const jwtSecret = process.env.JWT_SECRET_KEY!;
    const batchMessages = [];

    // Fetch links once
    const links = await this.linkRepository.find({
      where: { cid: campaign.id },
    });

    const linkMap = new Map<number, string>();
    for (const link of links) {
      linkMap.set(link.id, link.url);
    }

    for (const sub of subscribers) {

      // Parse content fresh per subscriber
      const $ = cheerio.load(campaign.content);

      $('a[data-link-id]').each((_, element) => {

        const linkIdStr = $(element).attr('data-link-id');
        if (!linkIdStr) return;

        const linkId = parseInt(linkIdStr, 10);
        const originalUrl = linkMap.get(linkId);

        if (!originalUrl) return;

        const token = jwt.sign(
          {
            cid: campaign.id,
            sid: sub.id,
            lid: linkId,
            oid: campaign.organization.id,
            url: originalUrl
          },
          jwtSecret,
          { expiresIn: '7d' },
        );

        const trackingUrl =
          `${process.env.TRACKING_BASE_URL || "http://localhost:8080"}/api/click-stats/track?token=${token}`;

        $(element).attr('href', trackingUrl);
      });

      const personalizedContent = $.html();

      batchMessages.push(
        this.awsUtils.createSqsBatchMessage(
          {
            campaignId: campaign.id,
            subscriberId: sub.id,
            email: sub.email,
            subject: campaign.subject,
            content: personalizedContent,
            organizationId: campaign.organization.id,
          },
          {
            messageGroupId: campaign.id,
            deduplicationId: `${campaign.id}_${sub.id}_${Date.now()}`,
          },
        ),
      );
    }

    // Send in batches of 10
    const batchSize = 10;

    for (let i = 0; i < batchMessages.length; i += batchSize) {
      const batch = batchMessages.slice(i, i + batchSize);
      await this.sqsServices.sendBatch(queueUrl, batch);
    }

    return {
      campaignId: campaign.id,
      message: 'Campaign queued successfully',
      totalQueued: subscribers.length,
      filters: filters || {},
    };
  }

  async getTrackingSettingsByCidTx(
    tx: Knex.Transaction,
    cid: string,
  ) {
    try {
      const entity = await tx('campaigns')
        .where('campaigns.id', cid)
        .select(['campaigns.id', 'campaigns.click_tracking_disabled', 'campaigns.open_tracking_disabled'])
        .first();
      if (!entity) {
        throw new NotFoundException(`Campaign with CID ${cid} not found`);
      }
      return entity;
    } catch (error) {
      console.error('Error fetching campaign tracking settings:', error);
      throw error;
    }
  }
}