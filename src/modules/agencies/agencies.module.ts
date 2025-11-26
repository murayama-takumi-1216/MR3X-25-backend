import { Module } from '@nestjs/common';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';
import { PrismaService } from '../../config/prisma.service';

@Module({
  controllers: [AgenciesController],
  providers: [AgenciesService, PrismaService],
})
export class AgenciesModule {}
