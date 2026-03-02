// click_stat.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';

import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Subscriber } from '../../subscribers/entities/subscriber.entity';
import { Link } from './link.entity';

@Entity('click_stats')
@Index('idx_click_campaign', ['campaignId'])
@Index('idx_click_subscriber', ['subscriberId'])
@Index('idx_click_link', ['linkId'])
@Index('idx_click_created_at', ['createdAt'])
export class ClickStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  campaignId: string;

  @Column('uuid')
  subscriberId: string;

  @Column()
  linkId: number;


  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @ManyToOne(() => Subscriber, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscriberId' })
  subscriber: Subscriber;

  @ManyToOne(() => Link, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'linkId' })
  link: Link;


  @Column({ type: 'inet', nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}