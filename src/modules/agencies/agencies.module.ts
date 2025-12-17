import { Module } from '@nestjs/common';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';
import { PrismaService } from '../../config/prisma.service';
import { PlansModule } from '../plans/plans.module';
import { AsaasModule } from '../asaas/asaas.module';

@Module({
  imports: [PlansModule, AsaasModule],
  controllers: [AgenciesController],
  providers: [AgenciesService, PrismaService],
  exports: [AgenciesService],
})
export class AgenciesModule {}
