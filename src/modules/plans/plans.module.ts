import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PlanEnforcementService } from './plan-enforcement.service';

@Module({
  controllers: [PlansController],
  providers: [PlansService, PlanEnforcementService],
  exports: [PlansService, PlanEnforcementService],
})
export class PlansModule {}
