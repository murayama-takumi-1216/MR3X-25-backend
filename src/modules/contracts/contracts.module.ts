import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { PlansModule } from '../plans/plans.module';
import { ContractVerificationController, ExternalSigningController } from './contract-verification.controller';
import { ContractHashService } from './services/contract-hash.service';
import { ContractPdfService } from './services/contract-pdf.service';
import { SignatureLinkService } from './services/signature-link.service';

@Module({
  imports: [PlansModule],
  controllers: [
    ContractsController,
    ContractVerificationController,
    ExternalSigningController,
  ],
  providers: [
    ContractsService,
    ContractHashService,
    ContractPdfService,
    SignatureLinkService,
  ],
  exports: [
    ContractsService,
    ContractHashService,
    ContractPdfService,
    SignatureLinkService,
  ],
})
export class ContractsModule {}
