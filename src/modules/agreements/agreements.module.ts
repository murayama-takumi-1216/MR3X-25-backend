import { Module } from '@nestjs/common';
import { AgreementsController } from './agreements.controller';
import { AgreementsService } from './agreements.service';
import { AgreementPermissionService } from './services/agreement-permission.service';
import { AgreementCalculationService } from './services/agreement-calculation.service';
import { AgreementPermissionGuard } from './guards/agreement-permission.guard';

@Module({
  controllers: [AgreementsController],
  providers: [
    AgreementsService,
    AgreementPermissionService,
    AgreementCalculationService,
    AgreementPermissionGuard,
  ],
  exports: [
    AgreementsService,
    AgreementPermissionService,
    AgreementCalculationService,
  ],
})
export class AgreementsModule {}
