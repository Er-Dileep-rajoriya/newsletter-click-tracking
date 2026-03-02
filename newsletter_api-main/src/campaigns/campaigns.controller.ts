import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { CampaignService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import * as jwt from 'jsonwebtoken';

@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) { }

  @Get(':id/socket-token')
  generateSocketToken(@Param('id') id: string) {
    const token = jwt.sign(
      { campaignId: id },
      process.env.JWT_SECRET_KEY!,
      { expiresIn: '1h' },
    );

    return { token };
  }

  @Post()
  async createCampaign(@Body() createCampaignDto: CreateCampaignDto) {
    return this.campaignService.createCampaign(createCampaignDto);
  }

  @Get()
  async listCampaigns() {
    return this.campaignService.listCampaigns();
  }

  @Post(':id/send')
  async sendCampaign(
    @Param('id') id: string,
    @Body() filters?: { country?: string; tag?: string }
  ) {
    return this.campaignService.sendCampaign(id, filters);
  }
}