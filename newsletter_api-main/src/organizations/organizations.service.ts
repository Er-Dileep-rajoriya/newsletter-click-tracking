import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { Organization } from './entities/organization.entity';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) { }

  async create(createOrganizationDto: CreateOrganizationDto) {

    if(!createOrganizationDto.name)
    {
      throw new BadRequestException("Organization name is required.");
    }

    // prevent duplicate name
    const existingOrganization = await this.organizationRepository.findOne({
      where : {name : createOrganizationDto.name}
    });

    if(existingOrganization)
    {
      throw new ConflictException("Organization already exist with this name.");
    }

    const organization = this.organizationRepository.create(createOrganizationDto);
    return this.organizationRepository.save(organization);
  }

  findAll() {
    return this.organizationRepository.find();
  }
}